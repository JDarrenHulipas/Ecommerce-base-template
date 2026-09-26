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
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    // Express 4 no captura promesas rechazadas en middlewares: sin esta rama
    // la request se quedaría sin respuesta y el cliente vería un cuelgue.
    return res.status(503).json({ error: 'Base de datos no disponible' });
  }
  try {
    const header = (req.headers['x-tenant-slug'] || '').trim();
    const fromHost = extractSubdomain(req.get('host'));
    let slug;
    if (process.env.NODE_ENV === 'production') {
      // En producción la cabecera solo se acepta si coincide con el subdominio
      // o con la tienda por defecto: evita enumerar tiendas ajenas enviando
      // X-Tenant-Slug arbitrarios (los datos son públicos, pero no expone
      // tiendas que no estén publicadas en un dominio).
      slug = header && (header === fromHost || header === defaultTenantSlug)
        ? header
        : (fromHost || defaultTenantSlug);
    } else {
      slug = header || fromHost || defaultTenantSlug;
    }

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
    // 'finish' cubre las respuestas normales; 'close' las abortadas (cliente
    // que corta la petición): sin esto la conexión se queda tomada y al
    // agotarse el pool (10) toda la API se cuelga. El guard evita doble release.
    let liberado = false;
    const liberar = () => {
      if (liberado) return;
      liberado = true;
      client
        .query('SELECT app.set_tenant(NULL)')
        .catch(() => {})
        .finally(() => client.release());
    };
    res.on('finish', liberar);
    res.on('close', liberar);

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
