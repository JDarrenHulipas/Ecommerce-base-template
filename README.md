# BakeryCloud — Plataforma E-Commerce Multi-Tenant y Automatizada

> Código en clave: **BakeStack / Obrador Digital**
> Plataforma e-commerce de marca blanca (white-label), inicialmente orientada a un negocio de repostería/pastelería artesanal. Motor reutilizable para desplegar múltiples tiendas sin reescribir código ni duplicar infraestructura.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | JavaScript / React (Next.js) + Design System basado en variables de tema |
| Backend | Node.js + Express (REST API multi-tenant) |
| Base de datos | PostgreSQL (multi-tenant con Row Level Security) |
| Almacenamiento | AWS S3 (bucket organizado por `/tienda-id/`) |
| Servidores | AWS región España `eu-south-2` (EC2 / RDS) |
| Contenedores | Docker + Docker Compose |
| Red / CDN | Cloudflare (DNS, SSL, caché) |
| CI/CD | GitHub Actions (deploy con `git push main`) |

## Estructura del proyecto

```
bakerycloud/
├── backend/            # REST API Node.js/Express
│   └── src/
├── frontend/           # SPA/Next.js con carrito y theming por tienda
│   └── src/
├── db/                 # Esquema SQL, seeds y migraciones
│   └── schema.sql
├── docker/             # Docker Compose y config de contenedores
├── .github/workflows/  # Pipelines de CI/CD
└── README.md
```

## Roadmap (10 semanas · 4h/semana)

- [ ] **Semanas 1-3** — Esquema SQL multi-tenant, repositorio Git, REST API (productos y pedidos)
- [ ] **Semanas 4-6** — Figma, frontend dinámico, carrito en LocalStorage, Docker Compose
- [ ] **Semanas 7-8** — AWS `eu-south-2`, EC2, S3, pipeline GitHub Actions
- [ ] **Semanas 9-10** — Cloudflare (DNS/SSL/CDN), pruebas E2E, alta de segundo subproyecto

## Estado actual

- [x] Estructura del proyecto y repositorio Git
- [ ] Prerrequisitos locales: **Docker Desktop** y **Node.js 20+** (pendientes de instalar)
- [ ] Esquema SQL (borrador en `db/schema.sql`)

## Arranque local (próximamente)

```bash
# 1. Levantar la base de datos (requiere Docker Desktop)
docker compose -f docker/docker-compose.yml up -d

# 2. Aplicar el esquema
# (comando pendiente de definir en el paso de BD)

# 3. Lanzar la API
cd backend
npm install
npm run dev
```
