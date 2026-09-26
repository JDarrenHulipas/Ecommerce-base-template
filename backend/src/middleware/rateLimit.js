const rateLimit = require('express-rate-limit');
const pool = require('../config/db');

// Tabla única compartida: la creación se serializa entre los dos limiters para
// evitar la carrera de "duplicate key ... pg_type" al ejecutar dos
// CREATE TABLE IF NOT EXISTS en paralelo. Un fallo puntual se reintenta.
let tablaPromise = null;
async function crearTabla() {
  for (let intento = 0; intento < 3; intento++) {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS rate_limits (
        clave    text PRIMARY KEY,
        hits     int NOT NULL,
        reset_at timestamptz NOT NULL
      )`);
      return true;
    } catch (err) {
      if (intento === 2) {
        console.error('[rate-limit] no se pudo crear rate_limits, usando memoria:', err.message);
        return false;
      }
      await new Promise((r) => setTimeout(r, 100 * (intento + 1)));
    }
  }
  return false;
}
function prepararTabla() {
  if (!tablaPromise) tablaPromise = crearTabla();
  return tablaPromise;
}

// Store de rate limit respaldado por la propia Postgres (gratis, sin Redis):
// los contadores sobreviven a reinicios y valen para todas las máquinas de Fly.
// Si la tabla no está disponible, cae a un contador en memoria para no bloquear.
class PostgresStore {
  constructor(nombre) {
    this.nombre = nombre;
    this.windowMs = 60 * 1000;
    this.localKeys = false; // la clave está en la BD: otros procesos la ven
    this.listo = false;
    this.memoria = new Map();
  }

  async init(options) {
    this.windowMs = options.windowMs || this.windowMs;
    try {
      this.listo = await prepararTabla();
    } catch (err) {
      console.error('[rate-limit] no se pudo preparar rate_limits, usando memoria:', err.message);
      this.listo = false;
    }
  }

  clave(key) {
    return `${this.nombre}:${key}`;
  }

  // Contador en memoria (fallback si la BD falla)
  incrementoMem(clave) {
    const ahora = Date.now();
    const actual = this.memoria.get(clave);
    if (!actual || actual.reset <= ahora) {
      const nuevo = { hits: 1, reset: ahora + this.windowMs };
      this.memoria.set(clave, nuevo);
      return { totalHits: 1, resetTime: new Date(nuevo.reset) };
    }
    actual.hits += 1;
    return { totalHits: actual.hits, resetTime: new Date(actual.reset) };
  }

  async increment(key) {
    const clave = this.clave(key);
    if (!this.listo) return this.incrementoMem(clave);
    try {
      const ahora = new Date();
      const fin = new Date(ahora.getTime() + this.windowMs);
      const { rows } = await pool.query(
        `INSERT INTO rate_limits (clave, hits, reset_at) VALUES ($1, 1, $2)
         ON CONFLICT (clave) DO UPDATE SET
           hits = CASE WHEN rate_limits.reset_at <= $3 THEN 1 ELSE rate_limits.hits + 1 END,
           reset_at = CASE WHEN rate_limits.reset_at <= $3 THEN $2 ELSE rate_limits.reset_at END
         RETURNING hits, reset_at`,
        [clave, fin, ahora]
      );
      return { totalHits: rows[0].hits, resetTime: new Date(rows[0].reset_at) };
    } catch (err) {
      console.error('[rate-limit] increment falló, usando memoria:', err.message);
      return this.incrementoMem(clave);
    }
  }

  async decrement(key) {
    const clave = this.clave(key);
    const mem = this.memoria.get(clave);
    if (mem && mem.hits > 0) mem.hits -= 1;
    if (!this.listo) return;
    try {
      await pool.query('UPDATE rate_limits SET hits = hits - 1 WHERE clave = $1 AND hits > 0', [clave]);
    } catch { /* best effort */ }
  }

  async resetKey(key) {
    const clave = this.clave(key);
    this.memoria.delete(clave);
    if (!this.listo) return;
    try {
      await pool.query('DELETE FROM rate_limits WHERE clave = $1', [clave]);
    } catch { /* best effort */ }
  }
}

// En producción los límites son estrictos; en desarrollo/test son amplios para
// que las suites (varios logins/segundo desde la misma IP) no disparen 429.
const enProduccion = process.env.NODE_ENV === 'production';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: enProduccion ? 10 : 200,
  message: { error: 'Demasiados intentos de login. Espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new PostgresStore('login'),
});

const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minuto
  max: enProduccion ? 30 : 1000,
  message: { error: 'Demasiadas peticiones. Espera un minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new PostgresStore('mut'),
});

module.exports = { loginLimiter, mutationLimiter };
