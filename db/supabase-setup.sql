-- BakeryCloud - Setup completo para Supabase (PostgreSQL free)
-- Ejecutar UNA sola vez en SQL Editor de Supabase.
-- NO crea roles (Supabase lo impide); la app conecta como postgres.

-- ============================================================
-- PARTE 1: ESQUEMA (tablas + RLS + funciones de tenant)
-- ============================================================
-- ============================================================
-- BakeryCloud - Esquema Multi-Tenant (PostgreSQL)
-- Patrón: Shared Database + Shared Schema + Row Level Security
-- Todo acceso a datos se filtra por tienda_id a nivel de BD.
-- ============================================================

-- ------------------------------------------------------------
-- Tenants: una fila por tienda/cliente white-label
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tiendas (
    id              SERIAL PRIMARY KEY,
    slug            VARCHAR(60)  NOT NULL UNIQUE,          -- subdominio: la-casa-del-cruasan
    nombre          VARCHAR(120) NOT NULL,
    descripcion     TEXT,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'activo',-- activo | suspendida | baja
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Categorías de productos (por tienda)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
    id          BIGSERIAL,
    tienda_id   INT          NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
    nombre      VARCHAR(120) NOT NULL,
    posicion    INT          NOT NULL DEFAULT 0,
    activo      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (tienda_id, id),
    UNIQUE (tienda_id, nombre)
);

-- ------------------------------------------------------------
-- Productos (por tienda)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
    id          BIGSERIAL,
    tienda_id   INT           NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
    categoria_id BIGSERIAL,
    slug        VARCHAR(120)  NOT NULL,
    nombre      VARCHAR(150)  NOT NULL,
    descripcion TEXT,
    ingredientes TEXT,                                   -- lista de ingredientes (separada por comas)
    precio      NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    imagen_s3   VARCHAR(255),                              -- ruta en bucket: /tienda-id/productos/xxx.jpg
    stock       INT           NOT NULL DEFAULT 0 CHECK (stock >= 0),
    disponible  BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    PRIMARY KEY (tienda_id, id),
    UNIQUE (tienda_id, slug),
    FOREIGN KEY (tienda_id, categoria_id)
        REFERENCES categorias (tienda_id, id)
        ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Clientes (por tienda)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
    id          BIGSERIAL,
    tienda_id   INT          NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
    email       VARCHAR(190) NOT NULL,
    nombre      VARCHAR(120),
    telefono    VARCHAR(30),
    direccion   TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (tienda_id, id),
    UNIQUE (tienda_id, email)
);

-- ------------------------------------------------------------
-- Pedidos (cabecera) y líneas de pedido
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos (
    id          BIGSERIAL,
    tienda_id   INT           NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
    cliente_id  BIGSERIAL,
    estado      VARCHAR(30)   NOT NULL DEFAULT 'pendiente',-- pendiente | confirmado | enviado | entregado | cancelado
    subtotal    NUMERIC(10,2) NOT NULL DEFAULT 0,
    envio       NUMERIC(10,2) NOT NULL DEFAULT 0,
    total       NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    PRIMARY KEY (tienda_id, id),
    FOREIGN KEY (tienda_id, cliente_id)
        REFERENCES clientes (tienda_id, id)
);

CREATE TABLE IF NOT EXISTS pedido_items (
    id              BIGSERIAL,
    tienda_id       INT           NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
    pedido_id       BIGSERIAL,
    producto_id     BIGSERIAL,
    nombre_producto VARCHAR(150)  NOT NULL,                -- snapshot: no cambia si el producto cambia
    cantidad        INT           NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
    configuracion   JSONB,                                 -- tartas personalizadas: opciones elegidas
    PRIMARY KEY (tienda_id, id),
    FOREIGN KEY (tienda_id, pedido_id)  REFERENCES pedidos (tienda_id, id) ON DELETE CASCADE,
    FOREIGN KEY (tienda_id, producto_id) REFERENCES productos (tienda_id, id)
);

