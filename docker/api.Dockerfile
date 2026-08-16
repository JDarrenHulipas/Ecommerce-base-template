# ============================================================
# BakeryCloud - Imagen del backend (API + frontend estático)
#
# El context de build es la RAÍZ del repositorio (../ desde docker/),
# porque la app Express sirve el frontend desde ../frontend.
#   build: { context: .., dockerfile: docker/api.Dockerfile }
# ============================================================

FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Dependencias primero (mejor cache de capas)
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

# Código y estáticos del frontend
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Carpeta de imágenes subidas (volumen en docker-compose)
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

# El contenedor debe ser ejecutado como usuario no-root
USER node

EXPOSE 3000
CMD ["node", "backend/src/server.js"]
