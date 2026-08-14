const { Router } = require('express');

const router = Router();

// GET /api/productos  -> productos de la tienda activa (RLS filtra)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await req.db.query(
      `SELECT p.id, p.slug, p.nombre, p.descripcion, p.precio, p.imagen_s3, p.stock, p.disponible,
              c.nombre AS categoria
         FROM productos p
         LEFT JOIN categorias c ON c.tienda_id = p.tienda_id AND c.id = p.categoria_id
        WHERE p.disponible = TRUE
        ORDER BY c.posicion, p.nombre`
    );
    res.json({ tienda: req.tenant.slug, count: rows.length, productos: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/productos/:slug  -> un producto concreto
router.get('/:slug', async (req, res, next) => {
  try {
    const { rows } = await req.db.query(
      `SELECT p.id, p.slug, p.nombre, p.descripcion, p.precio, p.imagen_s3, p.stock, p.disponible,
              c.nombre AS categoria
         FROM productos p
         LEFT JOIN categorias c ON c.tienda_id = p.tienda_id AND c.id = p.categoria_id
        WHERE p.slug = $1 AND p.disponible = TRUE`,
      [req.params.slug]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
