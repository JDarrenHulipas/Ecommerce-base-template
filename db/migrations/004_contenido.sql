-- ============================================================
-- Migración 004: Contenido editable de la página principal
-- 1. Tabla contenido (tienda_id, clave, valor) por tienda
-- 2. RLS + política tenant_isolation
-- 3. Privilegios para el rol bakery_api
-- 4. Seed con los textos actuales de la tienda 1 (Kokoro Cakes)
-- Idempotente: se puede ejecutar varias veces sin error.
-- ============================================================

BEGIN;

-- 1. Tabla de contenido de la página principal (multi-tenant)
CREATE TABLE IF NOT EXISTS contenido (
    tienda_id INT         NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
    clave     VARCHAR(60) NOT NULL,
    valor     TEXT        NOT NULL DEFAULT '',
    PRIMARY KEY (tienda_id, clave)
);

-- 2. RLS para contenido
ALTER TABLE contenido ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contenido'
    ) THEN
        CREATE POLICY tenant_isolation ON contenido
            USING (tienda_id = app.current_tenant())
            WITH CHECK (tienda_id = app.current_tenant());
    END IF;
END $$;

-- 3. Privilegios para el rol de la API (idempotente)
GRANT SELECT, INSERT, UPDATE, DELETE ON contenido TO bakery_api;

-- 4. Seed: textos actuales de la tienda 1 (Kokoro Cakes).
--    El panel admin puede modificarlos; la tienda los lee en la portada.
INSERT INTO contenido (tienda_id, clave, valor) VALUES
(1, 'announcement',    '🍰 Encargos con 48h de antelación · Bento cakes, mini cakes y tartas personalizadas'),
(1, 'hero_eyebrow',    'Pastelería personalizada · Barcelona'),
(1, 'hero_titulo',     'Baking hearts
to fill yours'),
(1, 'hero_sub',        'Bento cakes de 10 cm, mini cakes horneados con amor y tartas vintage decoradas con buttercream de merengue suizo.'),
(1, 'hero_cta',        'Ver nuestros dulces'),
(1, 'nosotros_titulo', 'Un obrador con corazón'),
(1, 'nosotros_texto',  'Cada pastel se hornea por encargo con mucho cariño. Bizcochos súper húmedos, buttercream de merengue suizo y diseños únicos estilo vintage y coquette.'),
(1, 'contacto_texto',  '¿Quieres un pastel para una ocasión especial? Escríbenos y lo preparamos.'),
(1, 'footer_texto',    'Kokoro Cakes · Barcelona · Encargos por Instagram @kokorocakess')
ON CONFLICT (tienda_id, clave) DO NOTHING;

COMMIT;
