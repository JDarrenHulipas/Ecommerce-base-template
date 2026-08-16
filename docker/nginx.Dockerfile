# ============================================================
# BakeryCloud - Imagen del frontend servido por nginx
#
# Sirve los estáticos de frontend/ y hace proxy de /api hacia
# el servicio `api` (nombre interno de la red de Docker Compose).
#   build: { context: .., dockerfile: docker/nginx.Dockerfile }
# ============================================================

FROM nginx:1.27-alpine

# Página, JS/CSS y panel admin
COPY frontend/index.html /usr/share/nginx/html/index.html
COPY frontend/src/ /usr/share/nginx/html/src/
COPY frontend/admin/ /usr/share/nginx/html/admin/

# Contenido público en la raíz: /img/*.jpg y /favicon.ico
COPY frontend/public/ /usr/share/nginx/html/

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
