# ============================================================
# BakeryCloud - Outputs útiles tras el apply
# ============================================================

output "ec2_public_ip" {
  description = "IP pública del servidor web/API (apunta aquí el dominio)"
  value       = aws_eip.web.public_ip
}

output "ec2_ssh_command" {
  description = "Comando SSH para administrar el servidor"
  value       = "ssh -i <clave.pem> ec2-user@${aws_eip.web.public_ip}"
}

output "bucket_uploads" {
  description = "Bucket S3 de imágenes subidas"
  value       = aws_s3_bucket.uploads.id
}

output "rds_endpoint" {
  description = "Endpoint de la BD (usar como host en DATABASE_URL)"
  value       = aws_db_instance.principal.endpoint
}

output "rds_master_password" {
  description = "Contraseña maestra de la BD (guardar en Secret Manager / CI). Solo se usa para inicializar"
  value       = random_password.db.result
  sensitive   = true
}
