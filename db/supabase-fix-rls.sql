-- ============================================================
-- Fix RLS — Proyecto Supabase "bakerycloud"
-- ------------------------------------------------------------
-- MOTIVO (alerta "rls_disabled_in_public" del dashboard):
--   Las tablas "tiendas" y "rate_limits" estaban en public SIN
--   Row Level Security: cualquier rol con acceso al API de
--   Supabase (clave anon) podia leerlas y escribir en ellas.
--
-- ESTE SCRIPT (idempotente):
--   1. Habilita RLS en TODAS las tablas de public.
--   2. (Re)crea la politica tenant_isolation en las 8 tablas de
--      negocio con app.current_tenant() — identica a supabase-setup.sql.
--   3. tiendas: lectura publica (la lista de tiendas es publica en el
--      frontal), escritura solo para el dueño de la tabla.
--   4. rate_limits: solo la API (bloquea anon/authenticated de Supabase
--      para que nadie manipule los contadores de rate limiting).
--
-- LA APP NO SE ROMPE:
--   - Produccion (Fly) conecta como rol postgres → BYPASSRLS.
--   - Docker local conecta como bakery_api → pasa por las politicas
--     (tiendas: SELECT USING (true) le deja leer; rate_limits: no es
--     ni anon ni authenticated → le deja operar).
--
-- COMO APLICARLO:
--   Supabase Dashboard → SQL Editor → pega este archivo → Run.
--   (O ejecutarlo con el DATABASE_URL de backend/.env)
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Habilitar Row Level Security en TODAS las tablas
-- ------------------------------------------------------------
ALTER TABLE productos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE opciones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE contactos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE contenido    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiendas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits  ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2) Politica de aislamiento por tienda (tenant_isolation)
--    USANDO - se protege contra "filter by predictor" conflicts.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation ON productos;
CREATE POLICY tenant_isolation ON productos
  USING (tienda_id = app.current_tenant())
  WITH CHECK (tienda_id = app.current_tenant());

DROP POLICY IF EXISTS tenant_isolation ON categorias;
CREATE POLICY tenant_isolation ON categorias
  USING (tienda_id = app.current_tenant())
  WITH CHECK (tienda_id = app.current_tenant());

DROP POLICY IF EXISTS tenant_isolation ON clientes;
CREATE POLICY tenant_isolation ON clientes
  USING (tienda_id = app.current_tenant())
  WITH CHECK (tienda_id = app.current_tenant());

DROP POLICY IF EXISTS tenant_isolation ON pedidos;
CREATE POLICY tenant_isolation ON pedidos
  USING (tienda_id = app.current_tenant())
  WITH CHECK (tienda_id = app.current_tenant());

DROP POLICY IF EXISTS tenant_isolation ON pedido_items;
CREATE POLICY tenant_isolation ON pedido_items
  USING (tienda_id = app.current_tenant())
  WITH CHECK (tienda_id = app.current_tenant());

DROP POLICY IF EXISTS tenant_isolation ON opciones;
CREATE POLICY tenant_isolation ON opciones
  USING (tienda_id = app.current_tenant())
  WITH CHECK (tienda_id = app.current_tenant());

DROP POLICY IF EXISTS tenant_isolation ON contactos;
CREATE POLICY tenant_isolation ON contactos
  USING (tienda_id = app.current_tenant())
  WITH CHECK (tienda_id = app.current_tenant());

DROP POLICY IF EXISTS tenant_isolation ON contenido;
CREATE POLICY tenant_isolation ON contenido
  USING (tienda_id = app.current_tenant())
  WITH CHECK (tienda_id = app.current_tenant());

-- ------------------------------------------------------------
-- 3) tiendas: lectura publica, escritura solo dueño
--    (sin politica de escritura: los INSERT/UPDATE los hace el
--    dueño de la tabla en seeds/migraciones, que bypass RLS)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS tiendas_public_read ON tiendas;
CREATE POLICY tiendas_public_read ON tiendas
  FOR SELECT USING (true);

-- ------------------------------------------------------------
-- 4) rate_limits: accesible para la app, NO para anon/authenticated
-- ------------------------------------------------------------
DROP POLICY IF EXISTS rate_limits_api ON rate_limits;
CREATE POLICY rate_limits_api ON rate_limits
  USING (current_user NOT IN ('anon', 'authenticated'))
  WITH CHECK (current_user NOT IN ('anon', 'authenticated'));

COMMIT;

-- Verificacion A: rls debe ser true en TODAS las tablas
SELECT c.relname AS tabla, c.relrowsecurity AS rls
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- Verificacion B: politicas por tabla
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public' ORDER BY tablename, policyname;
