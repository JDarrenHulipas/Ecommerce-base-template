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
-- Tamaños (precio base de la tarta)
(1, 'tamano',     'Small Regular (15 cm)',      'Tarta de 15 cm, altura regular.',          30.00, 1),
(1, 'tamano',     'Small Tall (15 cm)',         'Tarta de 15 cm, alta.',                    45.00, 2),
(1, 'tamano',     'Medium Regular (20 cm)',     'Tarta de 20 cm, altura regular.',          40.00, 3),
(1, 'tamano',     'Medium Tall (20 cm)',        'Tarta de 20 cm, alta.',                    55.00, 4),
(1, 'tamano',     'Large Regular (25 cm)',      'Tarta de 25 cm, altura regular.',          50.00, 5),
(1, 'tamano',     'Large Tall (25 cm)',         'Tarta de 25 cm, alta.',                    65.00, 6),

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
