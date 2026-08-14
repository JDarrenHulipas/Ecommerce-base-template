const pool = require('../config/db');
const { defaultTenantSlug } = require('../config/env');

// Resuelve la tienda activa a partir de:
//   1. Cabecera X-Tenant-Slug (útil en desarrollo/postman)
//   2. Subdominio del Host (production: <slug>.bakerycloud.com)
//   3. Tienda por defecto (desarrollo local)
//
// IMPORTANTE: cada request adquiere SU PROPIA conexión (pool.connect())
// y fija el tenant en esa conexión (SET app.tienda_id). Así RLS filtra
// correctamente y no se mezclan tenants entre requests del pool.
async function resolveTenant(req, res, next) {
  const client = await pool.connect();
  try {
    let slug =
      req.headers['x-tenant-slug'] ||
      extractSubdomain(req.get('host')) ||
      defaultTenantSlug;

    const { rows } = await client.query(
      'SELECT id, slug, nombre, estado FROM tiendas WHERE slug = $1 AND estado = \'activo\'',
      [slug]
    );

    if (rows.length === 0) {
      client.release();
      return res.status(404).json({ error: `Tienda no encontrada o inactiva: ${slug}` });
    }

    req.tenant = rows[0];
    req.db = client;

    // Fija el tenant en la conexión del request: a partir de aquí RLS filtra.
    await client.query('SELECT app.set_tenant($1)', [req.tenant.id]);

    // Al terminar la respuesta se libera la conexión y se limpia el tenant.
    res.on('finish', () => {
      client
        .query('SELECT app.set_tenant(NULL)')
        .catch(() => {})
        .finally(() => client.release());
    });

    next();
  } catch (err) {
    client.release();
    next(err);
  }
}

function extractSubdomain(host) {
  if (!host) return null;
  const parts = host.split('.');
  // <slug>.<dominio>.<tld>  =>  primer segmento es el slug
  return parts.length >= 3 ? parts[0] : null;
}

module.exports = resolveTenant;
