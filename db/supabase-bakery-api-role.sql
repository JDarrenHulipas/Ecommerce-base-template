-- ============================================================
-- BakeryCloud - Rol de mínimo privilegio para la API EN SUPABASE
-- ------------------------------------------------------------
-- POR QUÉ: antes la API conectaba como `postgres` (superusuario +
-- BYPASSRLS). Si algún día hubiera una SQLi, el atacante tendría
-- permisos de superusuario. Con este rol, RLS SIEMPRE filtra (sin
-- BYPASSRLS) y solo puede hacer SELECT/INSERT/UPDATE/DELETE de las
-- tablas de negocio. Ya está aplicado en producción (Fly secrets).
--
-- CÓMO CONECTAR (ojo, dos particularidades de Supabase):
--   · Usuario en el pooler:  bakery_api.[PROJECT-REF]
--     (un rol custom necesita el ref; el rol en la BD se llama
--     simplemente `bakery_api`, el pooler reescribe el usuario)
--   · Puerto 5432 (modo sesión). El 6543 (modo transacción)
--     pierde el estado entre transacciones y rompería
--     `SELECT app.set_tenant(...)` = RLS devolvería 0 filas.
--   · Ejemplo: postgres://bakery_api.[REF]:[PASSWORD]@[POOLER-HOST]:5432/postgres
--
-- PASSWORD: genera una aleatoria AL APLICARLA y guárdala en el
-- secreto de Fly (DATABASE_URL). NUNCA en el repo.
--
-- Idempotente: se puede ejecutar varias veces.
-- ============================================================

-- 1) Rol (solo si no existe). Nota: la password del placeholder se
--    sustituye en TODAS sus apariciones si copias el script.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bakery_api') THEN
    CREATE ROLE bakery_api LOGIN PASSWORD 'cambia_esta_password'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

-- 2) Acceso a esquemas
GRANT USAGE ON SCHEMA public TO bakery_api;
GRANT USAGE ON SCHEMA app    TO bakery_api;

-- 3) CRUD sobre TODAS las tablas existentes (incluye rate_limits)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bakery_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bakery_api;

-- 4) Funciones de tenant (set_tenant / current_tenant)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO bakery_api;

-- 5) Tablas futuras que cree postgres (p. ej. nuevas en migraciones)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bakery_api;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO bakery_api;

-- 6) CREATE en public: el backend hace `CREATE TABLE IF NOT EXISTS rate_limits`
--    al arrancar (en BDs donde la tabla aún no exista)
GRANT CREATE ON SCHEMA public TO bakery_api;

-- ------------------------------------------------------------
-- Verificación (rol mínimo = defensa en profundidad):
--   como bakery_api sin set_tenant -> SELECT count(*) FROM productos = 0
--   con set_tenant(1)              -> solo filas de la tienda 1
--   con set_tenant(2)              -> solo filas de la tienda 2
-- ------------------------------------------------------------
