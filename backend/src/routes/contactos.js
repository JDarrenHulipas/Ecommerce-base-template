const { Router } = require('express');
const adminAuth = require('../middleware/adminAuth').adminAuth;
const { mutationLimiter } = require('../middleware/rateLimit');

const router = Router();

// GET /api/contactos -> consultas recibidas de la tienda activa (solo admin)
router.get('/', adminAuth, async (req, res, next) => {
  try {
    const { rows } = await req.db.query(
      `SELECT id, nombre, email, mensaje, leido, created_at
         FROM contactos
        WHERE tienda_id = $1
        ORDER BY created_at DESC`,
      [req.tenant.id]
    );
    res.json({ tienda: req.tenant.slug, count: rows.length, contactos: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/contactos -> guarda una consulta del formulario de contacto
// Body: { nombre, email, mensaje }
router.post('/', mutationLimiter, async (req, res, next) => {
  try {
    const nombre = (req.body?.nombre || '').toString().trim();
    const email = (req.body?.email || '').toString().trim().toLowerCase();
    const mensaje = (req.body?.mensaje || '').toString().trim();

    if (!nombre || !email || !mensaje) {
      return res.status(400).json({ error: 'Se requieren nombre, email y mensaje' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'El email no es válido' });
    }

    const { rows } = await req.db.query(
      `INSERT INTO contactos (tienda_id, nombre, email, mensaje)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [req.tenant.id, nombre, email, mensaje]
    );

    res.status(201).json({ id: rows[0].id, creado: rows[0].created_at });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
