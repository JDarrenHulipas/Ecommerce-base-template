const { Pool } = require('pg');
const { databaseUrl } = require('./env');

const pool = new Pool({
  connectionString: databaseUrl,
  // Si una conexión muere (corte de red, idle matado por Supabase) la query
  // falla en 10s en vez de quedarse colgada para siempre.
  connectionTimeoutMillis: 10000,
  // Cierra las conexiones ociosas a los 30s (antes de que el proveedor las mate)
  idleTimeoutMillis: 30000,
});

// Error en una conexión ociosa: se registra y se descarta (pg la recrea solo).
pool.on('error', (err) => {
  console.error('[db] conexión ociosa con error:', err.message);
});

module.exports = pool;
