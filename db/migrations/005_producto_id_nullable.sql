-- ============================================================
-- Migración 005: pedido_items.producto_id admite NULL
-- Un producto con pedidos se puede borrar: la línea de pedido
-- conserva nombre/precio/configuración (historial) y queda
-- desvinculada (producto_id = NULL).
-- Idempotente: se puede ejecutar varias veces sin error.
-- ============================================================

BEGIN;

ALTER TABLE pedido_items ALTER COLUMN producto_id DROP NOT NULL;

COMMIT;
