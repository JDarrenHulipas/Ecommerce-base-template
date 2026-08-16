# Changelog de BakeryCloud

Registro de todo lo que se sube al repositorio en cada `git push`.
Cada entrada indica qué funcionalidad se añadió y cómo usarla.

## [0.9.0] - 2026-08-16 — Imagen de producto en el panel admin

### Funcionalidad añadida
- **Campo "Imagen (URL)"** en la tabla de productos del admin: cada fila muestra la URL (`imagen_s3`) y permite guardarla o borrarla (cadena vacía → `null`).
- **Formulario "Añadir producto nuevo"**: nuevo campo de URL de imagen.
- **API**: el listado `GET /api/admin/productos` ahora incluye `imagen_s3`; `POST` y `PATCH /api/admin/productos/:id` aceptan la imagen (campo `imagen_s3`, o `imagen` en el POST) con validación de URL (400 si no empieza por `http/https`).
- La tienda pública ya usaba `imagen_s3` si estaba definida (con degradado/local `/img/<slug>.jpg` en caso contrario), así que la imagen configurada aparece directamente en la portada.
- **Tests**: suite completa **53/53** (42 integración + 11 E2E). Nuevos tests de listado/PATCH de imagen (persistencia en BD, borrado con cadena vacía) y validaciones; el E2E de creación rellena también la imagen.

**Cómo usarlo:** en `/admin/`, pestaña Productos, pega la URL de la imagen en la columna "Imagen (URL)" y pulsa Guardar, o usa el campo del formulario "Añadir producto nuevo".

## [0.8.0] - 2026-08-16 — Panel admin: pedidos, contactos y gestión de productos

### Funcionalidad añadida
- **`GET /api/admin/pedidos`**: lista los pedidos de la tienda activa con cliente (nombre/email/teléfono) y sus líneas (producto, cantidad, precio y configuración JSONB), ordenados por fecha.
- **`GET /api/admin/contactos`**: lista las consultas del formulario de contacto de la tienda activa.
- **`POST /api/admin/productos`**: crea un producto. El slug se autogenera desde el nombre (garantizando unicidad) y la categoría se crea automáticamente si no existe (por defecto "General").
- **`DELETE /api/admin/productos/:id`**: elimina un producto; devuelve **409** si tiene pedidos asociados (protección de la FK) y 404 si no existe o es de otra tienda.
- **Panel admin**: nuevas pestañas **Pedidos** y **Contactos**, formulario "Añadir producto nuevo" y botón **Eliminar** con confirmación en cada fila.
- **Tests**: suite completa **51/51** (40 integración + 11 E2E). Nuevos tests de creación/borrado (incluye 409 y aislamiento RLS), pedidos y contactos, más un E2E que crea un producto desde el navegador.

**Cómo usarlo:** entra en `http://localhost:3000/admin/`, elige la tienda y usa las pestañas Productos / Pedidos / Contactos. El formulario "Añadir producto nuevo" crea la categoría sola si no existe.

## [0.7.0] - 2026-08-16 — Edición de ingredientes y contenido de la portada

### Funcionalidad añadida
- **`GET /api/contenido`** (público): devuelve los textos de la portada (barra de anuncios, hero, nosotros, contacto y footer) de la tienda activa.
- **API admin de contenido**: `GET /api/admin/contenido` lista los textos editables y `PUT /api/admin/contenido` los guarda `{ contenido: [{ clave, valor }] }`, con validación (400) y aislamiento por tienda (RLS).
- **Panel admin**: nueva pestaña **"Contenido de la portada"** con campos para anuncios, hero, nosotros, contacto y footer. Al guardar, la tienda pública muestra los cambios al instante.
- **Ingredientes en el admin**: el listado `GET /api/admin/productos` incluye `ingredientes` y `PATCH /api/admin/productos/:id` permite editarlos (valida que sea texto).
- **Tests**: suite completa **43/43** (33 integración + 10 E2E). Nuevos tests de contenido en `admin.test.js`/`api.test.js` (incluye verificación en BD y restauración) y E2E que edita el anuncio desde el navegador y comprueba que aparece en la portada.

**Cómo usarlo:** entra en `http://localhost:3000/admin/`, selecciona la tienda, abre la pestaña **Contenido de la portada**, edita los textos y pulsa guardar. Los ingredientes se editan en la pestaña de productos.

## [0.6.0] - 2026-08-16 — Docker Compose completo (frontend + API + BD)

