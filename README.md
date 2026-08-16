# BakeryCloud — Plataforma E-Commerce Multi-Tenant y Automatizada

> Código en clave: **BakeStack / Obrador Digital**
> Plataforma e-commerce de marca blanca (white-label), inicialmente orientada a un negocio de repostería/pastelería artesanal. Motor reutilizable para desplegar múltiples tiendas sin reescribir código ni duplicar infraestructura.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | JavaScript vanilla (SPA) + Design System basado en variables de tema |
| Backend | Node.js + Express (REST API multi-tenant) |
| Base de datos | PostgreSQL (multi-tenant con Row Level Security) |
| Almacenamiento | AWS S3 (opcional) con degradado a disco local para desarrollo |
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
│   │   ├── middleware/         # resolución de tienda (tenant) + auth admin
│   │   ├── routes/             # /api/productos, /api/pedidos, /api/opciones, /api/contactos, /api/admin
│   │   └── app.js, server.js   # montaje de rutas + servidor
│   ├── tests/                  # suites de integración (node:test)
│   │   ├── api.test.js         # health, productos, pedidos, opciones, contactos
│   │   ├── admin.test.js       # panel admin (login JWT, CRUD de stock, aislamiento)
│   │   └── e2e.test.js         # Playwright (tienda + panel admin)
│   └── src/app.js              # app Express (reutilizable por los tests)
├── frontend/                   # SPA vanilla con carrito y theming
│   ├── index.html
│   ├── admin/                  # panel de administración (login, productos, pedidos, contactos y contenido)
│   │   ├── index.html
│   │   ├── admin.js
│   │   └── admin.css
│   ├── src/
│   │   ├── app.js              # lógica: grid, carrito, modal, configurador, toasts
│   │   ├── store/cart.js       # carrito (LocalStorage, claves por configuración)
│   │   ├── utils/api.js        # cliente fetch de la API
│   │   └── styles/main.css     # tema por tienda (variables)
│   └── public/                 # estáticos (logos, favicon, imágenes)
├── db/
│   ├── schema.sql              # esquema multi-tenant + RLS
│   ├── roles.sql               # rol bakery_api (privilegios mínimos)
│   ├── seed.sql                # datos de ejemplo
│   ├── seed_kokoro.sql         # catálogo de Kokoro Cakes
│   └── migrations/             # cambios de esquema versionados (001-003)
├── docker/
│   ├── docker-compose.yml      # stack completo (web + api + postgres) [dev]
│   ├── docker-compose.prod.yml # stack de producción (web + api, sin postgres local)
│   ├── api.Dockerfile          # imagen del backend (API + estáticos)
│   ├── nginx.Dockerfile        # imagen del frontend (nginx)
│   ├── nginx.conf              # proxy de /api + SPA
│   ├── init/                   # inicialización automática de la BD (1ª vez)
│   └── deploy.sh               # script de despliegue en la EC2 (BD + stack)
├── infra/aws/                  # IaC con Terraform (semanas 7-8)
│   ├── providers.tf            # backend AWS + estado
│   ├── network.tf              # VPC, subredes, security groups, IP elástica
│   ├── ec2.tf                  # instancia de aplicación (Docker)
│   ├── rds.tf                  # PostgreSQL 16 gestionado
│   ├── s3.tf                   # bucket de imágenes subidas
│   ├── iam.tf                  # rol de instancia para S3
│   ├── outputs.tf / variables.tf
│   ├── ec2/user_data.sh        # bootstrap de la EC2 (Docker + compose)
│   └── README.md               # guía de despliegue e infraestructura
├── docs/arquitectura/          # documentación técnica
├── .github/workflows/deploy.yml # CI/CD: tests + deploy por SSH a EC2
├── .env.example
└── README.md
```

## Roadmap (10 semanas · 4h/semana)

- [x] **Semanas 1-3** — Esquema SQL multi-tenant, repositorio Git, REST API (productos y pedidos)
- [x] **Semanas 4-6** — Figma, frontend dinámico, carrito en LocalStorage, Docker Compose
- [x] **Semanas 7-8** — AWS `eu-south-2`, EC2, S3, pipeline GitHub Actions
- [ ] **Semanas 9-10** — Cloudflare (DNS/SSL/CDN), pruebas E2E, alta de segundo subproyecto

## Estado actual

- [x] Estructura del proyecto y repositorio Git
- [x] Estructura completa de carpetas (backend, frontend, db, docker, infra, docs)
- [x] PostgreSQL en Docker + esquema multi-tenant con RLS + seed con 2 tiendas
- [x] Rol de API (`bakery_api`) con aislamiento de tenant verificado
- [x] REST API Node.js/Express: productos, pedidos, opciones del configurador y contactos
- [x] Frontend SPA: catálogo dinámico, modal de detalle, carrito en LocalStorage
- [x] Docker Compose completo (frontend nginx + API + PostgreSQL) con init automático de la BD
- [x] Configurador "Construye tu tarta" (tamaño, altura, bizcocho, relleno, decoración, extras) con precio en vivo y snapshot JSONB en el pedido
- [x] Formulario de contacto real (guarda consultas por tienda) + toasts de aviso en toda la página
- [x] Panel de administración (`/admin/`): login con JWT, selector de tienda, crear/editar/eliminar productos (imagen, stock, precio, disponibilidad, ingredientes) y pestañas de Pedidos (con cambio de estado) y Contactos
- [x] Panel de administración: pestaña "Contenido de la portada" para editar anuncios, hero, nosotros, contacto y footer (por tienda)
- [x] Subida de imágenes del admin con doble almacenamiento: disco local (desarrollo) o **S3** (producción), misma URL pública
- [x] Suite de integración del backend (health, productos, pedidos, opciones, contactos, contenido, admin) + tests E2E de Playwright
- [x] AWS `eu-south-2` con Terraform: VPC, EC2 (Docker), RDS PostgreSQL 16, S3 e IAM
- [x] CI/CD con GitHub Actions: tests automáticos + deploy a la EC2 por SSH (init/migraciones de BD idempotentes)
- [ ] Cloudflare + lanzamiento (semanas 9-10)
- [x] Prerrequisitos locales: **Node.js 20+** instalado ✓, **Docker Desktop** instalado ✓

## Arranque (local) — Docker Compose completo

El stack completo (frontend + API + BD) se levanta con **un solo comando**:

```bash
# 1. Levantar frontend + API + PostgreSQL (la 1ª vez construye e inicializa la BD)
docker compose -f docker/docker-compose.yml up -d --build

