# Changelog de BakeryCloud

Registro de todo lo que se sube al repositorio en cada `git push`.
Cada entrada indica qué funcionalidad se añadió y cómo usarla.

## [0.3.4] - 2026-08-16 — Botón "Siguiente" deshabilitado con color apagado

### Corregido (commit `8f358c9`)
- En el configurador de tartas, "Siguiente" (y "Añadir al carrito") cuando no hay nada seleccionado en el paso actual ahora se ven **visualmente deshabilitados**: fondo beige apagado, opacidad reducida y cursor `not-allowed`, en lugar de tener el color activo normal. Regla global `.btn:disabled`.

**Cómo usarlo:** recargar con **Ctrl+F5**, abrir "Construye tu tarta": "Siguiente" aparece gris/beige hasta elegir una opción.

## [0.3.3] - 2026-08-16 — Popups de aviso (toasts) para todos los errores

### Añadido (commit `57b838f`)
- **Sistema de toasts**: contenedor fijo arriba a la derecha, toasts de error (✕, borde frambuesa), éxito (✓) e información (ℹ), con cierre manual, auto-cierre a los 5 s y animación de entrada/salida. Responsive en móvil (ocupan todo el ancho).
- **Capturadores globales**: `window.onerror` y `unhandledrejection` muestran un toast ante cualquier error no controlado en la página.

### Corregido
- **Configurador sin opciones**: `Api.getOpciones()` fallaba silenciosamente (rejection no capturada) al abrir "Construye tu tarta". Ahora muestra toast y no abre el modal.
- **Tarta incompleta**: el guard de "Añadir al carrito" hacía `return` en silencio; ahora avisa "Faltan opciones por elegir...".
- **Checkout**: carrito vacío o error del servidor mostraban avisos solo dentro del drawer; ahora también salen toasts (éxito y error).
- **Carga de productos fallida**: además del mensaje en el grid, se muestra un toast.
- **Formulario de contacto**: sustituido `alert()` nativo por un toast de éxito.

**Cómo usarlo:** recargar con **Ctrl+F5**. Probar a cortar el servidor (apagar `node`) y recargar: saldrá un toast de error en lugar de un fallo mudo.

## [0.3.2] - 2026-08-16 — Bugfixes: borrar tarta del carrito + validación de opciones

### Corregido (commit `f1074b3`)
- **No se podía borrar/restar una tarta personalizada del carrito.** La clave de la línea en el carrito contenía el JSON de la configuración (`48::{"tamano":"42",...}`), cuyas comillas dobles rompían el atributo `data-id` del drawer y el borrado no encontraba la línea. Ahora la clave se codifica con `encodeURIComponent` en el HTML y se decodifica al leerla, de modo que "−", "+" y "✕" funcionan para cualquier configuración.
- **Se podía llegar a "Añadir al carrito" saltando validación.** Reforzada la defensa en profundidad del configurador: además del botón deshabilitado, el handler de "Siguiente" ahora comprueba también que el paso actual es válido antes de avanzar. El backend ya rechazaba (400) configuraciones incompletas.

**Cómo usarlo:** recargar con **Ctrl+F5**, añadir una tarta personalizada y comprobar que la línea del carrito se puede quitar con ✕.

## [0.3.1] - 2026-08-16 — Configurador: tamaño y altura separados + pasos bloqueados

### Mejoras del configurador de tartas (commit `TBD`)
- **Tamaño y altura por separado**: el paso "tamaño" ahora pide primero el **diámetro** (Small 30 € / Medium 40 € / Large 50 €) y después la **altura** (Regular +0 € / Tall +15 €). Migración `db/migrations/002_tamano_altura.sql` + schema + seed actualizados.
- **Sin saltos de paso**: no se puede avanzar ni hacer clic en un paso posterior hasta haber elegido uno en el paso actual; "Siguiente" queda deshabilitado hasta seleccionar.
- El contrato `configuracion` del backend ahora exige `tamano` + `altura` y calcula el precio con ambos (verificado: Large + Tall + Cookies + Dulce de leche + Full Vintage + 3 extras = 83,50 €).

