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
├── backend/                    # REST API Node.js/Express
│   ├── src/
│   │   ├── config/             # env, conexión BD
│   │   ├── middleware/         # resolución de tienda (tenant), errores
│   │   ├── controllers/        # lógica de endpoints
│   │   ├── routes/             # rutas: /api/productos, /api/pedidos...
│   │   ├── models/             # acceso a datos SQL
│   │   ├── services/           # lógica de negocio
│   │   └── utils/              # helpers
│   └── tests/                  # pruebas de la API
├── frontend/                   # SPA/Next.js con carrito y theming
│   ├── src/
│   │   ├── components/         # UI reutilizable
│   │   ├── pages/              # vistas (tienda, producto, carrito)
│   │   ├── store/              # carrito (LocalStorage)
│   │   ├── styles/             # temas por tienda (variables)
│   │   └── utils/              # helpers de front
│   └── public/                 # estáticos (logos, favicon)
├── db/
│   ├── schema.sql              # esquema multi-tenant + RLS
│   ├── seed.sql                # datos de ejemplo
│   └── migrations/             # cambios de esquema versionados
├── docker/
│   └── docker-compose.yml      # PostgreSQL (desarrollo local)
├── infra/aws/                  # IaC (semanas 7-8)
│   ├── ec2/                    # servidor de despliegue
│   ├── rds/                    # base de datos gestionada
│   └── s3/                     # almacenamiento de archivos
├── docs/arquitectura/          # documentación técnica
├── .github/workflows/          # CI/CD (semanas 7-8)
├── .env.example
└── README.md
```

## Roadmap (10 semanas · 4h/semana)

- [ ] **Semanas 1-3** — Esquema SQL multi-tenant, repositorio Git, REST API (productos y pedidos)
- [ ] **Semanas 4-6** — Figma, frontend dinámico, carrito en LocalStorage, Docker Compose
- [ ] **Semanas 7-8** — AWS `eu-south-2`, EC2, S3, pipeline GitHub Actions
- [ ] **Semanas 9-10** — Cloudflare (DNS/SSL/CDN), pruebas E2E, alta de segundo subproyecto

## Estado actual

- [x] Estructura del proyecto y repositorio Git
- [x] Estructura completa de carpetas (backend, frontend, db, docker, infra, docs)
- [x] PostgreSQL en Docker + esquema multi-tenant con RLS + seed con 2 tiendas
- [x] Rol de API (`bakery_api`) con aislamiento de tenant verificado
- [x] REST API Node.js/Express: productos, pedidos y resolución de tenant
- [ ] Frontend React/Next.js con carrito y theming
- [ ] Docker Compose completo (API + frontend + BD)
- [ ] AWS `eu-south-2` + CI/CD (semanas 7-8)
- [ ] Cloudflare + lanzamiento (semanas 9-10)
- [ ] Prerrequisitos locales: **Node.js 20+** instalado ✓, **Docker Desktop** instalado ✓

## Arranque de la base de datos (local)

```bash
# 1. Levantar PostgreSQL
docker compose -f docker/docker-compose.yml up -d

# 2. Aplicar esquema, rol y seed (en este orden)
Get-Content db/schema.sql -Raw | docker exec -i bakerycloud-postgres psql -U bakery -d bakerycloud -v ON_ERROR_STOP=1
Get-Content db/roles.sql   -Raw | docker exec -i bakerycloud-postgres psql -U bakery -d bakerycloud -v ON_ERROR_STOP=1
Get-Content db/seed.sql    -Raw | docker exec -i bakerycloud-postgres psql -U bakery -d bakerycloud -v ON_ERROR_STOP=1
```

Nota: la API se conectará con el rol `bakery_api` (NO dueño de las tablas).
PostgreSQL bypassa RLS para el dueño, por eso existe un rol separado de la API.

## REST API (Node.js/Express)

```bash
cd backend
cp .env.example .env   # ajustar credenciales si es necesario
npm install
npm run dev            # http://localhost:3000
```

Endpoints (el tenant se resuelve por cabecera `X-Tenant-Slug` en desarrollo):

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado y tienda activa |
| GET | `/api/productos` | Productos de la tienda activa |
| GET | `/api/productos/:slug` | Detalle de un producto |
| GET | `/api/pedidos` | Pedidos de la tienda activa |
| POST | `/api/pedidos` | Crea un pedido `{ cliente: {nombre,email}, items: [{producto_id, cantidad}] }` |
