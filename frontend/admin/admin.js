const AdminApp = (() => {
  const TOKEN_KEY = 'bakery_admin_token';
  const TENANT_KEY = 'bakery_admin_tenant';

  // Campos editables de la portada (etiqueta y si permite varias líneas)
  const CAMPOS_CONTENIDO = [
    { clave: 'announcement', etiqueta: 'Barra de anuncios', multilinea: false },
    { clave: 'hero_eyebrow', etiqueta: 'Hero — texto superior', multilinea: false },
    { clave: 'hero_titulo', etiqueta: 'Hero — título (cada línea es un salto)', multilinea: true },
    { clave: 'hero_sub', etiqueta: 'Hero — subtítulo', multilinea: true },
    { clave: 'hero_cta', etiqueta: 'Hero — botón', multilinea: false },
    { clave: 'nosotros_titulo', etiqueta: 'Nosotros — título', multilinea: false },
    { clave: 'nosotros_texto', etiqueta: 'Nosotros — texto', multilinea: true },
    { clave: 'contacto_texto', etiqueta: 'Contacto — texto', multilinea: true },
    { clave: 'footer_texto', etiqueta: 'Pie de página', multilinea: false },
  ];

  const $ = (sel) => document.querySelector(sel);
  const loginView = $('#admin-login');
  const panel = $('#admin-panel');
  const tools = $('#admin-tools');
  const tenantSel = $('#admin-tenant');
  const tbody = $('#admin-tbody');
  const msg = $('#admin-msg');
  const loginMsg = $('#admin-login-msg');
  const contenidoCampos = $('#contenido-campos');
  const contenidoMsg = $('#contenido-msg');
  const pedidosTbody = $('#pedidos-tbody');
  const pedidosMsg = $('#pedidos-msg');
  const contactosTbody = $('#contactos-tbody');
  const contactosMsg = $('#contactos-msg');

  const escapeHtml = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

  const previewImagen = (url) =>
    url
      ? `<img src="${escapeHtml(url)}" alt="Imagen del producto">`
      : '<span class="img-none">Sin imagen</span>';

  let productos = [];
  let valoresContenido = {};
  let pedidos = [];
  let contactos = [];
  let nuevaImagen = '';

  const token = () => localStorage.getItem(TOKEN_KEY);
  const tenantSlug = () => localStorage.getItem(TENANT_KEY) || 'kokorocakes';

  async function request(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Slug': tenantSlug(),
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  function setMsg(el, texto, ok = false) {
    el.textContent = texto;
    el.classList.toggle('error', !ok);
    el.classList.toggle('success', ok);
  }

  async function iniciarSesion(password) {
    const data = await request('/api/admin/login', { method: 'POST', body: { password } });
    localStorage.setItem(TOKEN_KEY, data.token);
    mostrarPanel();
    await cargarTenants();
    await recargarTodo();
  }

  async function cargarTenants() {
    const data = await request('/api/admin/tiendas');
    tenantSel.innerHTML = data.tiendas
      .map((t) => `<option value="${escapeHtml(t.slug)}" ${t.slug === tenantSlug() ? 'selected' : ''}>${escapeHtml(t.nombre)} (${escapeHtml(t.slug)})</option>`)
      .join('');
  }

  async function cargarProductos() {
    const data = await request('/api/admin/productos');
    productos = data.productos;
    render();
    setMsg(msg, `Tienda ${data.tienda}: ${data.productos.length} productos`, true);
  }

  function render() {
    if (productos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8">No hay productos en esta tienda.</td></tr>';
      return;
    }
    tbody.innerHTML = productos.map((p, i) => `
      <tr data-id="${p.id}">
        <td>
          <div class="p-nombre">${escapeHtml(p.nombre)}</div>
          <input type="text" class="edit-nombre" value="${escapeHtml(p.nombre)}" aria-label="Nombre del producto">
          <input type="text" class="edit-desc" value="${escapeHtml(p.descripcion || '')}" aria-label="Descripción del producto">
        </td>
        <td><textarea class="edit-ing" rows="3" aria-label="Ingredientes del producto">${escapeHtml(p.ingredientes || '')}</textarea></td>
        <td>${escapeHtml(p.categoria || '—')}</td>
        <td>
          <span class="img-cell" data-img="${escapeHtml(p.imagen_s3 || '')}">
            <span class="img-preview">${previewImagen(p.imagen_s3)}</span>
            <input type="file" class="file-img" accept="image/*" hidden>
            <button type="button" class="img-btn" data-i="${i}">Subir imagen</button>
            ${p.imagen_s3 ? `<button type="button" class="img-clear" data-i="${i}">Quitar</button>` : ''}
          </span>
        </td>
        <td><input type="number" class="edit-precio" step="0.01" min="0" value="${p.precio}" aria-label="Precio"></td>
        <td><input type="number" class="edit-stock" step="1" min="0" value="${p.stock}" aria-label="Stock"></td>
        <td><input type="checkbox" class="edit-disp" ${p.disponible ? 'checked' : ''} aria-label="Disponible"></td>
        <td>
          <button type="button" class="save-btn" data-i="${i}">Guardar</button>
          <button type="button" class="delete-btn" data-i="${i}" aria-label="Eliminar producto">Eliminar</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.save-btn').forEach((btn) => {
      btn.addEventListener('click', () => guardarFila(btn));
    });
    tbody.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => eliminarFila(btn));
    });
    tbody.querySelectorAll('.img-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('tr').querySelector('.file-img').click();
      });
    });
    tbody.querySelectorAll('.file-img').forEach((input) => {
      input.addEventListener('change', () => subirImagen(input));
    });
    tbody.querySelectorAll('.img-clear').forEach((btn) => {
      btn.addEventListener('click', () => quitarImagen(btn));
    });
  }

  async function guardarFila(btn) {
    const tr = btn.closest('tr');
    const id = tr.dataset.id;
    const p = productos[Number(btn.dataset.i)];
    const body = {
      nombre: tr.querySelector('.edit-nombre').value.trim(),
      descripcion: tr.querySelector('.edit-desc').value,
      ingredientes: tr.querySelector('.edit-ing').value,
      precio: Number(tr.querySelector('.edit-precio').value),
      stock: Number(tr.querySelector('.edit-stock').value),
      disponible: tr.querySelector('.edit-disp').checked,
    };
    if (!body.nombre) {
      setMsg(msg, 'El nombre no puede estar vacío.');
      return;
    }
    btn.disabled = true;
    try {
      const guardado = await request(`/api/admin/productos/${id}`, { method: 'PATCH', body });
      Object.assign(p, {
        nombre: guardado.nombre,
        descripcion: guardado.descripcion,
        ingredientes: guardado.ingredientes,
        imagen_s3: guardado.imagen_s3,
        precio: guardado.precio,
        stock: guardado.stock,
        disponible: guardado.disponible,
      });
      setMsg(msg, `Guardado: ${guardado.nombre} (stock ${guardado.stock}, precio ${guardado.precio} €).`, true);
      render();
    } catch (err) {
      setMsg(msg, `No se pudo guardar: ${err.message}`);
      btn.disabled = false;
    }
  }

  async function eliminarFila(btn) {
    const tr = btn.closest('tr');
    const id = tr.dataset.id;
    const p = productos[Number(btn.dataset.i)];
    if (!confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)) return;
    btn.disabled = true;
    try {
      await request(`/api/admin/productos/${id}`, { method: 'DELETE' });
      productos = productos.filter((x) => x.id !== id);
      setMsg(msg, `Producto "${p.nombre}" eliminado.`, true);
      render();
    } catch (err) {
      setMsg(msg, `No se pudo eliminar: ${err.message}`);
      btn.disabled = false;
    }
  }

  async function subirImagen(input) {
    const tr = input.closest('tr');
    const p = productos[Number(tr.querySelector('.img-btn').dataset.i)];
    const file = input.files[0];
    if (!file) return;
    const btn = tr.querySelector('.img-btn');
    btn.disabled = true;
    btn.textContent = 'Subiendo…';
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/imagenes', {
        method: 'POST',
        headers: { 'X-Tenant-Slug': tenantSlug(), Authorization: `Bearer ${token()}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      const guardado = await request(`/api/admin/productos/${p.id}`, {
        method: 'PATCH',
        body: { imagen_s3: data.url },
      });
      p.imagen_s3 = guardado.imagen_s3;
      setMsg(msg, `Imagen subida a "${p.nombre}".`, true);
      render();
    } catch (err) {
      setMsg(msg, `No se pudo subir la imagen: ${err.message}`);
      btn.disabled = false;
      btn.textContent = 'Subir imagen';
    } finally {
      input.value = '';
    }
  }

  async function quitarImagen(btn) {
    const tr = btn.closest('tr');
    const p = productos[Number(btn.dataset.i)];
    const url = p.imagen_s3 || '';
    btn.disabled = true;
    try {
      const guardado = await request(`/api/admin/productos/${p.id}`, {
        method: 'PATCH',
        body: { imagen_s3: null },
      });
      if (url.startsWith('/api/imagenes/')) {
        fetch(`/api/admin/imagenes/${url.replace('/api/imagenes/', '')}`, {
          method: 'DELETE',
          headers: { 'X-Tenant-Slug': tenantSlug(), Authorization: `Bearer ${token()}` },
        }).catch(() => {});
      }
      p.imagen_s3 = guardado.imagen_s3;
      setMsg(msg, `Imagen quitada de "${p.nombre}".`, true);
      render();
    } catch (err) {
      setMsg(msg, `No se pudo quitar: ${err.message}`);
      btn.disabled = false;
    }
  }

  async function crearProducto() {
    const body = {
      nombre: $('#np-nombre').value.trim(),
      slug: $('#np-slug').value.trim() || undefined,
      categoria: $('#np-categoria').value.trim() || undefined,
      imagen: nuevaImagen || undefined,
      precio: Number($('#np-precio').value),
      stock: Number($('#np-stock').value),
      disponible: $('#np-disponible').checked,
      descripcion: $('#np-desc').value,
      ingredientes: $('#np-ing').value,
    };
    if (!body.nombre) {
      setMsg(msg, 'El nombre es obligatorio.');
      return;
    }
    const btn = $('#producto-form button[type="submit"]');
    btn.disabled = true;
    try {
      const creado = await request('/api/admin/productos', { method: 'POST', body });
      $('#producto-form').reset();
      $('#np-disponible').checked = true;
      $('#nuevo-producto').removeAttribute('open');
      nuevaImagen = '';
      $('#np-img-preview').innerHTML = '<span class="img-none">Sin imagen</span>';
      $('#np-img-clear').hidden = true;
      productos.push(creado);
      setMsg(msg, `Producto "${creado.nombre}" creado.`, true);
      render();
    } catch (err) {
      setMsg(msg, `No se pudo crear: ${err.message}`);
      btn.disabled = false;
    }
  }

  async function cargarPedidos() {
    const data = await request('/api/admin/pedidos');
    pedidos = data.pedidos;
    renderPedidos();
    setMsg(pedidosMsg, `${pedidos.length} pedidos`, true);
  }

  function formatearFecha(iso) {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function renderPedidos() {
    if (pedidos.length === 0) {
      pedidosTbody.innerHTML = '<tr><td colspan="5">No hay pedidos en esta tienda.</td></tr>';
      return;
    }
    pedidosTbody.innerHTML = pedidos.map((o) => {
      const cliente = o.cliente || {};
      const productosTexto = o.items
        .map((it) => `${escapeHtml(it.nombre)} ×${it.cantidad}`)
        .join('<br>');
      return `
        <tr>
          <td>${escapeHtml(formatearFecha(o.created_at))}</td>
          <td>
            <div class="p-nombre">${escapeHtml(cliente.nombre || '—')}</div>
            <a href="mailto:${escapeHtml(cliente.email || '')}" class="p-email">${escapeHtml(cliente.email || '')}</a>
          </td>
          <td>${productosTexto}</td>
          <td><span class="estado estado-${escapeHtml(o.estado)}">${escapeHtml(o.estado)}</span></td>
          <td>${Number(o.total).toFixed(2)} €</td>
        </tr>`;
    }).join('');
  }

  async function cargarContactos() {
    const data = await request('/api/admin/contactos');
    contactos = data.contactos;
    renderContactos();
    setMsg(contactosMsg, `${contactos.length} consultas`, true);
  }

  function renderContactos() {
    if (contactos.length === 0) {
      contactosTbody.innerHTML = '<tr><td colspan="4">No hay consultas de contacto.</td></tr>';
      return;
    }
    contactosTbody.innerHTML = contactos.map((c) => `
      <tr>
        <td>${escapeHtml(formatearFecha(c.created_at))}</td>
        <td class="p-nombre">${escapeHtml(c.nombre)}</td>
        <td><a href="mailto:${escapeHtml(c.email)}" class="p-email">${escapeHtml(c.email)}</a></td>
        <td>${escapeHtml(c.mensaje)}</td>
      </tr>
    `).join('');
  }

  async function cargarContenido() {
    const data = await request('/api/admin/contenido');
    valoresContenido = Object.fromEntries(data.contenido.map((c) => [c.clave, c.valor]));
    renderContenido();
  }

  function renderContenido() {
    contenidoCampos.innerHTML = CAMPOS_CONTENIDO.map((campo) => {
      const valor = escapeHtml(valoresContenido[campo.clave] ?? '');
      const control = campo.multilinea
        ? `<textarea id="campo-${campo.clave}" rows="3">${valor}</textarea>`
        : `<input type="text" id="campo-${campo.clave}" value="${valor}">`;
      return `
        <label class="contenido-campo">
          <span>${campo.etiqueta}</span>
          ${control}
        </label>`;
    }).join('');
    setMsg(contenidoMsg, '', true);
  }

  async function guardarContenido() {
    const contenido = CAMPOS_CONTENIDO.map((campo) => ({
      clave: campo.clave,
      valor: $(`#campo-${campo.clave}`).value,
    }));
    const btn = $('#contenido-form button[type="submit"]');
    btn.disabled = true;
    try {
      await request('/api/admin/contenido', { method: 'PUT', body: { contenido } });
      setMsg(contenidoMsg, 'Contenido de la portada guardado.', true);
    } catch (err) {
      setMsg(contenidoMsg, `No se pudo guardar: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  }

  function initTabs() {
    document.querySelectorAll('.admin-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach((b) => b.classList.toggle('active', b === btn));
        const tab = btn.dataset.tab;
        $('#panel-productos').hidden = tab !== 'productos';
        $('#panel-pedidos').hidden = tab !== 'pedidos';
        $('#panel-contactos').hidden = tab !== 'contactos';
        $('#panel-contenido').hidden = tab !== 'contenido';
      });
    });
  }

  function mostrarLogin() {
    loginView.hidden = false;
    panel.hidden = true;
    tools.hidden = true;
    setMsg(loginMsg, '');
    $('#admin-password').focus();
  }

  function mostrarPanel() {
    loginView.hidden = true;
    panel.hidden = false;
    tools.hidden = false;
  }

  function init() {
    initTabs();

    $('#admin-login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#admin-login-form button[type="submit"]');
      const password = $('#admin-password').value;
      btn.disabled = true;
      try {
        await iniciarSesion(password);
        $('#admin-login-form').reset();
      } catch (err) {
        setMsg(loginMsg, err.message);
        btn.disabled = false;
      }
    });

    tenantSel.addEventListener('change', () => {
      localStorage.setItem(TENANT_KEY, tenantSel.value);
      recargarTodo().catch((err) => setMsg(msg, err.message));
    });

    $('#admin-refresh').addEventListener('click', () => {
      recargarTodo().catch((err) => setMsg(msg, err.message));
    });

    $('#contenido-form').addEventListener('submit', (e) => {
      e.preventDefault();
      guardarContenido();
    });

    $('#producto-form').addEventListener('submit', (e) => {
      e.preventDefault();
      crearProducto();
    });

    $('#np-img-btn').addEventListener('click', () => $('#np-file').click());
    $('#np-file').addEventListener('change', async () => {
      const file = $('#np-file').files[0];
      if (!file) return;
      const btn = $('#np-img-btn');
      btn.disabled = true;
      btn.textContent = 'Subiendo…';
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/admin/imagenes', {
          method: 'POST',
          headers: { 'X-Tenant-Slug': tenantSlug(), Authorization: `Bearer ${token()}` },
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        nuevaImagen = data.url;
        $('#np-img-preview').innerHTML = previewImagen(nuevaImagen);
        $('#np-img-clear').hidden = false;
      } catch (err) {
        setMsg(msg, `No se pudo subir la imagen: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Subir imagen';
        $('#np-file').value = '';
      }
    });
    $('#np-img-clear').addEventListener('click', () => {
      if (nuevaImagen.startsWith('/api/imagenes/')) {
        fetch(`/api/admin/imagenes/${nuevaImagen.replace('/api/imagenes/', '')}`, {
          method: 'DELETE',
          headers: { 'X-Tenant-Slug': tenantSlug(), Authorization: `Bearer ${token()}` },
        }).catch(() => {});
      }
      nuevaImagen = '';
      $('#np-img-preview').innerHTML = '<span class="img-none">Sin imagen</span>';
      $('#np-img-clear').hidden = true;
    });

    $('#admin-logout').addEventListener('click', () => {
      localStorage.removeItem(TOKEN_KEY);
      mostrarLogin();
    });

    if (token()) {
      mostrarPanel();
      cargarTenants()
        .then(() => recargarTodo())
        .catch((err) => {
          if (/401|No autorizado/.test(err.message)) {
            localStorage.removeItem(TOKEN_KEY);
            mostrarLogin();
          } else {
            setMsg(msg, err.message);
          }
        });
    } else {
      mostrarLogin();
    }
  }

  function recargarTodo() {
    return Promise.all([cargarProductos(), cargarContenido(), cargarPedidos(), cargarContactos()]);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
