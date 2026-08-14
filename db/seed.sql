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
