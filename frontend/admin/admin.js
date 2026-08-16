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

  const escapeHtml = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

  let productos = [];
  let valoresContenido = {};

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
      tbody.innerHTML = '<tr><td colspan="7">No hay productos en esta tienda.</td></tr>';
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
        <td><input type="number" class="edit-precio" step="0.01" min="0" value="${p.precio}" aria-label="Precio"></td>
        <td><input type="number" class="edit-stock" step="1" min="0" value="${p.stock}" aria-label="Stock"></td>
        <td><input type="checkbox" class="edit-disp" ${p.disponible ? 'checked' : ''} aria-label="Disponible"></td>
        <td><button type="button" class="save-btn" data-i="${i}">Guardar</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.save-btn').forEach((btn) => {
      btn.addEventListener('click', () => guardarFila(btn));
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
      if (guardado.disponible) p.stock = guardado.stock;
      setMsg(msg, `Guardado: ${guardado.nombre} (stock ${guardado.stock}, precio ${guardado.precio} €).`, true);
      render();
    } catch (err) {
      setMsg(msg, `No se pudo guardar: ${err.message}`);
      btn.disabled = false;
    }
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
    return Promise.all([cargarProductos(), cargarContenido()]);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
