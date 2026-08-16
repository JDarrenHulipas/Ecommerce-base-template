-- ============================================================
-- Migración 003: Formulario de contacto
-- 1. Tabla contactos (consultas del formulario por tienda)
-- 2. RLS + política tenant_isolation
-- 3. Privilegios para el rol bakery_api
-- Idempotente: se puede ejecutar varias veces sin error.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS contactos (
    id          BIGSERIAL,
    tienda_id   INT          NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
    nombre      VARCHAR(120) NOT NULL,
    email       VARCHAR(190) NOT NULL,
    mensaje     TEXT         NOT NULL,
    leido       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (tienda_id, id)
);

CREATE INDEX IF NOT EXISTS idx_contactos_created ON contactos (tienda_id, created_at DESC);

ALTER TABLE contactos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contactos'
    ) THEN
        CREATE POLICY tenant_isolation ON contactos
            USING (tienda_id = app.current_tenant())
            WITH CHECK (tienda_id = app.current_tenant());
    END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON contactos TO bakery_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bakery_api;

COMMIT;