**Cómo usarlo:** recargar con **Ctrl+F5**, abrir "Tarta personalizada a medida" y seguir los pasos en orden.

## [0.3.0] - 2026-08-16 — Configurador "Construye tu tarta"

### Configurador de tartas personalizadas (commit `TBD`)
Nueva tarjeta **"Construye tu tarta 🎂"** en el catálogo que abre un asistente de 5 pasos: **tamaño, bizcocho, relleno, decoración y extras (multi-selección)**, con precio en vivo según la combinación.

- **BD:** tabla `opciones` (`grupo`, `nombre`, `descripcion`, `precio`) + columna `configuracion` (JSONB) en `pedido_items` (migración `db/migrations/001_configurador_tartas.sql`).
- **Seed:** 39 opciones reales del catálogo de Kokoro Cakes (tamaños desde 30 €, bizcochos, rellenos, decoraciones y extras).
- **API:** `GET /api/opciones` (catálogo de opciones + producto base por tenant) y `POST /api/pedidos` acepta `items[].configuracion`, calcula el precio **desde la BD** (nunca confía en el cliente) y guarda el snapshot JSONB de la combinación.
- **Frontend:** modal con pasos clicables, selección de extras múltiple, resumen de partes + precio y guardado en carrito; el carrito distingue cada configuración como línea propia.
- La tarjeta "Construye tu tarta" no tiene botón "+" directo: al hacer clic se abre el configurador.

**Cómo usarlo:** recargar `http://localhost:3000`, hacer clic en **Construye tu tarta 🎂**, elegir combinación y añadir al carrito. El pedido guarda la configuración exacta elegida.

## [0.2.0] - 2026-08-14 — Modal de detalle de producto con ingredientes

### Modal de detalle (commit `TBD`)
Al hacer clic en cualquier card del catálogo se abre un **modal grande** con la foto, descripción e **ingredientes** del producto, y un botón "Añadir al carrito" que agrega el producto y abre el carrito.

- Nuevo campo `ingredientes` (TEXT) en `productos` (schema + migración `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
- Seed actualizado con ingredientes reales para los 14 productos de Kokoro Cakes.
- API: `GET /api/productos` y `GET /api/productos/:slug` ahora incluyen `ingredientes`.
- Frontend: modal accesible (`role="dialog"`, cierre con botón, clic en overlay o `Escape`), chips de ingredientes y responsive móvil.
- El botón "Añadir" de las cards sigue añadiendo directo al carrito sin abrir el modal.

**Cómo usarlo:** recargar `http://localhost:3000` y hacer clic en un producto.

## [0.1.1] - 2026-08-14 — Tests de integración de la API

### Tests de la API (commit `TBD`)
Suite de integración en `backend/tests/api.test.js` usando el runner nativo de Node (`node:test`) y `fetch`, **sin dependencias nuevas**. Necesita PostgreSQL local con esquema + seed aplicados.

**Cómo usarla:**
```bash
cd backend
npm test            # 12 tests: health, productos, pedidos
```

Cobertura:
- `GET /api/health`: tienda por defecto, cambio con `X-Tenant-Slug`, 404 si no existe.
- `GET /api/productos`: solo disponibles, campos completos, **aislamiento entre tenants**.
- `GET /api/productos/:slug`: 200 en detalle, 404 inexistente, 404 si es de otra tienda.
- `GET /api/pedidos`: lista de la tienda activa.
- `POST /api/pedidos`: cálculo de precios desde la BD (subtotal/envío/total), rechazo sin cliente/items, **rollback** con producto inexistente (verifica que no deja pedidos huérfanos).
- Los pedidos de prueba se limpian solos al terminar.

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