# 2. Comprobar que está sano
docker compose -f docker/docker-compose.yml ps
```

| Servicio | URL |
|---|---|
| Tienda (frontend nginx) | http://localhost:8080 |
| Panel de administración | http://localhost:8080/admin/ |
| REST API | http://localhost:3000 |

Detener / borrar todo (incluida la BD):

```bash
docker compose -f docker/docker-compose.yml down        # detener sin borrar datos
docker compose -f docker/docker-compose.yml down -v     # borrar también la BD
```

> La BD se inicializa **solo la primera vez** (schema → roles → seed → migraciones → seed de Kokoro). Si cambias `db/*.sql`, borra el volumen con `down -v` para regenerarla.

## Despliegue en AWS (producción)

La infraestructura vive en `infra/aws/` (Terraform) y el pipeline de CI/CD en
`.github/workflows/deploy.yml`. Guía completa: **`infra/aws/README.md`**.

```bash
# 1. Crear la infraestructura (una vez)
cd infra/aws
terraform init && terraform apply

# 2. Configurar los secretos en GitHub (ver infra/aws/README.md) y hacer push a master
git push origin master   # tests → deploy automático a la EC2
```

El primer despliegue inicializa la BD de RDS automáticamente (schema → roles →
seed → migraciones → seed de Kokoro) usando `DB_INIT_URL`; en los siguientes
solo aplica las migraciones, sin tocar los datos. Con `S3_BUCKET` definido, las
imágenes del admin se guardan en S3 en vez del disco local.

### Alternativa: arranque manual (desarrollo con `node`)

```bash
# 1. Solo PostgreSQL
docker compose -f docker/docker-compose.yml up -d

# 2. Aplicar esquema, rol y seed (en este orden)
Get-Content db/schema.sql -Raw | docker exec -i bakerycloud-postgres psql -U bakery -d bakerycloud -v ON_ERROR_STOP=1
Get-Content db/roles.sql   -Raw | docker exec -i bakerycloud-postgres psql -U bakery -d bakerycloud -v ON_ERROR_STOP=1
Get-Content db/seed.sql    -Raw | docker exec -i bakerycloud-postgres psql -U bakery -d bakerycloud -v ON_ERROR_STOP=1

# 3. Aplicar las migraciones versionadas (en orden)
Get-ChildItem db/migrations/*.sql | ForEach-Object {
  Get-Content $_.FullName -Raw | docker exec -i bakerycloud-postgres psql -U bakery -d bakerycloud -v ON_ERROR_STOP=1
}

# 4. Catálogo real de Kokoro Cakes
Get-Content db/seed_kokoro.sql -Raw | docker exec -i bakerycloud-postgres psql -U bakery -d bakerycloud -v ON_ERROR_STOP=1

# 5. API en local
cd backend
npm install
npm run dev   # http://localhost:3000
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
| GET | `/api/opciones` | Catálogo del configurador (tarta base + opciones agrupadas) |
| GET | `/api/pedidos` | Pedidos de la tienda activa |
| POST | `/api/pedidos` | Crea un pedido `{ cliente: {nombre,email}, items: [{producto_id, cantidad, configuracion?}] }` |
| GET | `/api/contactos` | Consultas del formulario de contacto de la tienda activa |
| POST | `/api/contactos` | Guarda una consulta `{ nombre, email, mensaje }` |
| GET | `/api/contenido` | Textos de la portada (anuncios, hero, nosotros, contacto, footer) de la tienda activa |
| POST | `/api/admin/login` | Login admin con `ADMIN_PASSWORD` → JWT (cabecera `X-Tenant-Slug` elige la tienda) |
| GET | `/api/admin/tiendas` | Lista las tiendas del sistema (requiere token) |
| GET | `/api/admin/productos` | Catálogo completo de la tienda activa, incluye ingredientes (requiere token) |
| POST | `/api/admin/productos` | Crea un producto `{ nombre, categoria?, imagen?, precio?, stock?, ... }`; slug autogenerado y categoría auto-creada (requiere token) |
| PATCH | `/api/admin/productos/:id` | Actualiza stock, precio, disponibilidad, nombre, descripción, ingredientes o imagen (`imagen_s3`, URL) (requiere token) |
| DELETE | `/api/admin/productos/:id` | Elimina un producto; 409 si tiene pedidos asociados (requiere token) |
| GET | `/api/admin/pedidos` | Pedidos de la tienda activa con cliente e items (requiere token) |
| PATCH | `/api/admin/pedidos/:id/estado` | Cambia el estado de un pedido `{ estado: "confirmado"|"enviado"|"entregado"|"cancelado" }` (requiere token) |
| GET | `/api/admin/contactos` | Consultas del formulario de contacto de la tienda activa (requiere token) |
| GET | `/api/admin/contenido` | Textos editables de la portada de la tienda activa (requiere token) |
| PUT | `/api/admin/contenido` | Guarda los textos de la portada `{ contenido: [{ clave, valor }] }` (requiere token) |
| POST | `/api/admin/imagenes` | Sube una imagen (multipart, campo `file`; JPEG/PNG/WebP/GIF, máx. 5 MB) → `{ url: "/api/imagenes/<archivo>" }` (requiere token) |
| DELETE | `/api/admin/imagenes/:archivo` | Borra un archivo de imagen subido; 404 si no existe (requiere token) |
| GET | `/api/imagenes/<archivo>` | Público: sirve las imágenes subidas por el admin (desde S3 o disco local según `S3_BUCKET`) |

> El panel admin vive en `http://localhost:3000/admin/` y guarda el JWT en
> LocalStorage. Solo edita la tienda seleccionada (RLS): los productos de otras
> tiendas son invisibles para la API admin.

### Configurador de tartas (frontend)

La tarjeta **"Construye tu tarta"** abre un asistente de 6 pasos (tamaño, altura, bizcocho, relleno, decoración y extras) con precio en vivo. El carrito guarda cada combinación como una línea independiente (clave JSON en LocalStorage) y el pedido calcula el precio **desde la BD** (nunca confía en el cliente), guardando un snapshot JSONB en `pedido_items.configuracion`.

### Tests

```bash
cd backend
npm test          # toda la suite de integración (health, productos, pedidos, opciones, contactos, admin)
npm run test:api  # solo api.test.js + admin.test.js
npm run test:admin # solo admin.test.js
npm run test:e2e  # Playwright (requiere el servidor en :3000 y Chromium descargado)
```

Configuración para el panel admin en `.env`:

```
ADMIN_PASSWORD=super-secreto
ADMIN_SECRET=clave-firma-jwt
```

Almacenamiento de imágenes en `.env`:

```
# Sin S3_BUCKET → disco local (UPLOAD_DIR, por defecto backend/uploads)
S3_BUCKET=bakerycloud-prod-uploads
S3_REGION=eu-south-2
```

Si faltan `ADMIN_PASSWORD`/`ADMIN_SECRET`, las rutas `/api/admin` responden
**503** (panel no disponible) y los tests de login se marcan como
fallidos/saltados.