-- ============================================================
-- Opciones del configurador de tartas (catálogo de la tienda)
-- Grupo 'tamano' define el PRECIO BASE; el resto son deltas.
--   tamano    -> 1 elección (diámetro, precio base)
--   altura    -> 1 elección (Regular +0 / Tall +15)
--   bizcocho  -> 1 elección (delta sobre el tamaño)
--   relleno   -> 1 elección (delta)
--   decoracion-> 1 elección (delta)
--   extra     -> varias elecciones (delta por unidad)
-- ============================================================
CREATE TABLE IF NOT EXISTS opciones (
    id          BIGSERIAL,
    tienda_id   INT           NOT NULL REFERENCES tiendas(id) ON DELETE CASCADE,
    grupo       VARCHAR(40)   NOT NULL CHECK (grupo IN ('tamano','altura','bizcocho','relleno','decoracion','extra')),
    nombre      VARCHAR(120)  NOT NULL,
    descripcion TEXT,
    precio      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
    posicion    INT           NOT NULL DEFAULT 0,
    PRIMARY KEY (tienda_id, id),
    UNIQUE (tienda_id, grupo, nombre)
);

-- ============================================================
-- ÍNDICES: el patrón (tienda_id, id) ya indexa la tienda.
-- Añadimos los índices de acceso más comunes.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos (tienda_id, categoria_id) WHERE categoria_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_estado       ON pedidos (tienda_id, estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente      ON pedidos (tienda_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_created      ON pedidos (tienda_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- El tenant activo se inyecta por sesión con la función set_tenant().
-- Desde fuera (app), se hace: SET app.tienda_id = <id>
-- ============================================================

-- Helpers para gestionar el tenant activo de la conexión
CREATE SCHEMA IF NOT EXISTS app;
CREATE OR REPLACE FUNCTION app.set_tenant(tienda INTEGER)
RETURNS VOID AS $$
    -- COALESCE: si se pasa NULL, se guarda '' (sesión sin tenant activo)
    SELECT set_config('app.tienda_id', COALESCE(tienda::text, ''), FALSE);
$$ LANGUAGE SQL;

CREATE OR REPLACE FUNCTION app.current_tenant()
RETURNS INTEGER AS $$
    SELECT NULLIF(current_setting('app.tienda_id', TRUE), '')::INTEGER;
$$ LANGUAGE SQL STABLE;

-- Activamos RLS en las tablas de negocio (todas las que tienen tienda_id)
ALTER TABLE categorias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE opciones    ENABLE ROW LEVEL SECURITY;

-- Política: SOLO se ven/escriben filas de la tienda activa de la sesión.
-- La columna tienda_id coincide con app.current_tenant().
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['categorias','productos','clientes','pedidos','pedido_items','opciones']
    LOOP
        EXECUTE format('CREATE POLICY tenant_isolation ON %I
                        USING (tienda_id = app.current_tenant())
                        WITH CHECK (tienda_id = app.current_tenant())', t);
    END LOOP;
END $$;

-- El rol de la API (bakery_api) NO es dueño de estas tablas, por lo
-- que Row Level Security SÍ le aplica. Los privilegios de ese rol se
-- conceden en roles.sql (no aquí, para que este script sea idempotente).

-- Los roles por defecto no tienen privilegios (restringido)

-- ============================================================
-- PARTE 2: SEED DE TIENDAS DE PRUEBA (tienda 1 = Kokoro)
-- ============================================================
-- ============================================================
-- BakeryCloud - Seed (datos de ejemplo)
-- Crea 2 tiendas white-label con categorías, productos, un
-- cliente y un pedido, para poder probar la API.
--
-- Importante:
--  * Cada bloque activa su tenant con app.set_tenant(), porque
--    con Row Level Security la sesión solo puede escribir en
--    la tienda activa.
--  * Los ids de autoincremento (BIGSERIAL) son GLOBALES en la
--    BD, por eso NUNCA se asumen: se resuelven por subconsulta
--    usando claves naturales (slug, email, nombre).
-- ============================================================

BEGIN;

-- Limpia datos previos para que el seed sea re-ejecutable
TRUNCATE TABLE pedido_items, pedidos, clientes, productos, categorias, tiendas
RESTART IDENTITY CASCADE;

-- ------------------------------------------------------------
-- Tiendas (tenants)
-- ------------------------------------------------------------
INSERT INTO tiendas (slug, nombre, descripcion) VALUES
('la-casa-del-cruasan', 'La Casa del Cruasán', 'Pastelería artesanal de barrio. Especialistas en bollería de mantequilla.'),
('dulces-maribel',      'Dulces Maribel',      'Repostería tradicional para eventos, bodas y cumpleaños.');

-- ------------------------------------------------------------
-- Tienda 1: La Casa del Cruasán
-- ------------------------------------------------------------
SELECT app.set_tenant(1);

INSERT INTO categorias (tienda_id, nombre, posicion) VALUES
(1, 'Bollería', 1),
(1, 'Tartas',   2),
(1, 'Café',     3);

INSERT INTO productos (tienda_id, categoria_id, slug, nombre, descripcion, precio, stock, disponible) VALUES
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Bollería'), 'cruasan-mantequilla', 'Cruasán de mantequilla', 'Hojaldrado durante 72 horas, 100% mantequilla.', 2.50, 50, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Bollería'), 'napolitana-chocolate', 'Napolitana de chocolate', 'Con chocolate belga y masa de mantequilla.',      3.20, 30, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Tartas'),   'tarta-frambuesa',      'Tarta de frambuesa',      'Bizcocho de vainilla, crema y frambuesas frescas.', 22.00, 5, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Café'),     'cafe-espresso',        'Café espresso',           'Tueste natural de origen colombiano.',              1.80, 100, TRUE);

-- ------------------------------------------------------------
-- Tienda 2: Dulces Maribel
-- ------------------------------------------------------------
SELECT app.set_tenant(2);

INSERT INTO categorias (tienda_id, nombre, posicion) VALUES
(2, 'Mantecados',          1),
(2, 'Dulces para eventos', 2);

INSERT INTO productos (tienda_id, categoria_id, slug, nombre, descripcion, precio, stock, disponible) VALUES
(2, (SELECT id FROM categorias WHERE tienda_id = 2 AND nombre = 'Mantecados'),          'mantecado-canelas', 'Mantecados de canela', 'Receta tradicional andaluza, 12 unidades.', 6.50, 20, TRUE),
(2, (SELECT id FROM categorias WHERE tienda_id = 2 AND nombre = 'Dulces para eventos'), 'cake-embarazo',     'Cake reveal de género', 'Bizcocho sorpresa con relleno de color.',   35.00, 2, TRUE);

-- ------------------------------------------------------------
-- Cliente y pedido de ejemplo (tienda 1)
-- ------------------------------------------------------------
SELECT app.set_tenant(1);

INSERT INTO clientes (tienda_id, email, nombre, telefono, direccion) VALUES
(1, 'ana@example.com', 'Ana García', '612345678', 'Calle Mayor 10, Madrid');

INSERT INTO pedidos (tienda_id, cliente_id, estado, subtotal, envio, total) VALUES
(1, (SELECT id FROM clientes WHERE tienda_id = 1 AND email = 'ana@example.com'), 'pendiente', 5.70, 2.00, 7.70);

INSERT INTO pedido_items (tienda_id, pedido_id, producto_id, nombre_producto, cantidad, precio_unitario) VALUES
(1, (SELECT id FROM pedidos  WHERE tienda_id = 1 AND cliente_id = (SELECT id FROM clientes WHERE tienda_id = 1 AND email = 'ana@example.com')),
    (SELECT id FROM productos WHERE tienda_id = 1 AND slug = 'cruasan-mantequilla'), 'Cruasán de mantequilla', 1, 2.50),
(1, (SELECT id FROM pedidos  WHERE tienda_id = 1 AND cliente_id = (SELECT id FROM clientes WHERE tienda_id = 1 AND email = 'ana@example.com')),
    (SELECT id FROM productos WHERE tienda_id = 1 AND slug = 'cafe-espresso'),      'Café espresso',         1, 1.80);

-- Restablece el tenant (sesión limpia tras el seed)
SELECT app.set_tenant(NULL);

COMMIT;


-- ============================================================
-- PARTE 3: MIGRACIONES (configurador, contenido, contactos)
-- ============================================================
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
-- ============================================================
-- Migración 002: Tamaño y altura por separado + bloqueo de pasos
-- 1. Nuevo grupo 'altura' en opciones (CHECK constraint ampliado)
-- 2. Los 6 tamaños mezclados (Small/Medium/Large x Regular/Tall)
--    se dividen en: tamano = diámetro (precio base) y
--                   altura = Regular (+0) / Tall (+15)
-- Idempotente: se puede ejecutar varias veces sin error.
-- ============================================================

BEGIN;

-- 1. Ampliar el CHECK para admitir el grupo 'altura'
ALTER TABLE opciones DROP CONSTRAINT IF EXISTS opciones_grupo_check;
ALTER TABLE opciones ADD CONSTRAINT opciones_grupo_check
    CHECK (grupo IN ('tamano','altura','bizcocho','relleno','decoracion','extra'));

-- 2. Reestructurar los tamaños: 3 diámetros + 2 alturas
--    (se eliminan las 6 combinaciones; los IDs viejos quedan solo
--     como snapshot en pedidos históricos, sin romper nada).
DELETE FROM opciones WHERE grupo = 'tamano';

INSERT INTO opciones (tienda_id, grupo, nombre, descripcion, precio, posicion) VALUES
(1, 'tamano', 'Small (15 cm)',   'Tarta de 15 cm de diámetro.',  30.00, 1),
(1, 'tamano', 'Medium (20 cm)',  'Tarta de 20 cm de diámetro.',  40.00, 2),
(1, 'tamano', 'Large (25 cm)',   'Tarta de 25 cm de diámetro.',  50.00, 3),

(1, 'altura', 'Regular',         'Altura regular estándar.',     0.00,  1),
(1, 'altura', 'Tall',            'Tarta más alta (+15 €).',     15.00,  2);

COMMIT;
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


COMMIT;
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

-- ============================================================
-- PARTE 4: SEED KOKORO CAKES (catálogo real + configurador)
-- ============================================================
-- ============================================================
-- BakeryCloud - Seed para la tienda Kokoro Cakes
-- Pastelería personalizada de Barcelona (@kokorocakess en IG)
-- Catálogo basado en los productos reales publicados en su perfil.
-- ============================================================

BEGIN;

-- Renombra la tienda 1 (tenía el slug de ejemplo)
UPDATE tiendas
   SET slug        = 'kokorocakes',
       nombre      = 'Kokoro Cakes',
       descripcion = 'Pasteles personalizados en Barcelona. Bento cakes, mini cakes y tartas vintage con buttercream de merengue suizo. Baking hearts to fill yours.'
 WHERE slug = 'la-casa-del-cruasan';

-- Activa el tenant 1 (Row Level Security)
SELECT app.set_tenant(1);

-- El seed base (seed.sql) crea un pedido de ejemplo que referencia productos
-- de la tienda 1; se elimina para poder reconstruir el catálogo de Kokoro Cakes.
DELETE FROM pedido_items WHERE tienda_id = 1;
DELETE FROM pedidos    WHERE tienda_id = 1;
DELETE FROM clientes   WHERE tienda_id = 1;

-- Limpia el catálogo anterior de esta tienda
DELETE FROM productos  WHERE tienda_id = 1;
DELETE FROM categorias WHERE tienda_id = 1;

-- ------------------------------------------------------------
-- Categorías
-- ------------------------------------------------------------
INSERT INTO categorias (tienda_id, nombre, posicion) VALUES
(1, 'Bento Cakes',          1),
(1, 'Kokoro Tins',          2),
(1, 'Mini Cakes',           3),
(1, 'Tartas personalizadas', 4);

-- ------------------------------------------------------------
-- Productos (precios publicados en el perfil)
-- ------------------------------------------------------------
INSERT INTO productos (tienda_id, categoria_id, slug, nombre, descripcion, ingredientes, precio, stock, disponible) VALUES
-- Bento Cakes 4" — 14 € (8M) / 12 € (Navidad)
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Bento Cakes'),
 'bento-chocograve', 'Bento Cake Chocograve',
 'Bento cake de 10 cm: bizcocho de chocolate súper húmedo, relleno de Nutella y pepitas de chocolate.',
 'Bizcocho de chocolate, Nutella, pepitas de chocolate, mantequilla, huevos, harina de trigo, azúcar.', 14.00, 6, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Bento Cakes'),
 'bento-milky-heaven', 'Bento Cake Milky Heaven',
 'Bento cake de 10 cm: bizcocho de vainilla bañado en tres leches, relleno de dulce de leche.',
 'Bizcocho de vainilla, tres leches, dulce de leche, nata, mantequilla, huevos, harina de trigo, azúcar.', 14.00, 6, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Bento Cakes'),
 'bento-sweet-vanilla', 'Bento Cake Sweet Vanilla',
 'Bento cake de 10 cm: bizcocho de vainilla relleno de crema de queso y buttercream de merengue suizo.',
 'Bizcocho de vainilla, crema de queso, mantequilla, claras de huevo, azúcar, harina de trigo.', 14.00, 6, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Bento Cakes'),
 'bento-lemon-berry', 'Bento Cake Lemon Berry',
 'Bento cake de 10 cm: bizcocho de vainilla esponjoso con crema de limón y frosting de arándanos.',
 'Bizcocho de vainilla, crema de limón, arándanos, nata, mantequilla, huevos, harina de trigo, azúcar.', 14.00, 6, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Bento Cakes'),
 'bento-ube-dream', 'Bento Cake Ube Dream',
 'Bento cake de 10 cm: bizcocho de ube (ñame morado) relleno de chocolate blanco y frosting de ube.',
 'Bizcocho de ube (ñame morado), chocolate blanco, mantequilla, huevos, harina de trigo, azúcar.', 14.00, 6, TRUE),

