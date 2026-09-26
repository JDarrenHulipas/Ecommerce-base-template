-- ============================================================
-- BakeryCloud - Rol de mínimo privilegio para la API EN SUPABASE
-- ------------------------------------------------------------
-- POR QUÉ: en producción la API conectaba como `postgres`
-- (superusuario + BYPASSRLS). Si algún día hubiera una SQLi, el
-- atacante tendría permisos de superusuario sobre toda la BD.
-- Con `bakery_api`, RLS SIEMPRE filtra (sin BYPASSRLS) y solo
-- puede hacer SELECT/INSERT/UPDATE/DELETE de las tablas de negocio.
--
-- APLICACIÓN:
--   1. Sustituye 'cambia_esta_password' por una password aleatoria
--      generada AL APLICARLA (nunca se guarda en el repo).
--   2. Supabase Dashboard → SQL Editor → Run (o DATABASE_URL postgres).
--   3. fly secrets set DATABASE_URL=... con la conexión de este rol.
--
-- Idempotente: se puede ejecutar varias veces.
-- ============================================================

-- 1) Rol (solo si no existe)
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
-- Verificación (tras cambiar el secret en Fly):
--   \du bakery_api                      -> privilegios
--   como bakery_api:
--     SELECT set_tenant(1); SELECT count(*) FROM productos;  -> filas de la tienda 1
--     SELECT set_tenant(2); SELECT count(*) FROM productos;  -> filas de la tienda 2
--     SELECT count(*) FROM productos;                        -> 0 (sin tenant)
-- ------------------------------------------------------------
