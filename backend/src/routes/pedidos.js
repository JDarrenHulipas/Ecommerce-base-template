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
// Body: { cliente: { nombre, email }, items: [ { producto_id, cantidad, configuracion? } ] }
// Si un item lleva `configuracion` (tarta personalizada), el precio se calcula
// desde la tabla `opciones` (nunca se confía en el cliente) y se guarda el
// snapshot en pedido_items.configuracion.
// configuracion: { tamano, bizcocho, relleno, decoracion, extras: [opcion_id] }
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

    // Opciones del configurador: se cargan una sola vez para todos los items
    const opcionIds = [...new Set(
      items.flatMap((i) =>
        i.configuracion
          ? [i.configuracion.tamano, i.configuracion.bizcocho, i.configuracion.relleno,
             i.configuracion.decoracion, ...(i.configuracion.extras || [])]
          : []
      ).filter(Boolean)
    )];
    const opciones = new Map();
    if (opcionIds.length > 0) {
      const { rows } = await client.query(
        `SELECT id, grupo, nombre, precio FROM opciones WHERE id = ANY($1::bigint[])`,
        [opcionIds]
      );
      for (const r of rows) opciones.set(String(r.id), r);
    }

    const subtotal = items.reduce((sum, i) => {
      let unitario;
      let nombreLinea;

      if (i.configuracion) {
        const conf = i.configuracion;
        const pick = (id) => opciones.get(String(id));
        const t = pick(conf.tamano);
        const b = pick(conf.bizcocho);
        const r = pick(conf.relleno);
        const d = pick(conf.decoracion);
        const ex = (conf.extras || []).map(pick);

        if (!t || !b || !r || !d || ex.some((e) => !e)) {
          throw Object.assign(new Error('Configuración de tarta inválida'), { status: 400 });
        }

        unitario = Number(t.precio) + Number(b.precio) + Number(r.precio) + Number(d.precio) +
                   ex.reduce((s, e) => s + Number(e.precio), 0);
        nombreLinea = `Tarta: ${t.nombre} · ${b.nombre} · ${r.nombre} · ${d.nombre}` +
                      (ex.length ? ` + ${ex.map((e) => e.nombre).join(' + ')}` : '');
      } else {
        const prod = precios.get(String(i.producto_id));
        if (!prod) {
          throw Object.assign(new Error(`Producto ${i.producto_id} no existe`), { status: 400 });
        }
        unitario = prod.precio;
        nombreLinea = prod.nombre;
      }

      i._unitario = Number(unitario);
      i._nombre = nombreLinea;
      return sum + i._unitario * i.cantidad;
    }, 0);

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
      await client.query(
        `INSERT INTO pedido_items (tienda_id, pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, configuracion)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.tenant.id, pedidoId, item.producto_id, item._nombre, item.cantidad, item._unitario,
         item.configuracion ? JSON.stringify(item.configuracion) : null]
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