-- Kokoro Tins — mini cakes horneados (recogida en fin de semana)
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Kokoro Tins'),
 'tin-cookies-cream', 'Kokoro Tin Cookies & Cream',
 'Bizcocho de chocolate, buttercream de merengue suizo de Oreo y Oreo triturada.',
 'Bizcocho de chocolate, galletas Oreo, mantequilla, claras de huevo, azúcar, harina de trigo.', 7.50, 10, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Kokoro Tins'),
 'tin-lotus-dream', 'Kokoro Tin Lotus Dream',
 'Bizcocho de vainilla con galleta Lotus, buttercream Lotus, crema y crumble de galleta.',
 'Bizcocho de vainilla, galleta Lotus, buttercream Lotus, mantequilla, huevos, harina de trigo, azúcar.', 7.50, 10, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Kokoro Tins'),
 'tin-salted-caramel', 'Kokoro Tin Salted Caramel Bliss',
 'Bizcocho de chocolate, buttercream salted caramel y drizzle de caramelo salado casero.',
 'Bizcocho de chocolate, caramelo salado, mantequilla, claras de huevo, sal marina, azúcar, harina de trigo.', 7.50, 10, TRUE),

-- Mini Cakes — 4 €
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Mini Cakes'),
 'mini-cookies-cream', 'Mini Cake Cookies & Cream',
 'Mini cake de bizcocho de chocolate con crema de Oreo.',
 'Bizcocho de chocolate, crema de Oreo, mantequilla, huevos, harina de trigo, azúcar.', 4.00, 20, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Mini Cakes'),
 'mini-milky-heaven', 'Mini Cake Milky Heaven',
 'Mini cake de tres leches con una fina capa de dulce de leche y toque de canela.',
 'Bizcocho de vainilla, tres leches, dulce de leche, canela, mantequilla, huevos, harina de trigo, azúcar.', 4.00, 20, TRUE),

