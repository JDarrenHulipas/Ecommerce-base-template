# Guía de despliegue: Fly.io + Supabase + Squarespace

Pasos para tener la tienda online en `kokorocakes.darrenhulipas.com`.

---

## Paso 1 — Crear cuenta en Fly.io

```bash
# Instalar flyctl (Windows)
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Crear cuenta (abre el navegador)
fly auth signup
```

---

## Paso 2 — Crear base de datos en Supabase (gratis, EU)

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. **New Project** → nombre: `bakerycloud` → contraseña: elige una fuerte → región: **EU West (Germany)**.
3. En el dashboard ve a **Settings → Database → Connection string → URI**.
4. Copia la URI completa. Tiene esta pinta:
   ```
   postgres://postgres.[ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
   ```
   **Importante:** usa el puerto **6543** (Transaction mode, compatible con connection pooling de Node.js).

### Cargar el esquema y datos

Supabase no permite crear roles (`CREATE ROLE`), así que usamos un script
único que omite `roles.sql` y deja que la app conecte como `postgres`
(dueño de la BD, RLS con bypass). Las queries ya filtran por `tienda_id`.

En el dashboard de Supabase ve a **SQL Editor**, abre el archivo
`db/supabase-setup.sql`, copia TODO su contenido, pégalo en el editor
y pulsa **Run** (se ejecuta una sola vez).

> El script hace: esquema (tablas + RLS + funciones de tenant) → migraciones
> del configurador/contenido/contactos → seed de tiendas → seed de Kokoro
> Cakes con su catálogo real.

---

## Paso 3 — Crear la app en Fly.io

```bash
cd bakerycloud

# Lanza la app (detecta el Dockerfile automáticamente)
fly launch

# Respuestas:
#   App Name: bakerycloud-kokoro
#   Region: Madrid (MAD)
#   Overwrite Dockerfile detected: Yes (usa el existente)
```

---

## Paso 4 — Configurar variables de entorno

Las secrets de Fly.io se configuran con `fly secrets set`. Sustituye los valores entre `<...>`:

```bash
# Database (usa el puerto 6543 de Supabase)
fly secrets set DATABASE_URL="postgres://postgres.<ref>:<password>@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

# Admin
fly secrets set ADMIN_PASSWORD="<contraseña-que-elijas>"
fly secrets set ADMIN_SECRET="<frase-secreta-para-firmar-tokens>"

# CORS: origenes permitidos de la API (mismo dominio de producción + localhost)
fly secrets set CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,https://bakerycloud-kokoro.fly.dev,https://kokorocakes.darrenhulipas.com"

# Imágenes (usa tu bucket de S3 si lo tienes; si no, las imágenes se guardan en disco efímero)
# fly secrets set S3_BUCKET="<nombre-del-bucket>"
# fly secrets set S3_REGION="eu-south-2"
```

> **Seguridad:** el panel admin exige `ADMIN_PASSWORD`/`ADMIN_SECRET`. El login
> y los POSTs tienen rate limiting (10 intentos/15min login, 30/min pedidos
> y consultas). Las subidas de imagen validan el contenido real (magic bytes),
> no solo el mimetype. Los GET públicos de pedidos y consultas requieren auth.
> El aislamiento entre tiendas se hace con filtros SQL explícitos por
> `tienda_id` porque el rol `postgres` de Supabase tiene `BYPASSRLS` (el RLS
> no aplica aunque esté forzado).

> **Nota del health check:** Fly llama a `/api/health` con el Host interno
> (`bakerycloud-kokoro.fly.dev`). Esa ruta está montada ANTES del middleware
> de tenant para que no se interprete ese Host como slug de tienda (si no,
> devolvería 404 y Fly marcaría la máquina como caída).

> **Sobre las imágenes:** sin `S3_BUCKET`, las imágenes subidas por el admin se guardan en el disco del contenedor. Si el contenedor se reinicia (auto_stop/auto_start), **se pierden**. Para producción, configura un bucket S3 (puedes crear uno gratis en AWS con el free tier).

---

## Paso 5 — Desplegar

```bash
fly deploy
```

Fly.io construye la imagen Docker y la despliega en Madrid. El primer deploy tarda ~2-3 minutos.

### Comprobar que funciona

```bash
# Ver el estado
fly status

# Ver los logs
fly logs

# Health check (debe responder {"status":"ok",...})
curl https://bakerycloud-kokoro.fly.dev/api/health

# Abrir en el navegador
fly open
```

La tienda debería estar en `https://bakerycloud-kokoro.fly.dev`.

---

## Paso 6 — Configurar el dominio en Squarespace

En **Squarespace → Settings → Domains → darrenhulipas.com → DNS Settings**:

| Type | Host | Data | TTL |
|------|------|------|-----|
| **CNAME** | `kokorocakes` | `bakerycloud-kokoro.fly.dev` | 600 |

Propagation: de 5 a 30 minutos.

### Verificar

```bash
# Añadir el dominio a Fly.io
fly certs add kokorocakes.darrenhulipas.com
```

Fly.io genera automáticamente un certificado TLS (Let's Encrypt). Verifica con:

```bash
fly certs list
```

Cuando el certificado esté listo (~1 min), la tienda estará disponible en:
**https://kokorocakes.darrenhulipas.com**

---

## Comandos útiles de Fly.io

```bash
fly status              # estado de la app
fly logs                # logs en tiempo real
fly secrets list        # ver secrets configuradas
fly ssh console         # entrar al contenedor
fly restart             # reiniciar
fly deploy              # redesplegar
fly scale count 1       # escalar (0 = auto_stop)
fly cert list           # estado de certificados TLS
```

---

## Resumen de la arquitectura

```
kokorocakes.darrenhulipas.com
        │
        ▼ (CNAME)
bakerycloud-kokoro.fly.dev  ← Fly.io Madrid (VM compartida 256MB)
        │
        ├─→ Express (API + frontend estático, puerto 3000)
        │
        └─→ Supabase PostgreSQL (EU, gratis, 500MB)
```
