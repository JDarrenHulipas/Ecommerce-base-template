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
INSERT INTO productos (tienda_id, categoria_id, slug, nombre, descripcion, precio, stock, disponible) VALUES
-- Bento Cakes 4" — 14 € (8M) / 12 € (Navidad)
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Bento Cakes'),
 'bento-chocograve', 'Bento Cake Chocograve',
 'Bento cake de 10 cm: bizcocho de chocolate súper húmedo, relleno de Nutella y pepitas de chocolate.', 14.00, 6, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Bento Cakes'),
 'bento-milky-heaven', 'Bento Cake Milky Heaven',
 'Bento cake de 10 cm: bizcocho de vainilla bañado en tres leches, relleno de dulce de leche.', 14.00, 6, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Bento Cakes'),
 'bento-sweet-vanilla', 'Bento Cake Sweet Vanilla',
 'Bento cake de 10 cm: bizcocho de vainilla relleno de crema de queso y buttercream de merengue suizo.', 14.00, 6, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Bento Cakes'),
 'bento-lemon-berry', 'Bento Cake Lemon Berry',
 'Bento cake de 10 cm: bizcocho de vainilla esponjoso con crema de limón y frosting de arándanos.', 14.00, 6, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Bento Cakes'),
 'bento-ube-dream', 'Bento Cake Ube Dream',
 'Bento cake de 10 cm: bizcocho de ube (ñame morado) relleno de chocolate blanco y frosting de ube.', 14.00, 6, TRUE),

-- Kokoro Tins — mini cakes horneados (recogida en fin de semana)
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Kokoro Tins'),
 'tin-cookies-cream', 'Kokoro Tin Cookies & Cream',
 'Bizcocho de chocolate, buttercream de merengue suizo de Oreo y Oreo triturada.', 7.50, 10, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Kokoro Tins'),
 'tin-lotus-dream', 'Kokoro Tin Lotus Dream',
 'Bizcocho de vainilla con galleta Lotus, buttercream Lotus, crema y crumble de galleta.', 7.50, 10, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Kokoro Tins'),
 'tin-salted-caramel', 'Kokoro Tin Salted Caramel Bliss',
 'Bizcocho de chocolate, buttercream salted caramel y drizzle de caramelo salado casero.', 7.50, 10, TRUE),

-- Mini Cakes — 4 €
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Mini Cakes'),
 'mini-cookies-cream', 'Mini Cake Cookies & Cream',
 'Mini cake de bizcocho de chocolate con crema de Oreo.', 4.00, 20, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Mini Cakes'),
 'mini-milky-heaven', 'Mini Cake Milky Heaven',
 'Mini cake de tres leches con una fina capa de dulce de leche y toque de canela.', 4.00, 20, TRUE),

-- Tartas personalizadas (estilo vintage / coquette)
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Tartas personalizadas'),
 'tarta-chocolate-dulce-leche', 'Tarta de chocolate y dulce de leche',
 'Tarta mediana de chocolate rellena de dulce de leche y fresas frescas. Decoración clásica vintage.', 48.00, 2, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Tartas personalizadas'),
 'tarta-vainilla-lotus', 'Tarta de vainilla y Lotus',
 'Tarta alta de vainilla con relleno de Lotus, decoración vintage, lettering y perlas.', 45.00, 2, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Tartas personalizadas'),
 'tarta-corazon-vintage', 'Tarta corazón vintage',
 'Tarta mediana alta en forma de corazón de vainilla con dulce de leche y crumble de Oreo. Decoración full vintage.', 52.00, 2, TRUE),
(1, (SELECT id FROM categorias WHERE tienda_id = 1 AND nombre = 'Tartas personalizadas'),
 'tarta-encargo', 'Tarta personalizada a medida',
 'Cuéntanos tu idea y la hacemos realidad. Diseños únicos estilo vintage y coquette, decorados con buttercream de merengue suizo. Encargos con 48h de antelación.', 60.00, 3, TRUE);

-- Los productos que no tienen foto publicada en el perfil se dejan
-- en la BD pero marcados como no disponibles (no se muestran en la web).
UPDATE productos SET disponible = FALSE WHERE tienda_id = 1 AND slug IN
('bento-milky-heaven', 'bento-lemon-berry', 'tin-lotus-dream',
 'mini-milky-heaven', 'tarta-vainilla-lotus', 'tarta-encargo');

-- Restablece el tenant (sesión limpia)
SELECT app.set_tenant(NULL);

COMMIT;