-- Tartas personalizadas (estilo vintage / coquette)
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Tartas personalizadas'),
 'tarta-chocolate-dulce-leche', 'Tarta de chocolate y dulce de leche',
 'Tarta mediana de chocolate rellena de dulce de leche y fresas frescas. Decoración clásica vintage.',
 'Bizcocho de chocolate, dulce de leche, fresas frescas, nata, mantequilla, huevos, harina de trigo, azúcar.', 48.00, 2, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Tartas personalizadas'),
 'tarta-vainilla-lotus', 'Tarta de vainilla y Lotus',
 'Tarta alta de vainilla con relleno de Lotus, decoración vintage, lettering y perlas.',
 'Bizcocho de vainilla, galleta Lotus, buttercream Lotus, mantequilla, huevos, harina de trigo, azúcar.', 45.00, 2, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Tartas personalizadas'),
 'tarta-corazon-vintage', 'Tarta corazón vintage',
 'Tarta mediana alta en forma de corazón de vainilla con dulce de leche y crumble de Oreo. Decoración full vintage.',
 'Bizcocho de vainilla, dulce de leche, galletas Oreo, mantequilla, huevos, harina de trigo, azúcar.', 52.00, 2, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Tartas personalizadas'),
 'tarta-encargo', 'Tarta personalizada a medida',
 'Construye tu tarta: elige tamaño, bizcocho, relleno y decoración. Diseños únicos estilo vintage y coquette.',
 'Según tu combinación: bizcocho, relleno y decoración a elegir en el configurador.', 0.00, 99, TRUE);

