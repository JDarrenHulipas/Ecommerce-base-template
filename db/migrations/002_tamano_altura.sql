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
