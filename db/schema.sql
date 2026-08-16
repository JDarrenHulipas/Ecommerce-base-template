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
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public;
