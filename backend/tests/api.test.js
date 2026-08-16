// Tests de integración de la REST API de BakeryCloud.
//
// Ejecutar desde backend/:
//   node --test tests/
//
// Usa el runner nativo de Node (node:test) + fetch, sin dependencias.
// Requiere PostgreSQL local con esquema + seed aplicados (ver README).

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');

const app = require('../src/app');
const { databaseUrl } = require('../src/config/env');

const T = {
  koko: 'kokorocakes',
  maribel: 'dulces-maribel',
};

let server;
let baseURL;

async function api(path, { method = 'GET', tenant = T.koko, body } = {}) {
  const headers = { 'X-Tenant-Slug': tenant };
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

// ---------------------------------------------------------------------------
// GET /api/health
// ---------------------------------------------------------------------------

test('health: responde ok y expone la tienda por defecto', async () => {
  const { status, body } = await api('/api/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.tienda, T.koko);
});

test('health: cambia la tienda activa con X-Tenant-Slug', async () => {
  const { status, body } = await api('/api/health', { tenant: T.maribel });
  assert.equal(status, 200);
  assert.equal(body.tienda, T.maribel);
});

test('health: tienda inexistente devuelve 404', async () => {
  const { status, body } = await api('/api/health', { tenant: 'no-existe' });
  assert.equal(status, 404);
  assert.match(body.error, /no encontrada|inactiva/i);
});

// ---------------------------------------------------------------------------
// GET /api/productos
// ---------------------------------------------------------------------------

test('productos: lista los productos disponibles de la tienda activa', async () => {
  const { status, body } = await api('/api/productos');
  assert.equal(status, 200);
  assert.equal(body.tienda, T.koko);
  assert.ok(Array.isArray(body.productos));
  assert.ok(body.count > 0);
  assert.equal(body.productos.length, body.count);

  for (const p of body.productos) {
    assert.ok(p.id, 'producto sin id');
    assert.ok(p.slug, 'producto sin slug');
    assert.ok(p.nombre, 'producto sin nombre');
    assert.equal(p.disponible, true, `${p.slug} debería estar disponible`);
    assert.ok(typeof p.precio === 'string' || typeof p.precio === 'number');
  }
});

test('productos: cada tienda ve solo su catálogo (aislamiento por tenant)', async () => {
  const koko = await api('/api/productos');
  const maribel = await api('/api/productos', { tenant: T.maribel });

  assert.equal(koko.status, 200);
  assert.equal(maribel.status, 200);

  const slugsKoko = new Set(koko.body.productos.map((p) => p.slug));
  const slugsMaribel = new Set(maribel.body.productos.map((p) => p.slug));

  // Los catálogos no se solapan
  for (const slug of slugsMaribel) {
    assert.ok(!slugsKoko.has(slug), `'${slug}' filtrado mal entre tenants`);
  }

  // El catálogo de Maribel tiene al menos sus 2 productos del seed
  assert.ok(slugsMaribel.has('mantecado-canelas'));
  assert.ok(slugsMaribel.has('cake-embarazo'));
});

// ---------------------------------------------------------------------------
// GET /api/productos/:slug
// ---------------------------------------------------------------------------

test('productos/:slug: devuelve el detalle de un producto existente', async () => {
  const { status, body } = await api('/api/productos/bento-chocograve');
  assert.equal(status, 200);
  assert.equal(body.slug, 'bento-chocograve');
  assert.ok(body.nombre);
  assert.ok(body.descripcion);
  assert.ok(body.precio);
});

test('productos/:slug: producto inexistente devuelve 404', async () => {
  const { status } = await api('/api/productos/no-existe');
  assert.equal(status, 404);
});

test('productos/:slug: un producto de otra tienda no es visible (404)', async () => {
  // 'mantecado-canelas' existe solo en dulces-maribel
  const { status } = await api('/api/productos/mantecado-canelas');
  assert.equal(status, 404);
});

// ---------------------------------------------------------------------------
// GET /api/pedidos
// ---------------------------------------------------------------------------

test('pedidos: lista los pedidos de la tienda activa', async () => {
  const { status, body } = await api('/api/pedidos');
  assert.equal(status, 200);
  assert.equal(body.tienda, T.koko);
  assert.ok(Array.isArray(body.pedidos));
});

// ---------------------------------------------------------------------------
// POST /api/pedidos
// ---------------------------------------------------------------------------

test('pedidos: crea un pedido calculando precios desde la BD', async () => {
  // Producto real del catálogo de Kokoro Cakes
  const prod = (await api('/api/productos/bento-chocograve')).body;
  const cantidad = 2;
  const subtotalEsperado = Number(prod.precio) * cantidad;
  const envioEsperado = 2.0;
  const totalEsperado = subtotalEsperado + envioEsperado;

  const email = `test-${Date.now()}@example.com`;
  const { status, body } = await api('/api/pedidos', {
    method: 'POST',
    body: {
      cliente: { nombre: 'Test Suite', email },
      items: [{ producto_id: prod.id, cantidad }],
    },
  });

  assert.equal(status, 201);
  assert.ok(body.pedido_id);
  assert.equal(Number(body.subtotal), subtotalEsperado);
  assert.equal(Number(body.envio), envioEsperado);
  assert.equal(Number(body.total), totalEsperado);
  assert.equal(body.estado, 'pendiente');

  // Limpieza: borra el pedido de prueba (y sus líneas en cascada) y el cliente.
  // RLS obliga a fijar el tenant de la tienda antes de borrar.
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('SELECT app.set_tenant(1)');
    await client.query('DELETE FROM pedidos WHERE id = $1', [body.pedido_id]);
    await client.query('DELETE FROM clientes WHERE email = $1', [email]);
  } finally {
    await client.end();
  }
});

test('pedidos: rechaza pedido sin cliente o sin items', async () => {
  const casos = [
    { cliente: {}, items: [{ producto_id: 1, cantidad: 1 }] },
    { cliente: { email: 'x@example.com' }, items: [] },
    undefined, // sin body
  ];

  for (const body of casos) {
    const { status } = await api('/api/pedidos', { method: 'POST', body });
    assert.equal(status, 400, `debería rechazar: ${JSON.stringify(body)}`);
  }
});

test('pedidos: rechaza pedido con producto inexistente (rollback)', async () => {
  const { status, body } = await api('/api/pedidos', {
    method: 'POST',
    body: {
      cliente: { email: 'rollback@example.com' },
      items: [{ producto_id: 999999, cantidad: 1 }],
    },
  });

  assert.equal(status, 400);
  assert.match(body.error, /no existe/i);

  // El rollback no debe dejar pedidos huérfanos
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('SELECT app.set_tenant(1)');
    const { rows } = await client.query(
      'SELECT COUNT(*)::int AS n FROM pedidos WHERE cliente_id IN (SELECT id FROM clientes WHERE email = $1)',
      ['rollback@example.com']
    );
    assert.equal(rows[0].n, 0, 'rollback dejó pedidos sin limpiar');
  } finally {
    await client.end();
  }
});

