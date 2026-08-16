const AdminApp = (() => {
  const TOKEN_KEY = 'bakery_admin_token';
  const TENANT_KEY = 'bakery_admin_tenant';

  const $ = (sel) => document.querySelector(sel);
  const loginView = $('#admin-login');
  const panel = $('#admin-panel');
  const tools = $('#admin-tools');
  const tenantSel = $('#admin-tenant');
  const tbody = $('#admin-tbody');
  const msg = $('#admin-msg');
  const loginMsg = $('#admin-login-msg');

  const escapeHtml = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

  let productos = [];

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
    await cargarProductos();
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
      tbody.innerHTML = '<tr><td colspan="6">No hay productos en esta tienda.</td></tr>';
      return;
    }
    tbody.innerHTML = productos.map((p, i) => `
      <tr data-id="${p.id}">
        <td>
          <div class="p-nombre">${escapeHtml(p.nombre)}</div>
          <input type="text" class="edit-nombre" value="${escapeHtml(p.nombre)}" aria-label="Nombre del producto">
          <input type="text" class="edit-desc" value="${escapeHtml(p.descripcion || '')}" aria-label="Descripción del producto">
        </td>
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
      cargarProductos().catch((err) => setMsg(msg, err.message));
    });

    $('#admin-refresh').addEventListener('click', () => {
      cargarProductos().catch((err) => setMsg(msg, err.message));
    });

    $('#admin-logout').addEventListener('click', () => {
      localStorage.removeItem(TOKEN_KEY);
      mostrarLogin();
    });

    if (token()) {
      mostrarPanel();
      cargarTenants()
        .then(() => cargarProductos())
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

  document.addEventListener('DOMContentLoaded', init);
})();
