// Tests de integración del panel admin (/api/admin).
//
// Ejecutar desde backend/:
//   node --test tests/admin.test.js
//
// Requiere ADMIN_PASSWORD y ADMIN_SECRET en .env (si faltan, las rutas
// responden 503 y los tests de login fallan).

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');

const app = require('../src/app');
const { databaseUrl } = require('../src/config/env');

const T = { koko: 'kokorocakes' };

let server;
let baseURL;
let token;

async function api(path, { method = 'GET', tenant = T.koko, body, auth } = {}) {
  const headers = { 'X-Tenant-Slug': tenant };
  if (auth) headers.Authorization = `Bearer ${auth}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(baseURL + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
});

test('admin: el login rechaza una contraseña incorrecta', async () => {
  const { status, body } = await api('/api/admin/login', { method: 'POST', body: { password: 'incorrecta' } });
  assert.equal(status, 401);
  assert.match(body.error, /inválidas|no autorizado/i);
});

test('admin: el login rechaza peticiones sin contraseña', async () => {
  const { status } = await api('/api/admin/login', { method: 'POST', body: {} });
  assert.equal(status, 400);
});

test('admin: el login devuelve un token con la contraseña correcta', async () => {
  const { adminPassword } = require('../src/config/env');
  const { status, body } = await api('/api/admin/login', { method: 'POST', body: { password: adminPassword } });
  assert.equal(status, 200);
  assert.ok(body.token, 'debería devolver un token');
  assert.match(body.token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  token = body.token;
});

test('admin: /productos exige autenticación', async () => {
  const { status } = await api('/api/admin/productos');
  assert.equal(status, 401);
});

test('admin: /productos lista el catálogo completo (incluye no disponibles)', async () => {
  const { status, body } = await api('/api/admin/productos', { auth: token });
  assert.equal(status, 200);
  assert.equal(body.tienda, T.koko);
  assert.ok(Array.isArray(body.productos) && body.productos.length > 0);
  const tarta = body.productos.find((p) => p.slug === 'tarta-encargo');
  assert.ok(tarta, 'la tarta base debe estar en el listado admin');
  assert.ok('stock' in tarta && 'disponible' in tarta);
});

test('admin: /tiendas lista las tiendas del sistema', async () => {
  const { status, body } = await api('/api/admin/tiendas', { auth: token });
  assert.equal(status, 200);
  assert.ok(body.tiendas.length >= 2, 'debe haber al menos 2 tiendas');
  assert.ok(body.tiendas.some((t) => t.slug === 'kokorocakes'));
});

test('admin: PATCH actualiza stock/precio/disponible y lo persiste', async () => {
  const lista = await api('/api/admin/productos', { auth: token });
  const prod = lista.body.productos.find((p) => p.slug === 'bento-chocograve');
  assert.ok(prod, 'producto de referencia no encontrado');

  const { status, body } = await api(`/api/admin/productos/${prod.id}`, {
    method: 'PATCH',
    auth: token,
    body: { stock: prod.stock + 1, precio: Number(prod.precio) + 1, disponible: true },
  });
  assert.equal(status, 200);
  assert.equal(Number(body.stock), Number(prod.stock) + 1);
  assert.equal(Number(body.precio), Number(prod.precio) + 1);

  // Verificación directa en BD (con RLS de la tienda)
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('SELECT app.set_tenant(1)');
    const { rows } = await client.query('SELECT stock, precio FROM productos WHERE id = $1', [prod.id]);
    assert.equal(Number(rows[0].stock), Number(prod.stock) + 1);
    assert.equal(Number(rows[0].precio), Number(prod.precio) + 1);
  } finally {
    await client.end();
  }

  // Restaura los valores originales
  const rest = await api(`/api/admin/productos/${prod.id}`, {
    method: 'PATCH',
    auth: token,
    body: { stock: prod.stock, precio: Number(prod.precio) },
  });
  assert.equal(rest.status, 200);
});

test('admin: PATCH valida stock, precio y disponible', async () => {
  const lista = await api('/api/admin/productos', { auth: token });
  const id = lista.body.productos[0].id;

  const casos = [
    { stock: -1 },
    { stock: 1.5 },
    { precio: -2 },
    { precio: 'abc' },
    { disponible: 'si' },
  ];
  for (const body of casos) {
    const { status } = await api(`/api/admin/productos/${id}`, { method: 'PATCH', auth: token, body });
    assert.equal(status, 400, `debería rechazar: ${JSON.stringify(body)}`);
  }
});

test('admin: PATCH de un producto inexistente devuelve 404', async () => {
  const { status } = await api('/api/admin/productos/999999', { method: 'PATCH', auth: token, body: { stock: 5 } });
  assert.equal(status, 404);
});

test('admin: PATCH no puede tocar productos de otra tienda', async () => {
  const koko = await api('/api/admin/productos', { auth: token });
  const id = koko.body.productos[0].id;

  // Intenta actualizar el producto de koko con la tienda de maribel: RLS lo oculta
  const { status } = await api(`/api/admin/productos/${id}`, {
    method: 'PATCH',
    tenant: 'dulces-maribel',
    auth: token,
    body: { stock: 999 },
  });
  assert.equal(status, 404, 'un producto de otra tienda debe ser invisible');
});
