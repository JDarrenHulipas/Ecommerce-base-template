const { Router } = require('express');

const router = Router();

// GET /api/contenido -> contenido de la página principal de la tienda activa
// Devuelve un objeto clave -> valor (p.ej. { hero_titulo: '...' }).
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await req.db.query('SELECT clave, valor FROM contenido');
    const contenido = {};
    for (const r of rows) contenido[r.clave] = r.valor;
    res.json({ tienda: req.tenant.slug, contenido });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
