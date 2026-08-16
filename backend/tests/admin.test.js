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
const fs = require('fs');
const path = require('path');

const app = require('../src/app');
const { databaseUrl, uploadDir } = require('../src/config/env');

const T = { koko: 'kokorocakes', maribel: 'dulces-maribel' };

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
  assert.ok('ingredientes' in tarta, 'el listado admin debe incluir ingredientes');
  assert.ok('imagen_s3' in tarta, 'el listado admin debe incluir imagen_s3');
});

test('admin: /tiendas lista las tiendas del sistema', async () => {
  const { status, body } = await api('/api/admin/tiendas', { auth: token });
  assert.equal(status, 200);
  assert.ok(body.tiendas.length >= 2, 'debe haber al menos 2 tiendas');
  assert.ok(body.tiendas.some((t) => t.slug === 'kokorocakes'));
});

test('admin: PATCH actualiza stock/precio/disponible y lo persiste', async () => {
  // Se usa un producto de maribel para no interferir con los tests de api.test.js,
  // que leen el precio de los productos de koko (los ficheros corren en paralelo).
  const lista = await api('/api/admin/productos', { tenant: T.maribel, auth: token });
  const prod = lista.body.productos[0];
  assert.ok(prod, 'producto de referencia no encontrado');

  const { status, body } = await api(`/api/admin/productos/${prod.id}`, {
    method: 'PATCH',
    tenant: T.maribel,
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
    await client.query('SELECT app.set_tenant(2)');
    const { rows } = await client.query('SELECT stock, precio FROM productos WHERE id = $1', [prod.id]);
    assert.equal(Number(rows[0].stock), Number(prod.stock) + 1);
    assert.equal(Number(rows[0].precio), Number(prod.precio) + 1);
  } finally {
    await client.end();
  }

  // Restaura los valores originales
  const rest = await api(`/api/admin/productos/${prod.id}`, {
    method: 'PATCH',
    tenant: T.maribel,
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
    { ingredientes: 123 },
    { imagen_s3: 123 },
    { imagen_s3: 'no-es-una-url' },
  ];
  for (const body of casos) {
    const { status } = await api(`/api/admin/productos/${id}`, { method: 'PATCH', auth: token, body });
    assert.equal(status, 400, `debería rechazar: ${JSON.stringify(body)}`);
  }
});

test('admin: PATCH actualiza los ingredientes de un producto', async () => {
  const lista = await api('/api/admin/productos', { auth: token });
  const prod = lista.body.productos.find((p) => p.slug === 'bento-chocograve');
  assert.ok(prod, 'producto de referencia no encontrado');

  const original = prod.ingredientes || '';
  const nuevos = 'Chocolate 70%, Nutella, pepitas, mantequilla, huevos';

  const { status, body } = await api(`/api/admin/productos/${prod.id}`, {
    method: 'PATCH',
    auth: token,
    body: { ingredientes: nuevos },
  });
  assert.equal(status, 200);
  assert.equal(body.ingredientes, nuevos);

  // Restaura los ingredientes originales
  const rest = await api(`/api/admin/productos/${prod.id}`, {
    method: 'PATCH',
    auth: token,
    body: { ingredientes: original },
  });
  assert.equal(rest.status, 200);
});

test('admin: PATCH actualiza la imagen (imagen_s3) y la persiste', async () => {
  const lista = await api('/api/admin/productos', { auth: token });
  const prod = lista.body.productos.find((p) => p.slug === 'bento-chocograve');
  assert.ok(prod, 'producto de referencia no encontrado');

  const original = prod.imagen_s3 || null;
  const nueva = `https://img.example.com/${Date.now()}.jpg`;

  const { status, body } = await api(`/api/admin/productos/${prod.id}`, {
    method: 'PATCH',
    auth: token,
    body: { imagen_s3: nueva },
  });
  assert.equal(status, 200);
  assert.equal(body.imagen_s3, nueva);

  // Verificación directa en BD y restauración
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('SELECT app.set_tenant(1)');
    const { rows } = await client.query('SELECT imagen_s3 FROM productos WHERE id = $1', [prod.id]);
    assert.equal(rows[0].imagen_s3, nueva);
  } finally {
    await client.end();
  }

  const rest = await api(`/api/admin/productos/${prod.id}`, {
    method: 'PATCH',
    auth: token,
    body: { imagen_s3: original },
  });
  assert.equal(rest.status, 200);
});

test('admin: PATCH puede borrar la imagen con una cadena vacía', async () => {
  const lista = await api('/api/admin/productos', { auth: token });
  const prod = lista.body.productos.find((p) => p.slug === 'bento-chocograve');
  assert.ok(prod, 'producto de referencia no encontrado');
  const original = prod.imagen_s3 || null;

  const { status, body } = await api(`/api/admin/productos/${prod.id}`, {
    method: 'PATCH',
    auth: token,
    body: { imagen_s3: '' },
  });
  assert.equal(status, 200);
  assert.equal(body.imagen_s3, null);

  const rest = await api(`/api/admin/productos/${prod.id}`, {
    method: 'PATCH',
    auth: token,
    body: { imagen_s3: original },
  });
  assert.equal(rest.status, 200);
});

test('admin: /contenido lista el contenido de la portada', async () => {
  const { status, body } = await api('/api/admin/contenido', { auth: token });
  assert.equal(status, 200);
  assert.equal(body.tienda, T.koko);
  assert.ok(Array.isArray(body.contenido) && body.contenido.length > 0);
  const titulo = body.contenido.find((c) => c.clave === 'hero_titulo');
  assert.ok(titulo, 'debe existir la clave hero_titulo');
  assert.ok(titulo.valor, 'hero_titulo no puede estar vacío');
});

test('admin: PUT /contenido guarda y persiste los textos', async () => {
  const { body: antes } = await api('/api/admin/contenido', { auth: token });
  const original = antes.contenido.find((c) => c.clave === 'announcement').valor;
  const nuevo = `Anuncio de prueba ${Date.now()}`;

  const { status } = await api('/api/admin/contenido', {
    method: 'PUT',
    auth: token,
    body: { contenido: [{ clave: 'announcement', valor: nuevo }] },
  });
  assert.equal(status, 200);

  const despues = await api('/api/admin/contenido', { auth: token });
  assert.equal(despues.body.contenido.find((c) => c.clave === 'announcement').valor, nuevo);

  // La tienda pública debe ver el cambio
  const publico = await api('/api/contenido');
  assert.equal(publico.body.contenido.announcement, nuevo);

  // Restaura el valor original
  const rest = await api('/api/admin/contenido', {
    method: 'PUT',
    auth: token,
    body: { contenido: [{ clave: 'announcement', valor: original }] },
  });
  assert.equal(rest.status, 200);
});

test('admin: PUT /contenido valida los datos', async () => {
  const casos = [
    { contenido: [] },
    {},
    { contenido: [{ clave: 'hero_titulo', valor: 42 }] },
    { contenido: [{ clave: '', valor: 'hola' }] },
  ];
  for (const body of casos) {
    const { status } = await api('/api/admin/contenido', { method: 'PUT', auth: token, body });
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

// ---------------------------------------------------------------------------
// POST / DELETE productos
// ---------------------------------------------------------------------------

test('admin: POST /productos crea un producto con slug y categoría automáticos', async () => {
  const nombre = `Tarta test ${Date.now()}`;
  const { status, body } = await api('/api/admin/productos', {
    method: 'POST',
    tenant: T.maribel,
    auth: token,
    body: {
      nombre,
      categoria: 'Nueva categoría test',
      precio: 19.9,
      stock: 4,
      descripcion: 'Producto creado por el test',
      ingredientes: 'Harina, azúcar, huevos',
      imagen: 'https://img.example.com/tarta-test.jpg',
    },
  });
  assert.equal(status, 201);
  assert.equal(body.nombre, nombre);
  assert.ok(body.id, 'debería devolver el id');
  assert.equal(Number(body.precio), 19.9);
  assert.equal(Number(body.stock), 4);
  assert.equal(body.imagen_s3, 'https://img.example.com/tarta-test.jpg');
  assert.match(body.slug, /^tarta-test-\d+$/, 'el slug se autogenera desde el nombre');

  // Aparece en el listado con su categoría
  const lista = await api('/api/admin/productos', { tenant: T.maribel, auth: token });
  const creado = lista.body.productos.find((p) => p.id === body.id);
  assert.ok(creado, 'el producto debería aparecer en el listado');
  assert.equal(creado.categoria, 'Nueva categoría test');

  // Es invisible para otra tienda (RLS)
  const koko = await api('/api/admin/productos', { tenant: T.koko, auth: token });
  assert.ok(!koko.body.productos.some((p) => p.id === body.id), 'otra tienda no debe ver el producto');

  // Limpieza
  const del = await api(`/api/admin/productos/${body.id}`, { method: 'DELETE', tenant: T.maribel, auth: token });
  assert.equal(del.status, 200);
});

test('admin: POST /productos valida los datos', async () => {
  const casos = [
    { nombre: '' },
    {},
    { nombre: 'X', precio: -1 },
    { nombre: 'X', stock: 1.5 },
    { nombre: 'X', disponible: 'si' },
    { nombre: 'X', imagen: 'no-es-una-url' },
  ];
  for (const body of casos) {
    const { status } = await api('/api/admin/productos', {
      method: 'POST',
      tenant: T.maribel,
      auth: token,
      body,
    });
    assert.equal(status, 400, `debería rechazar: ${JSON.stringify(body)}`);
  }
});

test('admin: DELETE /productos no puede borrar productos de otra tienda', async () => {
  const { status, body } = await api('/api/admin/productos', {
    method: 'POST',
    tenant: T.maribel,
    auth: token,
    body: { nombre: `Prueba aislamiento ${Date.now()}`, precio: 5, stock: 1 },
  });
  assert.equal(status, 201);

  // Intentar borrarlo con la tienda de koko: RLS lo oculta -> 404
  const cross = await api(`/api/admin/productos/${body.id}`, { method: 'DELETE', auth: token });
  assert.equal(cross.status, 404);

  const del = await api(`/api/admin/productos/${body.id}`, {
    method: 'DELETE',
    tenant: T.maribel,
    auth: token,
  });
  assert.equal(del.status, 200);
});

test('admin: DELETE /productos devuelve 409 si el producto tiene pedidos', async () => {
  // Crea un producto y un pedido que lo use
  const { body: prod } = await api('/api/admin/productos', {
    method: 'POST',
    tenant: T.maribel,
    auth: token,
    body: { nombre: `Tarta con pedido ${Date.now()}`, precio: 10, stock: 5 },
  });
  const email = `pedido-borrar-${Date.now()}@example.com`;
  const { body: pedido } = await api('/api/pedidos', {
    method: 'POST',
    tenant: T.maribel,
    body: {
      cliente: { nombre: 'Test Borrado', email },
      items: [{ producto_id: prod.id, cantidad: 1 }],
    },
  });
  assert.ok(pedido.pedido_id, 'debería crearse el pedido de referencia');

  const del = await api(`/api/admin/productos/${prod.id}`, {
    method: 'DELETE',
    tenant: T.maribel,
    auth: token,
  });
  assert.equal(del.status, 409);
  assert.match(del.body.error, /pedidos/i);

  // Limpieza: pedido (cascada de líneas) -> cliente -> producto
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('SELECT app.set_tenant(2)');
    await client.query('DELETE FROM pedidos WHERE id = $1', [pedido.pedido_id]);
    await client.query('DELETE FROM clientes WHERE email = $1', [email]);
    await client.query('DELETE FROM productos WHERE id = $1', [prod.id]);
  } finally {
    await client.end();
  }
});

test('admin: DELETE /productos inexistente devuelve 404', async () => {
  const { status } = await api('/api/admin/productos/999999', { method: 'DELETE', auth: token });
  assert.equal(status, 404);
});

// ---------------------------------------------------------------------------
// GET /api/admin/pedidos y /api/admin/contactos
// ---------------------------------------------------------------------------

test('admin: GET /pedidos lista los pedidos con cliente e items', async () => {
  // Se crea un pedido real vía la API pública de maribel
  const email = `admin-pedidos-${Date.now()}@example.com`;
  const { body: prodList } = await api('/api/admin/productos', { tenant: T.maribel, auth: token });
  const prod = prodList.productos.find((p) => p.slug === 'mantecado-canelas');
  assert.ok(prod, 'producto de referencia no encontrado');

  const { body: pedido } = await api('/api/pedidos', {
    method: 'POST',
    tenant: T.maribel,
    body: {
      cliente: { nombre: 'Cliente Admin', email },
      items: [{ producto_id: prod.id, cantidad: 2 }],
    },
  });
  assert.ok(pedido.pedido_id, 'debería crearse el pedido');

  const { status, body } = await api('/api/admin/pedidos', { tenant: T.maribel, auth: token });
  assert.equal(status, 200);
  assert.equal(body.tienda, T.maribel);
  const encontrado = body.pedidos.find((o) => o.id === pedido.pedido_id);
  assert.ok(encontrado, 'el pedido creado debería aparecer');
  assert.equal(encontrado.cliente.email, email);
  assert.equal(encontrado.estado, 'pendiente');
  assert.ok(Array.isArray(encontrado.items) && encontrado.items.length === 1);
  assert.equal(encontrado.items[0].nombre, prod.nombre);
  assert.equal(encontrado.items[0].cantidad, 2);
  assert.equal(Number(encontrado.total), Number(prod.precio) * 2 + Number(encontrado.envio));

  // Limpieza
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('SELECT app.set_tenant(2)');
    await client.query('DELETE FROM pedidos WHERE id = $1', [pedido.pedido_id]);
    await client.query('DELETE FROM clientes WHERE email = $1', [email]);
  } finally {
    await client.end();
  }
});

test('admin: GET /contactos lista las consultas de la tienda activa', async () => {
  const email = `admin-contactos-${Date.now()}@example.com`;
  const mensaje = 'Consulta de prueba para el panel admin';
  await api('/api/contactos', {
    method: 'POST',
    tenant: T.maribel,
    body: { nombre: 'Consulta Admin', email, mensaje },
  });

  const { status, body } = await api('/api/admin/contactos', { tenant: T.maribel, auth: token });
  assert.equal(status, 200);
  assert.equal(body.tienda, T.maribel);
  const encontrada = body.contactos.find((c) => c.email === email);
  assert.ok(encontrada, 'la consulta debería aparecer');
  assert.equal(encontrada.mensaje, mensaje);

  // Aislamiento: koko no la ve
  const koko = await api('/api/admin/contactos', { tenant: T.koko, auth: token });
  assert.ok(!koko.body.contactos.some((c) => c.email === email), 'koko no debe ver consultas de maribel');

  // Limpieza
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('SELECT app.set_tenant(2)');
    await client.query('DELETE FROM contactos WHERE email = $1', [email]);
  } finally {
    await client.end();
  }
});

// ---------------------------------------------------------------------------
// POST / DELETE /api/admin/imagenes (subida de imagen por botón)
// ---------------------------------------------------------------------------

test('admin: POST /imagenes sube la imagen y DELETE la borra', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const fd = new FormData();
  fd.append('file', new Blob([png], { type: 'image/png' }), 'prueba.png');

  const res = await fetch(baseURL + '/api/admin/imagenes', {
    method: 'POST',
    headers: { 'X-Tenant-Slug': T.koko, Authorization: `Bearer ${token}` },
    body: fd,
  });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.match(data.url, /^\/api\/imagenes\/\d+-[a-z0-9-]+\.png$/, 'URL relativa de la imagen');

  // El archivo existe en disco
  const nombre = data.url.replace('/api/imagenes/', '');
  const ruta = path.join(uploadDir, nombre);
  assert.ok(fs.existsSync(ruta), 'el archivo debería existir en uploadDir');

  // Se sirve por el endpoint público /api/imagenes
  const servida = await fetch(baseURL + data.url);
  assert.equal(servida.status, 200);

  // DELETE borra el archivo
  const del = await fetch(baseURL + `/api/admin/imagenes/${nombre}`, {
    method: 'DELETE',
    headers: { 'X-Tenant-Slug': T.koko, Authorization: `Bearer ${token}` },
  });
  assert.equal(del.status, 200);
  assert.ok(!fs.existsSync(ruta), 'el archivo debería haberse borrado');
});

test('admin: POST /imagenes rechaza archivos que no son imágenes', async () => {
  const fd = new FormData();
  fd.append('file', new Blob(['esto no es una imagen'], { type: 'text/plain' }), 'nota.txt');

  const res = await fetch(baseURL + '/api/admin/imagenes', {
    method: 'POST',
    headers: { 'X-Tenant-Slug': T.koko, Authorization: `Bearer ${token}` },
    body: fd,
  });
  assert.equal(res.status, 400);
  const data = await res.json().catch(() => ({}));
  assert.match(data.error, /imagen|solo se permiten/i);
});

test('admin: POST /imagenes exige autenticación', async () => {
  const fd = new FormData();
  fd.append('file', new Blob(['x'], { type: 'image/png' }), 'x.png');
  const res = await fetch(baseURL + '/api/admin/imagenes', {
    method: 'POST',
    headers: { 'X-Tenant-Slug': T.koko },
    body: fd,
  });
  assert.equal(res.status, 401);
});

test('admin: DELETE /imagenes de un archivo inexistente devuelve 404', async () => {
  const res = await fetch(baseURL + '/api/admin/imagenes/999999-no-existe.png', {
    method: 'DELETE',
    headers: { 'X-Tenant-Slug': T.koko, Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 404);
});