-- Los productos que no tienen foto publicada en el perfil se dejan
-- en la BD pero marcados como no disponibles (no se muestran en la web).
UPDATE productos SET disponible = FALSE WHERE tienda_id = 1 AND slug IN
('bento-milky-heaven', 'bento-lemon-berry', 'tin-lotus-dream',
 'mini-milky-heaven', 'tarta-vainilla-lotus');

-- ------------------------------------------------------------
-- Opciones del configurador (catálogo oficial del PDF "Catalogo ESP")
-- Precios publicados: tamaños con precio base; el resto son deltas.
-- ------------------------------------------------------------
DELETE FROM opciones WHERE tienda_id = 1;

INSERT INTO opciones (tienda_id, grupo, nombre, descripcion, precio, posicion) VALUES
-- Tamaños (diámetro: precio base de la tarta)
(1, 'tamano',     'Small (15 cm)',               'Tarta de 15 cm de diámetro.',           30.00, 1),
(1, 'tamano',     'Medium (20 cm)',              'Tarta de 20 cm de diámetro.',           40.00, 2),
(1, 'tamano',     'Large (25 cm)',               'Tarta de 25 cm de diámetro.',           50.00, 3),

-- Alturas (suplemento sobre el tamaño)
(1, 'altura',     'Regular',                     'Altura regular estándar.',               0.00, 1),
(1, 'altura',     'Tall',                        'Tarta más alta (+15 €).',               15.00, 2),

