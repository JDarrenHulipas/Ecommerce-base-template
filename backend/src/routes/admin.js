const { Router } = require('express');
const crypto = require('crypto');
const { adminPassword, adminSecret } = require('../config/env');
const { firmarToken, adminAuth } = require('../middleware/adminAuth');

const router = Router();

// POST /api/admin/login  -> { password } => { token }
router.post('/login', (req, res) => {
  if (!adminPassword || !adminSecret) {
    return res.status(503).json({ error: 'Panel admin no configurado (falta ADMIN_PASSWORD / ADMIN_SECRET)' });
  }
  const { password } = req.body || {};
  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Falta la contraseña' });
  }
  const a = Buffer.from(password);
  const b = Buffer.from(adminPassword);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  res.json({ token: firmarToken() });
});

// El resto de rutas admin exigen token Bearer
router.use(adminAuth);

// GET /api/admin/tiendas -> lista las tiendas (multi-tenant)
router.get('/tiendas', async (req, res, next) => {
  try {
    const { rows } = await req.db.query(
      'SELECT id, slug, nombre, estado FROM tiendas ORDER BY id'
    );
    res.json({ tiendas: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/productos -> productos de la tienda activa (incluye no disponibles)
router.get('/productos', async (req, res, next) => {
  try {
    const { rows } = await req.db.query(
      `SELECT p.id, p.slug, p.nombre, p.descripcion, p.ingredientes, p.precio, p.imagen_s3, p.stock, p.disponible,
              c.nombre AS categoria
         FROM productos p
         LEFT JOIN categorias c ON c.tienda_id = p.tienda_id AND c.id = p.categoria_id
        ORDER BY c.posicion, p.nombre`
    );
    res.json({ tienda: req.tenant.slug, productos: rows });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/productos/:id -> actualiza stock / precio / disponible / nombre / descripcion / ingredientes
router.patch('/productos/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const campos = {};

    if ('stock' in req.body) {
      const s = Number(req.body.stock);
      if (!Number.isInteger(s) || s < 0) {
        return res.status(400).json({ error: 'stock debe ser un entero >= 0' });
      }
      campos.stock = s;
    }
    if ('precio' in req.body) {
      const p = Number(req.body.precio);
      if (!Number.isFinite(p) || p < 0) {
        return res.status(400).json({ error: 'precio debe ser un número >= 0' });
      }
      campos.precio = p;
    }
    if ('disponible' in req.body) {
      if (typeof req.body.disponible !== 'boolean') {
        return res.status(400).json({ error: 'disponible debe ser true o false' });
      }
      campos.disponible = req.body.disponible;
    }
    if ('nombre' in req.body) {
      const n = String(req.body.nombre).trim();
      if (!n) {
        return res.status(400).json({ error: 'nombre no puede estar vacío' });
      }
      campos.nombre = n;
    }
    if ('descripcion' in req.body) {
      campos.descripcion = String(req.body.descripcion ?? '');
    }
    if ('ingredientes' in req.body) {
      if (typeof req.body.ingredientes !== 'string') {
        return res.status(400).json({ error: 'ingredientes debe ser texto' });
      }
      campos.ingredientes = req.body.ingredientes;
    }
    if ('imagen_s3' in req.body) {
      const img = String(req.body.imagen_s3 ?? '').trim();
      if (img && !/^https?:\/\//.test(img)) {
        return res.status(400).json({ error: 'imagen_s3 debe ser una URL válida (http/https)' });
      }
      campos.imagen_s3 = img || null;
    }

    if (Object.keys(campos).length === 0) {
      return res.status(400).json({ error: 'Sin campos para actualizar' });
    }

    const sets = Object.keys(campos).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const { rowCount, rows } = await req.db.query(
      `UPDATE productos SET ${sets} WHERE id = $1
         RETURNING id, slug, nombre, descripcion, ingredientes, precio, imagen_s3, stock, disponible`,
      [id, ...Object.values(campos)]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/contenido -> contenido editable de la portada de la tienda activa
router.get('/contenido', async (req, res, next) => {
  try {
    const { rows } = await req.db.query('SELECT clave, valor FROM contenido ORDER BY clave');
    res.json({ tienda: req.tenant.slug, contenido: rows });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/contenido -> guarda el contenido de la portada (upsert)
// Body: { contenido: [{ clave, valor }, ...] }
router.put('/contenido', async (req, res, next) => {
  try {
    const items = req.body?.contenido;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Se requiere contenido: [{ clave, valor }]' });
    }
    for (const it of items) {
      if (typeof it.clave !== 'string' || !it.clave.trim()) {
        return res.status(400).json({ error: 'Cada ítem debe tener una clave válida' });
      }
      if (typeof it.valor !== 'string') {
        return res.status(400).json({ error: `El valor de "${it.clave}" debe ser texto` });
      }
    }
    for (const it of items) {
      await req.db.query(
        `INSERT INTO contenido (tienda_id, clave, valor)
         VALUES ($1, $2, $3)
         ON CONFLICT (tienda_id, clave) DO UPDATE SET valor = EXCLUDED.valor`,
        [req.tenant.id, it.clave, it.valor]
      );
    }
    res.json({ ok: true, actualizados: items.length });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/productos -> crea un producto en la tienda activa
// Body: { nombre, slug?, categoria?, descripcion?, ingredientes?, precio?, stock?, disponible? }
router.post('/productos', async (req, res, next) => {
  try {
    const b = req.body || {};

    const nombre = String(b.nombre ?? '').trim();
    if (!nombre) {
      return res.status(400).json({ error: 'nombre es obligatorio' });
    }
    if (b.precio !== undefined) {
      const p = Number(b.precio);
      if (!Number.isFinite(p) || p < 0) {
        return res.status(400).json({ error: 'precio debe ser un número >= 0' });
      }
    }
    if (b.stock !== undefined) {
      const s = Number(b.stock);
      if (!Number.isInteger(s) || s < 0) {
        return res.status(400).json({ error: 'stock debe ser un entero >= 0' });
      }
    }
    if (b.disponible !== undefined && typeof b.disponible !== 'boolean') {
      return res.status(400).json({ error: 'disponible debe ser true o false' });
    }
    if (b.imagen_s3 !== undefined) {
      const img = String(b.imagen_s3 ?? '').trim();
      if (img && !/^https?:\/\//.test(img)) {
        return res.status(400).json({ error: 'imagen_s3 debe ser una URL válida (http/https)' });
      }
    } else if (b.imagen !== undefined) {
      const img = String(b.imagen ?? '').trim();
      if (img && !/^https?:\/\//.test(img)) {
        return res.status(400).json({ error: 'imagen debe ser una URL válida (http/https)' });
      }
    }

    const precio = b.precio !== undefined ? Number(b.precio) : 0;
    const stock = b.stock !== undefined ? Number(b.stock) : 0;
    const disponible = b.disponible !== undefined ? b.disponible : true;
    const imagenS3 = (b.imagen_s3 !== undefined
      ? String(b.imagen_s3 ?? '').trim()
      : b.imagen !== undefined ? String(b.imagen ?? '').trim() : '') || null;

    // Categoría por nombre: se crea en la tienda si no existe.
    // El esquema exige categoria_id NOT NULL, así que sin categoría se usa "General".
    const categoria = b.categoria !== undefined && String(b.categoria).trim()
      ? String(b.categoria).trim()
      : 'General';
    await req.db.query(
      `INSERT INTO categorias (tienda_id, nombre, posicion)
       VALUES ($1, $2, 0)
       ON CONFLICT (tienda_id, nombre) DO NOTHING`,
      [req.tenant.id, categoria]
    );
    const { rows: catRows } = await req.db.query(
      'SELECT id FROM categorias WHERE tienda_id = $1 AND nombre = $2',
      [req.tenant.id, categoria]
    );
    const categoriaId = catRows[0].id;

    // Slug: el indicado o autogenerado desde el nombre, garantizando unicidad
    const base = slugify(b.slug !== undefined ? String(b.slug) : nombre);
    let slug = base || `producto-${Date.now()}`;
    let contador = 2;
    for (;;) {
      const { rows } = await req.db.query(
        'SELECT 1 FROM productos WHERE tienda_id = $1 AND slug = $2',
        [req.tenant.id, slug]
      );
      if (rows.length === 0) break;
      slug = `${base}-${contador++}`;
    }

    const { rows } = await req.db.query(
      `INSERT INTO productos (tienda_id, categoria_id, slug, nombre, descripcion, ingredientes, precio, imagen_s3, stock, disponible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, slug, nombre, descripcion, ingredientes, precio, imagen_s3, stock, disponible`,
      [
        req.tenant.id,
        categoriaId,
        slug,
        nombre,
        String(b.descripcion ?? ''),
        String(b.ingredientes ?? ''),
        precio,
        imagenS3,
        stock,
        disponible,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/productos/:id -> elimina un producto de la tienda activa
router.delete('/productos/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    try {
      const { rowCount } = await req.db.query('DELETE FROM productos WHERE id = $1', [id]);
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Producto no encontrado' });
      }
      res.json({ ok: true });
    } catch (err) {
      // 23503 = violación de FK: el producto tiene líneas de pedido
      if (err.code === '23503') {
        return res.status(409).json({ error: 'No se puede eliminar: el producto tiene pedidos asociados' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/pedidos -> pedidos de la tienda activa con cliente y líneas
router.get('/pedidos', async (req, res, next) => {
  try {
    const { rows } = await req.db.query(
      `SELECT p.id, p.estado, p.subtotal, p.envio, p.total, p.created_at,
              json_build_object('nombre', c.nombre, 'email', c.email, 'telefono', c.telefono) AS cliente,
              COALESCE((
                SELECT json_agg(
                  json_build_object(
                    'nombre', i.nombre_producto,
                    'cantidad', i.cantidad,
                    'precio_unitario', i.precio_unitario,
                    'configuracion', i.configuracion
                  ) ORDER BY i.id
                )
                FROM pedido_items i
                WHERE i.tienda_id = p.tienda_id AND i.pedido_id = p.id
              ), '[]'::json) AS items
         FROM pedidos p
         LEFT JOIN clientes c ON c.tienda_id = p.tienda_id AND c.id = p.cliente_id
        ORDER BY p.created_at DESC`
    );
    res.json({ tienda: req.tenant.slug, pedidos: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/contactos -> consultas del formulario de contacto de la tienda activa
router.get('/contactos', async (req, res, next) => {
  try {
    const { rows } = await req.db.query(
      'SELECT id, nombre, email, mensaje, leido, created_at FROM contactos ORDER BY created_at DESC'
    );
    res.json({ tienda: req.tenant.slug, contactos: rows });
  } catch (err) {
    next(err);
  }
});

function slugify(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

module.exports = router;
