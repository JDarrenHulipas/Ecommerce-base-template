// Tests E2E de navegador con Playwright + node:test.
//
// Ejecutar (requiere el servidor en :3000 y Chromium descargado):
//   node --test tests/e2e.test.js
//
// Si el servidor o el navegador no están disponibles, los tests se saltan
// con un mensaje claro (así `npm test` no rompe en máquinas sin setup E2E).

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { databaseUrl, adminPassword } = require('../src/config/env');

const BASE = 'http://localhost:3000';
const TENANT = 'kokorocakes';

let browser;
let ready = false;
let skipReason = '';
let elegido = null;

async function apiGet(path) {
  const res = await fetch(BASE + path, { headers: { 'X-Tenant-Slug': TENANT } });
  return res.json();
}

// Elige un producto "normal" (con stock y que no sea la tarta base)
async function elegirProducto() {
  const [{ productos }, { tarta_base }] = await Promise.all([
    apiGet('/api/productos'),
    apiGet('/api/opciones'),
  ]);
  const normal = productos.find(
    (p) => Number(p.id) !== Number(tarta_base.id) && Number(p.stock) > 0
  );
  return { normal, tarta_base };
}

async function limpiarDB(email, tipo) {
  const c = new Client({ connectionString: databaseUrl });
  await c.connect();
  try {
    await c.query('SELECT app.set_tenant(1)');
    if (tipo === 'pedido') {
      const { rows } = await c.query('SELECT id FROM clientes WHERE email = $1', [email]);
      const ids = rows.map((r) => r.id);
      if (ids.length > 0) {
        await c.query(
          'DELETE FROM pedido_items WHERE pedido_id IN (SELECT id FROM pedidos WHERE cliente_id = ANY($1))',
          [ids]
        );
        await c.query('DELETE FROM pedidos WHERE cliente_id = ANY($1)', [ids]);
        await c.query('DELETE FROM clientes WHERE id = ANY($1)', [ids]);
      }
    } else {
      await c.query('DELETE FROM contactos WHERE email = $1', [email]);
    }
  } finally {
    await c.end();
  }
}

async function nuevaPagina() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  return { context, page };
}

async function comprobarDisponibilidad() {
  try {
    const res = await fetch(BASE + '/api/health', { headers: { 'X-Tenant-Slug': TENANT } });
    if (res.status !== 200) {
      skipReason = `Servidor en ${BASE} no responde OK (status ${res.status})`;
      return false;
    }
  } catch {
    skipReason = `Servidor no accesible en ${BASE}. Arranca ` + '`npm start` en backend/ antes de ejecutar los tests E2E.';
    return false;
  }
  try {
    browser = await require('playwright').chromium.launch({ headless: true });
  } catch (err) {
    skipReason = `Chromium no disponible: ${err.message.split('\n')[0]}. Ejecuta ` +
      '`npx playwright install chromium` en backend/.';
    return false;
  }
  return true;
}

before(async () => {
  ready = await comprobarDisponibilidad();
  if (ready) {
    elegido = await elegirProducto();
  }
});

after(async () => {
  if (browser) await browser.close();
});

test('E2E: la página carga y muestra el catálogo', { timeout: 120000 }, async (t) => {
  if (!ready) { t.skip(skipReason); return; }
  const { context, page } = await nuevaPagina();
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#grid-productos .card');
    assert.equal(await page.title(), 'Kokoro Cakes — Pasteles personalizados en Barcelona');
    assert.ok(await page.isVisible('.hero'));
    const cards = await page.locator('#grid-productos .card').count();
    assert.ok(cards >= 3, `se esperaban al menos 3 tarjetas, hay ${cards}`);
  } finally {
    await context.close();
  }
});

