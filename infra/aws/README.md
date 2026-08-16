# Infraestructura AWS — BakeryCloud (semanas 7-8)

Infraestructura como código con **Terraform** para desplegar la plataforma en
AWS región **`eu-south-2`** (España).

## Qué crea

| Recurso | Detalle |
|---|---|
| **VPC** | `10.0.0.0/16` con 2 subredes públicas (EC2) y 2 privadas (RDS) |
| **EC2** | `t3.micro` (Amazon Linux 2023), IP elástica, Docker + compose instalados por `user_data.sh`. IAM role con permisos de lectura/escritura sobre el bucket |
| **RDS** | PostgreSQL 16 (`db.t3.micro`), privado (solo accesible desde la EC2), cifrado, backup 7 días |
| **S3** | Bucket de imágenes subidas por el admin (`bakerycloud-<env>-uploads`), privado, cifrado y versionado |
| **IAM** | Rol de instancia para que la EC2 hable con S3 (las credenciales las inyecta el SDK automáticamente) |

## Cómo desplegar

```bash
cd infra/aws
terraform init
terraform plan
terraform apply
```

Salidas útiles: `ec2_public_ip`, `rds_endpoint`, `bucket_uploads` y la
contraseña maestra de la BD (`rds_master_password`, sensible).

### Estado remoto (recomendado)

```bash
aws s3 mb s3://bakerycloud-tfstate-<env> --region eu-south-2
```

Descomenta el bloque `backend "s3"` de `providers.tf` antes de `terraform init`.

## Despliegue de la aplicación (CI/CD)

El pipeline de `.github/workflows/deploy.yml`:
1. **Tests**: levanta el stack de docker compose, corre `test:api` + `test:e2e`.
2. **Deploy**: sube el código a la EC2 por SSH, escribe `.env` con los secretos
   y ejecuta `docker/deploy.sh`.

Secretos requeridos en GitHub (Settings → Secrets → Actions):

| Secreto | Valor |
|---|---|
| `EC2_HOST` | IP pública de la EC2 (output `ec2_public_ip`) |
| `EC2_SSH_KEY` | Clave privada del key pair (`ec2_ssh_public_key` en Terraform) |
| `DATABASE_URL` | Conexión del rol `bakery_api` al RDS: `postgres://bakery_api:<pass>@<rds_endpoint>:5432/bakerycloud` |
| `DB_INIT_URL` | Conexión del usuario maestro (output `rds_master_password`): se usa para la 1ª inicialización y migraciones |
| `DEFAULT_TENANT_SLUG` | Tienda por defecto (p. ej. `kokorocakes`) |
| `ADMIN_PASSWORD` / `ADMIN_SECRET` | Credenciales del panel `/admin/` |
| `S3_BUCKET` | Nombre del bucket (output `bucket_uploads`) |
| `S3_REGION` | `eu-south-2` |

### Primera inicialización de la BD

El primer despliegue detecta que la BD de RDS está vacía y ejecuta
`schema → roles → seed → migraciones → seed_kokoro` automáticamente
(igual que el init local de docker). En despliegues siguientes solo aplica las
migraciones, sin tocar los datos.

## Imágenes subidas (S3)

Con `S3_BUCKET` configurado, la subida de imágenes del admin (`POST
/api/admin/imagenes`) guarda el archivo en S3; la URL pública
(`/api/imagenes/<clave>`) es la misma que en local, así que el frontend no
cambia. Sin `S3_BUCKET` se usa el disco local (`UPLOAD_DIR`), como en
desarrollo.

## Pendiente (semanas 9-10)

- Cloudflare (DNS, SSL/TLS, CDN) apuntando a la IP de la EC2.
- HTTPS en nginx (certbot o Cloudflare origin cert).
- Segundo subproyecto (nueva tienda) para validar el multi-tenant en producción.