-- Bizcochos (sabor de la base)
(1, 'bizcocho',   'Vainilla',                   'Bizcocho esponjoso de vainilla.',          0.00, 1),
(1, 'bizcocho',   'Chocolate',                  'Bizcocho de chocolate.',                   0.00, 2),
(1, 'bizcocho',   'Fresa',                      'Bizcocho de fresa.',                       0.00, 3),
(1, 'bizcocho',   'Cookies',                    'Bizcocho con trozos de cookies.',          3.00, 4),
(1, 'bizcocho',   'Tres Leches',                'Bizcocho bañado en tres leches.',          3.50, 5),
(1, 'bizcocho',   'Matcha',                     'Bizcocho de té matcha.',                   5.00, 6),

-- Rellenos
(1, 'relleno',    'Mermelada de fresa',         'Relleno de mermelada de fresa.',           0.00, 1),
(1, 'relleno',    'Ganache de chocolate',       'Ganache de chocolate blanco o negro.',     0.00, 2),
(1, 'relleno',    'Queso crema',                'Relleno cremoso de queso crema.',          0.00, 3),
(1, 'relleno',    'Crema de limón',             'Crema de limón fresca.',                   3.00, 4),
(1, 'relleno',    'Crema pastelera',            'Crema pastelera clásica.',                 3.00, 5),
(1, 'relleno',    'Caramelo',                   'Relleno de caramelo.',                     3.00, 6),
(1, 'relleno',    'Dulce de leche',             'Relleno de dulce de leche.',               4.00, 7),
(1, 'relleno',    'Lotus biscott',              'Crema de galleta Lotus.',                  4.00, 8),