test('E2E: en móvil el logo Kokoro Cakes abre un menú lateral que se desliza por la izquierda', { timeout: 120000 }, async (t) => {
  if (!ready) { t.skip(skipReason); return; }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#grid-productos .card');

    assert.ok(await page.isVisible('#nav-trigger'), 'el logo debe ser visible en móvil');
    assert.equal(await page.locator('#nav-toggle').count(), 0, 'no debe haber botón hamburguesa');
    assert.equal(await page.locator('#nav-menu.open').count(), 0, 'el menú debe estar cerrado al inicio');

    await page.click('#nav-trigger');
    await page.waitForSelector('#nav-menu.open');
    await page.waitForFunction(() => {
      const box = document.querySelector('#nav-menu').getBoundingClientRect();
      return box.x >= 0;
    });
    assert.equal(await page.locator('#nav-menu .nav-link').count(), 3);
    assert.equal(await page.locator('#nav-menu a[href="#productos"]').count(), 1);
    assert.equal(await page.locator('#nav-menu a[href="#nosotros"]').count(), 1);
    assert.equal(await page.locator('#nav-menu a[href="#contacto"]').count(), 1);
    assert.equal(await page.locator('#nav-menu #cart-btn').count(), 0, 'el carrito no debe estar dentro del menú');

    const box = await page.locator('#nav-menu').boundingBox();
    assert.ok(box && Math.abs(box.x) < 2, `el menú debe pegarse al borde izquierdo (x=${box && box.x})`);
    assert.ok(await page.isVisible('#menu-overlay.open'), 'debe aparecer el fondo oscuro');

    await page.click('#menu-close');
    assert.equal(await page.locator('#nav-menu.open').count(), 0, 'el menú se cierra con el botón ×');

    await page.click('#nav-trigger');
    await page.waitForSelector('#nav-menu.open');
    await page.click('#nav-menu a[href="#productos"]');
    assert.equal(await page.locator('#nav-menu.open').count(), 0, 'el menú se cierra al elegir una sección');
  } finally {
    await context.close();
  }
});

test('E2E: en móvil el header se encoge y se oculta al bajar, y reaparece al subir', { timeout: 120000 }, async (t) => {
  if (!ready) { t.skip(skipReason); return; }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#grid-productos .card');

    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForSelector('.header.hide');
    await page.waitForFunction(() =>
      document.querySelector('.header').classList.contains('shrink')
    );

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(() => {
      const h = document.querySelector('.header');
      return !h.classList.contains('hide');
    });
    assert.ok(await page.isVisible('#nav-trigger'), 'el logo debe reaparecer al subir');
  } finally {
    await context.close();
  }
});

test('E2E: añadir producto al carrito abre el drawer y actualiza el contador', { timeout: 120000 }, async (t) => {
  if (!ready) { t.skip(skipReason); return; }
  const { context, page } = await nuevaPagina();
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#grid-productos .card');
    const id = elegido.normal.id;
    await page.click(`.btn-add[data-id="${id}"]`);
    await page.waitForSelector('#drawer.open');
    await page.waitForFunction(
      () => document.querySelector('#cart-count')?.textContent === '1'
    );
    const name = await page.locator('.drawer-item .di-name').first().textContent();
    assert.equal(name, elegido.normal.nombre);
  } finally {
    await context.close();
  }
});

test('E2E: ajustar cantidades y eliminar ítem del carrito', { timeout: 120000 }, async (t) => {
  if (!ready) { t.skip(skipReason); return; }
  const { context, page } = await nuevaPagina();
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#grid-productos .card');
    const id = elegido.normal.id;
    await page.click(`.btn-add[data-id="${id}"]`);
    await page.waitForSelector('#drawer.open');

    await page.click('.drawer-item [data-action="incr"]');
    await page.waitForFunction(() => document.querySelector('#cart-count')?.textContent === '2');
    assert.equal(await page.locator('.drawer-item .qty').first().textContent(), '2');

    await page.click('.drawer-item [data-action="decr"]');
    await page.waitForFunction(() => document.querySelector('#cart-count')?.textContent === '1');
    assert.equal(await page.locator('.drawer-item .qty').first().textContent(), '1');

    await page.click('.drawer-item [data-action="remove"]');
    await page.waitForSelector('.drawer-empty');
    await page.waitForFunction(() => document.querySelector('#cart-count')?.textContent === '0');
  } finally {
    await context.close();
  }
});

