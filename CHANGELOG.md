# Changelog de BakeryCloud

Registro de todo lo que se sube al repositorio en cada `git push`.
Cada entrada indica qué funcionalidad se añadió y cómo usarla.

## [0.1.0] - 2026-08-14 — Primer push (estructura + BD + API)

### Estructura del proyecto (commit `ceaf0aa`, `bcd57be`)
Monorepo con separación por capas, listo para crecer sin reescribir:

```
bakerycloud/
├── backend/          # REST API Node.js/Express
├── frontend/         # SPA/Next.js (en construcción)
├── db/               # Esquema SQL, seed, roles
├── docker/           # Docker Compose
├── infra/aws/        # IaC (semanas 7-8)
├── docs/arquitectura/
└── .github/workflows/ # CI/CD (semanas 7-8)
```

### Base de datos PostgreSQL multi-tenant (commits `2bc0350`, `15e8220`)
- Esquema con patrón *shared database + shared schema* + **Row Level Security**.
- Tablas: `tiendas`, `categorias`, `productos`, `clientes`, `pedidos`, `pedido_items`.
- Claves primarias compuestas `(tienda_id, id)`: cada tienda queda aislada a nivel de motor.
- Funciones `app.set_tenant()` / `app.current_tenant()` para fijar la tienda activa por sesión.
- Rol `bakery_api` (NO dueño de tablas) → RLS le aplica de verdad. Privilegios mínimos.
- Seed re-ejecutable con 2 tiendas de ejemplo:
  - `la-casa-del-cruasan` (La Casa del Cruasán): 3 categorías, 4 productos.
  - `dulces-maribel` (Dulces Maribel): 2 categorías, 2 productos.

**Cómo usarlo:** ver README, sección "Arranque de la base de datos".

### REST API (commit `2e12e67`)
API Express con resolución de tenant por cabecera `X-Tenant-Slug`.

| Método | Ruta | Funcionalidad |
|---|---|---|
| GET | `/api/health` | Estado de la API y tienda activa |
| GET | `/api/productos` | Lista los productos de la tienda activa |
| GET | `/api/productos/:slug` | Detalle de un producto |
| GET | `/api/pedidos` | Pedidos de la tienda activa |
| POST | `/api/pedidos` | Crea pedido: `{ cliente:{nombre,email}, items:[{producto_id, cantidad}] }` |

Claves técnicas:
- Cada request usa su propia conexión del pool y fija `SET app.tienda_id` → RLS filtra por request.
- El POST de pedidos es transaccional: alta/recuperación de cliente (`ON CONFLICT`), cálculo de precios desde la BD (nunca confiar en el cliente), snapshot del nombre del producto en la línea.
- Manejo de ids BIGINT: PostgreSQL los devuelve como string; normalizar con `String(id)`.

**Cómo usarlo:**
```bash
cd backend
cp .env.example .env
npm install
npm run dev
# GET con cabecera: X-Tenant-Slug: la-casa-del-cruasan
```

---

## Plantilla para próximos pushes

Copiar y rellenar esta plantilla en cada `git push`:

## [X.Y.Z] - FECHA — DESCRIPCIÓN CORTA

### Funcionalidad añadida (commit `XXXXXXX`)
- Qué hace la nueva pieza.
- Cómo usarla (comando o endpoint).
- Decisiones técnicas relevantes.

### Corregido
- Errores encontrados y su solución.