-- Decoración (estilos y extras decorativos)
(1, 'decoracion', 'Classic',                    'Decoración en la parte superior e inferior.',        0.00, 1),
(1, 'decoracion', 'Full Vintage',               'Diseño vintage completo (envía tu foto de referencia).', 4.00, 2),
(1, 'decoracion', 'Texto',                      'Texto personalizado en frosting o chocolate.',       3.00, 3),
(1, 'decoracion', 'Purpurina',                  'Brillo comestible solo en la parte superior.',       8.00, 4),
(1, 'decoracion', 'Full Purpurina',             'Pastel cubierto completamente de purpurina.',       10.00, 5),
(1, 'decoracion', 'Cerezas',                    'Cerezas decorativas.',                               5.00, 6),
(1, 'decoracion', 'Cerezas de purpurina',       'Cerezas bañadas en purpurina.',                      8.00, 7),
(1, 'decoracion', 'Texto de perlas',            'Texto formado con perlas.',                          4.00, 8),
(1, 'decoracion', 'Perlas',                     'Pastel decorado con unas cuantas perlas.',          4.00, 9),
(1, 'decoracion', 'Cadena de perlas',           'Cadena completa de perlas.',                         10.00, 10),
(1, 'decoracion', 'Imagen personalizada',       'Imagen comestible personalizada en la parte superior.', 12.00, 11),
(1, 'decoracion', 'Burnaway',                   'Tarta viral: la imagen frontal se quema y muestra otra.', 15.00, 12),
(1, 'decoracion', 'Mariposas',                  'Mariposas decorativas.',                             10.00, 13),
(1, 'decoracion', 'Lazos',                      'Lazos decorativos.',                                 5.00, 14),

-- Extras (por unidad)
(1, 'extra',      'Trozos de Oreo',             'Trozos de galleta Oreo.',                 2.50, 1),
(1, 'extra',      'Trozos de Kit Kat',          'Trozos de Kit Kat.',                      2.50, 2),
(1, 'extra',      'Trozos de galleta',          'Trozos de galleta.',                      2.50, 3),
(1, 'extra',      'Trozos Kinder Bueno',        'Trozos de Kinder Bueno.',                 2.50, 4),
(1, 'extra',      'Fruta fresca',               'Fresa, cereza, melocotón, mango o kiwi.', 2.50, 5);

-- Restablece el tenant (sesión limpia)
SELECT app.set_tenant(NULL);

COMMIT;