test('E2E: el carrito persiste tras recargar la página', { timeout: 120000 }, async (t) => {
  if (!ready) { t.skip(skipReason); return; }
  const { context, page } = await nuevaPagina();
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#grid-productos .card');
    const id = elegido.normal.id;
    await page.click(`.btn-add[data-id="${id}"]`);
    await page.waitForFunction(() => document.querySelector('#cart-count')?.textContent === '1');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#grid-productos .card');
    await page.waitForFunction(() => document.querySelector('#cart-count')?.textContent === '1');

    await page.click('#cart-btn');
    await page.waitForSelector('#drawer.open');
    assert.equal(await page.locator('.drawer-item .di-name').first().textContent(), elegido.normal.nombre);
  } finally {
    await context.close();
  }
});

test('E2E: el modal de detalle muestra la información del producto', { timeout: 120000 }, async (t) => {
  if (!ready) { t.skip(skipReason); return; }
  const { context, page } = await nuevaPagina();
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#grid-productos .card');
    const id = elegido.normal.id;
    await page.click(`.card:has(.btn-add[data-id="${id}"]) .card-name`);
    await page.waitForSelector('#producto-modal.open');
    assert.equal(await page.locator('#modal-name').textContent(), elegido.normal.nombre);
    await page.click('#modal-close');
    await page.waitForFunction(() => !document.querySelector('#producto-modal').classList.contains('open'));
  } finally {
    await context.close();
  }
});

test('E2E: el configurador completa una tarta personalizada y la añade al carrito', { timeout: 120000 }, async (t) => {
  if (!ready) { t.skip(skipReason); return; }
  const { context, page } = await nuevaPagina();
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#grid-productos .card');
    const id = elegido.tarta_base.id;
    await page.click(`.btn-add[data-id="${id}"]`);
    await page.waitForSelector('#config-modal.open');

    const pasos = 5; // tamano, altura, bizcocho, relleno, decoracion
    for (let i = 0; i < pasos; i++) {
      await page.click('.config-option >> nth=0');
      await page.click('#config-next');
    }
    // Último paso: extras (opcional) + añadir al carrito
    await page.click('.config-option >> nth=0');
    await page.click('#config-add');

    await page.waitForSelector('#drawer.open');
    await page.waitForSelector('.drawer-item');
    const name = await page.locator('.drawer-item .di-name').first().textContent();
    assert.ok(name.startsWith('Tarta personalizada'), `nombre inesperado: ${name}`);
  } finally {
    await context.close();
  }
});

test('E2E: checkout confirma el pedido y limpia el carrito', { timeout: 120000 }, async (t) => {
  if (!ready) { t.skip(skipReason); return; }
  const { context, page } = await nuevaPagina();
  const email = `e2e-pedido-${Date.now()}@test.local`;
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#grid-productos .card');
    const id = elegido.normal.id;
    await page.click(`.btn-add[data-id="${id}"]`);
    await page.waitForSelector('#drawer.open');

    await page.click('#btn-checkout');
    await page.fill('#checkout-nombre', 'E2E Checkout');
    await page.fill('#checkout-email', email);
    await page.click('#checkout-form button[type="submit"]');

    await page.waitForSelector('#drawer-msg:not(:empty)');
    const msg = await page.locator('#drawer-msg').textContent();
    assert.ok(msg.includes('confirmado'), `mensaje inesperado: ${msg}`);

    // El carrito queda vacío tras confirmar
    await page.waitForFunction(() => document.querySelector('#cart-count')?.textContent === '0');
  } finally {
    await context.close();
    await limpiarDB(email, 'pedido');
  }
});

test('E2E: el formulario de contacto envía la consulta', { timeout: 120000 }, async (t) => {
  if (!ready) { t.skip(skipReason); return; }
  const { context, page } = await nuevaPagina();
  const email = `e2e-contacto-${Date.now()}@test.local`;
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#contact-form');
    await page.fill('#contact-nombre', 'E2E Contacto');
    await page.fill('#contact-email', email);
    await page.fill('#contact-mensaje', '¿Hacéis tartas veganas?');
    await page.click('#contact-submit');
    await page.waitForSelector('#toast-container .toast.success');
    const toast = await page.locator('#toast-container .toast.success .toast-body').first().textContent();
    assert.ok(toast.includes('Consulta enviada'), `toast inesperado: ${toast}`);
  } finally {
    await context.close();
    await limpiarDB(email, 'contacto');
  }
});

