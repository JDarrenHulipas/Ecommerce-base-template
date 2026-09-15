const { Router } = require('express');

const router = Router();

// GET /api/opciones -> opciones del configurador de la tienda activa
// Devuelve el catálogo agrupado por tipo y la tarta base del configurador.
router.get('/', async (req, res, next) => {
  try {
    const [opciones, tarta] = await Promise.all([
      req.db.query(
        `SELECT id, grupo, nombre, descripcion, precio
           FROM opciones
          WHERE tienda_id = $1
          ORDER BY posicion, nombre`,
        [req.tenant.id]
      ),
      req.db.query(
        `SELECT id, slug, nombre, descripcion, precio
           FROM productos
          WHERE slug = 'tarta-encargo' AND tienda_id = $1 AND disponible = TRUE`,
        [req.tenant.id]
      ),
    ]);

    const grupos = {};
    for (const op of opciones.rows) {
      (grupos[op.grupo] ||= []).push(op);
    }

    res.json({
      tienda: req.tenant.slug,
      tarta_base: tarta.rows[0] || null,
      grupos,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
