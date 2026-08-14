const { Router } = require('express');

const router = Router();

// GET /api/pedidos  -> pedidos de la tienda activa con sus líneas
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await req.db.query(
      `SELECT id, estado, subtotal, envio, total, created_at
         FROM pedidos
        ORDER BY created_at DESC`
    );
    res.json({ tienda: req.tenant.slug, count: rows.length, pedidos: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/pedidos  -> crea un pedido con sus líneas (transaccional)
// Body: { cliente: { nombre, email }, items: [ { producto_id, cantidad } ] }
router.post('/', async (req, res, next) => {
  const client = req.db;
  try {
    const { cliente, items } = req.body || {};

    if (!cliente || !cliente.email || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Se requieren cliente.email e items[]' });
    }

    await client.query('BEGIN');

    // Alta/recuperación del cliente de la tienda activa
    const cli = await client.query(
      `INSERT INTO clientes (tienda_id, email, nombre, telefono)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tienda_id, email) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING id`,
      [req.tenant.id, cliente.email, cliente.nombre || null, cliente.telefono || null]
    );
    const clienteId = cli.rows[0].id;

    // Precios actuales de los productos (desde la BD, no confiar en el cliente)
    const productoIds = items.map((i) => i.producto_id);
    const prods = await client.query(
      `SELECT id, nombre, precio FROM productos WHERE id = ANY($1::bigint[])`,
      [productoIds]
    );
    const precios = new Map(prods.rows.map((p) => [String(p.id), p]));

    const subtotal = items.reduce(
      (sum, i) => sum + (precios.get(String(i.producto_id))?.precio ?? 0) * i.cantidad,
      0
    );
    const envio = subtotal > 0 ? 2.0 : 0;
    const total = subtotal + envio;

    const ped = await client.query(
      `INSERT INTO pedidos (tienda_id, cliente_id, estado, subtotal, envio, total)
       VALUES ($1, $2, 'pendiente', $3, $4, $5)
       RETURNING id`,
      [req.tenant.id, clienteId, subtotal, envio, total]
    );
    const pedidoId = ped.rows[0].id;

    for (const item of items) {
      // producto_id llega como número del JSON; normalizamos a string
      // porque pg devuelve BIGINT como texto (evita pérdida de precisión)
      const prod = precios.get(String(item.producto_id));
      if (!prod) {
        throw Object.assign(new Error(`Producto ${item.producto_id} no existe`), { status: 400 });
      }
      await client.query(
        `INSERT INTO pedido_items (tienda_id, pedido_id, producto_id, nombre_producto, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.tenant.id, pedidoId, item.producto_id, prod.nombre, item.cantidad, prod.precio]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ pedido_id: pedidoId, subtotal, envio, total, estado: 'pendiente' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  }
});

module.exports = router;