### Funcionalidad añadida (commit `ffd269e`)
- **Stack de 3 servicios** en `docker/docker-compose.yml`: `web` (nginx, sirve la SPA y `/admin/` en el puerto 8080), `api` (Node/Express en el 3000) y `postgres` (5432). Se levanta todo con un solo comando.
- **`docker/api.Dockerfile`**: backend + estáticos del frontend (Node 20 alpine, usuario no-root, `npm ci --omit=dev`).
- **`docker/nginx.Dockerfile` + `docker/nginx.conf`**: sirve `index.html`, `/admin/`, `/src/` e `/img/`, y proxifica `/api/` hacia el contenedor `api`.
- **`docker/init/01-init.sh`**: inicialización automática de la BD la primera vez, en el orden correcto: `schema → roles → seed → migraciones 001-003 → seed_kokoro`. Las migraciones van después del seed (necesitan la tienda 1) y antes del seed_kokoro (éste sobrescribe las opciones).
- **`.dockerignore`** en la raíz: evita hornear `.env` y `node_modules` en las imágenes.
- **`db/seed_kokoro.sql`**: ahora limpia el pedido demo de `seed.sql` antes de reconstruir el catálogo, para que una inicialización en frío no falle por la FK de `pedido_items`.
- **Verificado**: el stack entero responde (catálogo 16 productos, configurador, `/admin/`, imágenes) y la suite completa sigue **36/36** contra los contenedores.

**Cómo usarlo:** `docker compose -f docker/docker-compose.yml up -d --build` → tienda en http://localhost:8080, admin en `/admin/`, API en :3000. `down -v` borra también la BD.

## [0.5.0] - 2026-08-16 — Panel de administración (`/admin/`)

### Funcionalidad añadida (commit `d63b173`)
- **API admin protegida**: `POST /api/admin/login` valida la contraseña (`ADMIN_PASSWORD`) y devuelve un JWT firmado con `ADMIN_SECRET`. Si faltan estas variables en `.env`, todas las rutas responden **503**.
- **Rutas admin** (exigen token `Bearer`):
  - `GET /api/admin/tiendas` — lista las tiendas del sistema (multi-tenant).
  - `GET /api/admin/productos` — catálogo **completo** de la tienda activa (incluye no disponibles), aislado por RLS.
  - `PATCH /api/admin/productos/:id` — actualiza stock, precio, disponible, nombre o descripción con validación (400) y 404 si el producto no existe o es de otra tienda.
- **Panel frontend** en `http://localhost:3000/admin/`: login, selector de tienda y edición por fila (nombre, descripción, precio, stock, disponible) con mensajes de guardado.
- **Tests**: suite `admin.test.js` (login, 401, listados, PATCH persistido + verificado en BD, validaciones, aislamiento) y test E2E de Playwright que edita stock desde el navegador. Suite completa: **36/36**.

### Refuerzos incluidos en el mismo push
- **Validación de pedidos**: `POST /api/pedidos` rechaza cantidades no enteras, negativas o ausentes (400) y configuraciones cuyas opciones no pertenezcan al grupo esperado (tamaño/altura/bizcocho/relleno/decoración/extra).
- **Seguridad frontend**: escaping XSS (`escapeHtml`) en catálogo, carrito, modal e ingredientes, y `type="button"` en todos los botones del formulario.

**Cómo usarlo:** configurar `ADMIN_PASSWORD` y `ADMIN_SECRET` en `backend/.env`, entrar en `http://localhost:3000/admin/`, elegir tienda y editar stock/precio. La contraseña de desarrollo es `admin1234` (¡cambiar en producción!).

## [0.4.0] - 2026-08-16 — Formulario de contacto real

### Funcionalidad añadida (commit `2a7d5c6`)
- **Tabla `contactos`** (migración `db/migrations/003_contactos.sql`): consultas del formulario por tienda, con RLS + política `tenant_isolation` y privilegios para `bakery_api`.
- **API**: `POST /api/contactos` guarda `{ nombre, email, mensaje }` con validación (requiere los 3 campos y email con formato válido → 400 en caso contrario, 201 al crearlo) y `GET /api/contactos` lista las consultas de la tienda activa (RLS aísla por tenant).
- **Frontend**: el formulario "Contacto" ahora envía de verdad al backend (antes solo mostraba un toast falso), desactiva el botón mientras envía, muestra toast de éxito al guardar y toast de error si falla. Nuevo método `Api.enviarContacto()`.
- **Tests**: 3 nuevos (creación + listado, rechazo de datos inválidos, aislamiento por tenant). Suite completa: **15/15**.

**Cómo usarlo:** recargar con **Ctrl+F5**, rellenar el formulario de contacto y enviar. La consulta queda guardada en `contactos` (consultable con `GET /api/contactos`).

## [0.3.5] - 2026-08-16 — En el último paso se muestra "Añadir al carrito" sin "Siguiente"

### Corregido (commit `a49544d`)
- El atributo `hidden` no funcionaba en los botones: el CSS `.btn { display: inline-block }` anulaba el `display: none` nativo de `hidden`, por eso en el último paso (extras) se veían **"Siguiente" y "Añadir al carrito" a la vez**. Añadida la regla global `[hidden] { display: none !important; }`.
- Ahora en el último paso solo aparece el botón **"Añadir al carrito"** (sin "Siguiente"); "Anterior" se sigue ocultando correctamente en el primer paso, y "Añadir al carrito" deja de verse en los pasos intermedios.

**Cómo usarlo:** recargar con **Ctrl+F5**, abrir "Construye tu tarta" y llegar al paso de extras: solo verás "Añadir al carrito".

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
