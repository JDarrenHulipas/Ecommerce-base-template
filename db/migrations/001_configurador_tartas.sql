-- ============================================================
-- Migración 001: Configurador de tartas personalizadas
-- 1. Columna configuracion JSONB en pedido_items (opciones elegidas)
-- 2. Tabla opciones (catálogo: tamaños, sabores, decoración, extras)
-- 3. RLS + política para opciones
-- Idempotente: se puede ejecutar varias veces sin error.
-- ============================================================

-- 1. Snapshot de la configuración elegida en cada línea de pedido
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS configuracion JSONB;

-- 2. Tabla de opciones del configurador
CREATE TABLE IF NOT EXISTS opciones (
    id          BIGSERIAL,
    tienda_id   INT           NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
    grupo       VARCHAR(40)   NOT NULL CHECK (grupo IN ('tamano','bizcocho','relleno','decoracion','extra')),
    nombre      VARCHAR(120)  NOT NULL,
    descripcion TEXT,
    precio      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
    posicion    INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (tienda_id, id),
    UNIQUE (tienda_id, grupo, nombre)
);

-- 3. RLS para opciones
ALTER TABLE opciones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'opciones'
    ) THEN
        CREATE POLICY tenant_isolation ON opciones
            USING (tienda_id = app.current_tenant())
            WITH CHECK (tienda_id = app.current_tenant());
    END IF;
END $$;

-- 4. Privilegios para el rol de la API (idempotente)
GRANT SELECT, INSERT, UPDATE, DELETE ON opciones TO bakery_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bakery_api;