test('pedidos: rechaza cantidad inválida (negativa, cero o ausente)', async () => {
  const prod = (await api('/api/productos/bento-chocograve')).body;
  const casos = [
    { cliente: { email: 'qty@example.com' }, items: [{ producto_id: prod.id, cantidad: -2 }] },
    { cliente: { email: 'qty@example.com' }, items: [{ producto_id: prod.id, cantidad: 0 }] },
    { cliente: { email: 'qty@example.com' }, items: [{ producto_id: prod.id, cantidad: 1.5 }] },
    { cliente: { email: 'qty@example.com' }, items: [{ producto_id: prod.id }] },
  ];

  for (const body of casos) {
    const { status } = await api('/api/pedidos', { method: 'POST', body });
    assert.equal(status, 400, `debería rechazar: ${JSON.stringify(body)}`);
  }
});

test('pedidos: rechaza configuración con opciones de grupo equivocado', async () => {
  const { body: opciones } = await api('/api/opciones');
  const g = opciones.grupos;
  const bizcochoId = g.bizcocho[0].id; // un bizcocho NO es un tamaño

  const { status, body } = await api('/api/pedidos', {
    method: 'POST',
    body: {
      cliente: { email: `grupo-${Date.now()}@example.com` },
      items: [{
        producto_id: opciones.tarta_base.id,
        cantidad: 1,
        configuracion: {
          tamano: bizcochoId,
          altura: g.altura[0].id,
          bizcocho: g.bizcocho[0].id,
          relleno: g.relleno[0].id,
          decoracion: g.decoracion[0].id,
          extras: [],
        },
      }],
    },
  });

  assert.equal(status, 400);
  assert.match(body.error, /grupo/i);
});

// ---------------------------------------------------------------------------
// POST /api/contactos
// ---------------------------------------------------------------------------

test('contactos: crea una consulta y aparece en el listado', async () => {
  const email = `contacto-${Date.now()}@example.com`;
  const { status, body } = await api('/api/contactos', {
    method: 'POST',
    body: { nombre: 'Cliente Test', email, mensaje: 'Quiero una tarta de cumpleaños para el sábado.' },
  });

  assert.equal(status, 201);
  assert.ok(body.id);
  assert.ok(body.creado);

  const listado = await api('/api/contactos');
  assert.equal(listado.status, 200);
  assert.equal(listado.body.tienda, T.koko);
  assert.ok(Array.isArray(listado.body.contactos));
  assert.ok(listado.body.contactos.some((c) => c.email === email), 'la consulta debería aparecer en el listado');

  // Limpieza: borra la consulta de prueba (con RLS activado para la tienda)
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('SELECT app.set_tenant(1)');
    await client.query('DELETE FROM contactos WHERE email = $1', [email]);
  } finally {
    await client.end();
  }
});

test('contactos: rechaza consultas sin nombre, email o mensaje', async () => {
  const casos = [
    { email: 'a@example.com', mensaje: 'hola' },              // sin nombre
    { nombre: 'Ana', mensaje: 'hola' },                       // sin email
    { nombre: 'Ana', email: 'a@example.com' },                // sin mensaje
    { nombre: 'Ana', email: 'email-malo', mensaje: 'hola' },  // email inválido
  ];

  for (const body of casos) {
    const { status } = await api('/api/contactos', { method: 'POST', body });
    assert.equal(status, 400, `debería rechazar: ${JSON.stringify(body)}`);
  }
});

test('contactos: aislamiento por tenant en el listado', async () => {
  const email = `contacto-aisla-${Date.now()}@example.com`;
  await api('/api/contactos', {
    method: 'POST',
    body: { nombre: 'Aislamiento', email, mensaje: 'Solo koko debe ver esta consulta.' },
  });

  const koko = await api('/api/contactos');
  const maribel = await api('/api/contactos', { tenant: T.maribel });

  assert.ok(koko.body.contactos.some((c) => c.email === email), 'koko debería ver su consulta');
  assert.ok(!maribel.body.contactos.some((c) => c.email === email), 'maribel no debería ver consultas de koko');

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('SELECT app.set_tenant(1)');
    await client.query('DELETE FROM contactos WHERE email = $1', [email]);
  } finally {
    await client.end();
  }
});
