#!/bin/sh
# ============================================================
# BakeryCloud - Inicialización de la BD (se ejecuta SOLO la
# primera vez, cuando el volumen de postgres_data está vacío).
#
# Orden:
#   1. schema.sql (esquema completo: ya incluye opciones, RLS, ...)
#   2. roles.sql  (rol bakery_api)
#   3. seed.sql       (tiendas base + catálogo + pedido demo)
#   4. migraciones 001-003 (003 añade contactos; 001/002 son idempotentes
#      y la 002 inserta tamaño/altura, que el seed_kokoro sobrescribe)
#   5. seed_kokoro.sql (catálogo real de Kokoro Cakes, limpia el pedido demo)
#
# Las migraciones van DESPUÉS del seed (necesitan que exista la tienda 1)
# y ANTES del seed_kokoro (éste borra y vuelve a insertar las opciones).
# ============================================================

set -e

for f in /db/schema.sql /db/roles.sql /db/seed.sql /db/migrations/*.sql /db/seed_kokoro.sql; do
  echo "==> aplicando $f"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
done

echo "==> inicialización de BakeryCloud completada"
