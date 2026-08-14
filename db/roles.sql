-- ============================================================
-- BakeryCloud - Rol de la API (privilegios mínimos)
-- Crea el rol bakery_api que usará la REST API en Node.js.
--
-- POR QUÉ UN ROL SEPARADO:
-- PostgreSQL BYPASSA Row Level Security para el dueño de la
-- tabla. Como las tablas las crea bakery (superusuario de la
-- BD), bakery vería todas las tiendas. bakery_api NO es dueño,
-- así que RLS SÍ lo filtra por tienda_id.
-- ============================================================

-- Crear rol (solo la primera vez)
CREATE ROLE bakery_api LOGIN PASSWORD 'api_secret_123'
    NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- Acceso a los esquemas
GRANT USAGE ON SCHEMA public TO bakery_api;
GRANT USAGE ON SCHEMA app    TO bakery_api;

-- CRUD sobre las tablas de negocio
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bakery_api;

-- Secuencias (necesarias para INSERT con autoincremento)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bakery_api;

-- Funciones del esquema app (set_tenant, current_tenant)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO bakery_api;
