#!/usr/bin/env bash
# ============================================================
# BakeryCloud - Despliegue en producción (EC2)
#
# Requiere un .env en la raíz del repo con (lo escribe el CI):
#   DATABASE_URL, DEFAULT_TENANT_SLUG, ADMIN_PASSWORD, ADMIN_SECRET,
#   S3_BUCKET, S3_REGION y opcional DB_INIT_URL (URL maestra para
#   la primera inicialización de la BD / migraciones).
#
# 1. Levanta api + web con docker compose (producción, sin postgres local).
# 2. Inicializa la BD en RDS la primera vez (schema+roles+seed+migraciones)
#    y en los siguientes despliegues aplica solo las migraciones.
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/.."   # raíz del repositorio

# 1. Imágenes subidas a S3 (opcional). Si no hay S3 se usa el disco local.
if [[ -n "${S3_BUCKET:-}" ]]; then
  echo "==> Imágenes de producto en S3: ${S3_BUCKET}"
else
  echo "==> S3 no configurado: las imágenes se guardarán en el disco local"
fi

# 2. Inicialización de la BD (solo si se ha pasado DB_INIT_URL)
if [[ -n "${DB_INIT_URL:-}" ]]; then
  echo "==> Preparando inicialización/migraciones de la BD..."
  if docker run --rm --network host \
      -e DATABASE_URL="$DB_INIT_URL" \
      postgres:16-alpine \
      sh -c 'psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -tAc "SELECT to_regclass('"'"'public.contenido'"'"');"' \
      | grep -q contenido; then
    echo "==> BD ya inicializada: aplicando solo migraciones"
    docker run --rm --network host \
      -e DATABASE_URL="$DB_INIT_URL" \
      -v "$(pwd)/db:/db:ro" \
      postgres:16-alpine \
      sh -c 'for f in /db/migrations/*.sql; do echo "==> $f"; psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f "$f"; done'
  else
    echo "==> BD nueva: inicialización completa"
    docker run --rm --network host \
      -e DATABASE_URL="$DB_INIT_URL" \
      -v "$(pwd)/db:/db:ro" \
      postgres:16-alpine \
      sh -c 'for f in /db/schema.sql /db/roles.sql /db/seed.sql /db/migrations/*.sql /db/seed_kokoro.sql; do echo "==> $f"; psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f "$f"; done'
  fi
fi

# 3. Construir y levantar api + web
echo "==> Levantando el stack (api + web)..."
docker compose --env-file .env -f docker/docker-compose.prod.yml up -d --build

echo "==> Despliegue completado."