test('E2E: el panel admin permite editar el stock de un producto', { timeout: 120000 }, async (t) => {
  if (!ready) { t.skip(skipReason); return; }
  if (!adminPassword) { t.skip('ADMIN_PASSWORD no configurado en .env'); return; }

  const { context, page } = await nuevaPagina();
  try {
    await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#admin-login-form');
    await page.fill('#admin-password', adminPassword);
    await page.click('#admin-login-form button[type="submit"]');

    await page.waitForSelector('#admin-panel:not([hidden])');
    await page.waitForSelector('#admin-tbody tr[data-id]');

    const row = page.locator('#admin-tbody tr').first();
    const id = await row.getAttribute('data-id');
    const stockInput = row.locator('.edit-stock');
    const original = Number(await stockInput.inputValue());
    const nuevo = original + 1;

    await stockInput.fill(String(nuevo));
    await row.locator('.save-btn').click();
    await page.waitForFunction(() =>
      /Guardado/.test(document.querySelector('#admin-msg')?.textContent || '')
    );
    const msg = await page.locator('#admin-msg').textContent();
    assert.ok(msg.includes(String(nuevo)), `mensaje sin stock nuevo: ${msg}`);

    // Restaura el stock original vía API para no ensuciar la BD
    const token = await page.evaluate(() => localStorage.getItem('bakery_admin_token'));
    const restore = await fetch(BASE + `/api/admin/productos/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Slug': TENANT,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ stock: original }),
    });
    assert.equal(restore.status, 200, 'debería restaurar el stock original');
  } finally {
    await context.close();
  }
});

test('E2E: el panel admin edita el contenido de la portada y se refleja en la tienda', { timeout: 120000 }, async (t) => {
  if (!ready) { t.skip(skipReason); return; }
  if (!adminPassword) { t.skip('ADMIN_PASSWORD no configurado en .env'); return; }

  const { context, page } = await nuevaPagina();
  const nuevo = `Encargos con 48h (test ${Date.now()})`;
  try {
    // Cargar el valor original para restaurarlo al final
    const res = await fetch(BASE + '/api/contenido', { headers: { 'X-Tenant-Slug': TENANT } });
    const original = (await res.json()).contenido.announcement;

    await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
    await page.fill('#admin-password', adminPassword);
    await page.click('#admin-login-form button[type="submit"]');
    await page.waitForSelector('#admin-panel:not([hidden])');

    await page.click('.admin-tab[data-tab="contenido"]');
    await page.waitForSelector('#campo-announcement');
    await page.fill('#campo-announcement', nuevo);
    await page.click('#contenido-form button[type="submit"]');
    await page.waitForFunction(() =>
      document.querySelector('#contenido-msg')?.textContent.includes('guardado')
    );

    // La portada debe mostrar el nuevo anuncio
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      (esperado) => document.querySelector('#contenido-announcement')?.textContent === esperado,
      nuevo
    );

    // Restaura el valor original vía API
    const token = await page.evaluate(() => localStorage.getItem('bakery_admin_token'));
    const restore = await fetch(BASE + '/api/admin/contenido', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Slug': TENANT,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ contenido: [{ clave: 'announcement', valor: original }] }),
    });
    assert.equal(restore.status, 200, 'debería restaurar el anuncio original');
  } finally {
    await context.close();
  }
});

test('E2E: el panel admin cambia el estado de un pedido', { timeout: 120000 }, async (t) => {
  if (!ready) { t.skip(skipReason); return; }
  if (!adminPassword) { t.skip('ADMIN_PASSWORD no configurado en .env'); return; }

  // Crea un pedido real vía la API pública
  const email = `e2e-estado-${Date.now()}@test.local`;
  const { productos } = await apiGet('/api/productos');
  const prod = productos[0];
  assert.ok(prod, 'debería haber productos');
  const res = await fetch(BASE + '/api/pedidos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': TENANT },
    body: JSON.stringify({
      cliente: { nombre: 'E2E Estado', email },
      items: [{ producto_id: prod.id, cantidad: 1 }],
    }),
  });
  const pedido = await res.json();
  assert.ok(pedido.pedido_id, 'debería crearse el pedido');

  const { context, page } = await nuevaPagina();
  try {
    await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
    await page.fill('#admin-password', adminPassword);
    await page.click('#admin-login-form button[type="submit"]');
    await page.waitForSelector('#admin-panel:not([hidden])');

    await page.click('.admin-tab[data-tab="pedidos"]');
    const row = page.locator(`#pedidos-tbody tr:has(.p-email:text-is("${email}"))`);
    await row.waitFor();

    await row.locator('.estado-select').selectOption('entregado');
    await page.waitForFunction(
      (id) => document.querySelector('#pedidos-msg')?.textContent.includes(`#${id}`),
      pedido.pedido_id
    );
    const msg = await page.locator('#pedidos-msg').textContent();
    assert.ok(msg.includes('entregado'), `mensaje sin estado nuevo: ${msg}`);

    // El estado queda persistido vía API
    const token = await page.evaluate(() => localStorage.getItem('bakery_admin_token'));
    const list = await fetch(BASE + '/api/admin/pedidos', {
      headers: { 'X-Tenant-Slug': TENANT, Authorization: `Bearer ${token}` },
    });
    const data = await list.json();
    const guardado = data.pedidos.find((o) => o.id === pedido.pedido_id);
    assert.equal(guardado.estado, 'entregado');
  } finally {
    await context.close();
    await limpiarDB(email, 'pedido');
  }
});

test('E2E: el panel admin crea un producto nuevo con imagen subida', { timeout: 120000 }, async (t) => {
  if (!ready) { t.skip(skipReason); return; }
  if (!adminPassword) { t.skip('ADMIN_PASSWORD no configurado en .env'); return; }

  const { context, page } = await nuevaPagina();
  const nombre = `E2E Producto ${Date.now()}`;
  const archivo = path.join(os.tmpdir(), `e2e-img-${Date.now()}.png`);
  fs.writeFileSync(
    archivo,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    )
  );
  try {
    await page.goto(BASE + '/admin/', { waitUntil: 'domcontentloaded' });
    await page.fill('#admin-password', adminPassword);
    await page.click('#admin-login-form button[type="submit"]');
    await page.waitForSelector('#admin-panel:not([hidden])');

    await page.click('#nuevo-producto summary');
    await page.fill('#np-nombre', nombre);
    await page.fill('#np-precio', '12.5');
    await page.fill('#np-stock', '3');
    await page.fill('#np-categoria', 'Tartas E2E');
    // Subir imagen por botón (no URL): aparece el preview antes de crear
    await page.setInputFiles('#np-file', archivo);
    await page.waitForSelector('#np-img-preview img');

    await page.click('#producto-form button[type="submit"]');

    await page.waitForFunction(
      (valor) => /creado/.test(document.querySelector('#admin-msg')?.textContent || '') && document.querySelector('#admin-msg').textContent.includes(valor),
      nombre
    );

    // El producto aparece en la tabla con su imagen
    const row = page.locator(`#admin-tbody tr:has(.p-nombre:text-is("${nombre}"))`);
    await row.waitFor();
    const id = await row.getAttribute('data-id');
    assert.ok(id, 'el producto creado debería tener id');
    const imgSrc = await row.locator('.img-preview img').getAttribute('src');
    assert.ok(imgSrc && imgSrc.startsWith('/api/imagenes/'), `imagen esperada en /api/imagenes/, se obtuvo: ${imgSrc}`);

    // Limpieza vía API: producto y archivo subido
    const token = await page.evaluate(() => localStorage.getItem('bakery_admin_token'));
    const del = await fetch(BASE + `/api/admin/productos/${id}`, {
      method: 'DELETE',
      headers: { 'X-Tenant-Slug': TENANT, Authorization: `Bearer ${token}` },
    });
    assert.equal(del.status, 200, 'debería eliminarse el producto de prueba');
    const arch = await fetch(BASE + `/api/admin/imagenes/${imgSrc.replace('/api/imagenes/', '')}`, {
      method: 'DELETE',
      headers: { 'X-Tenant-Slug': TENANT, Authorization: `Bearer ${token}` },
    });
    assert.equal(arch.status, 200, 'debería borrarse el archivo de la imagen');
  } finally {
    await context.close();
    fs.rmSync(archivo, { force: true });
  }
});
