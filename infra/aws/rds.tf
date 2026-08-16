# ============================================================
# RDS: PostgreSQL gestionado (reemplaza al postgres de docker
# en producción; la inicialización la hace el pipeline CI/CD)
# ============================================================

resource "random_password" "db" {
  length           = 24
  special          = true
  override_special = "!@#$%^&*()_+-="
}

resource "aws_db_subnet_group" "principal" {
  name        = "${var.nombre_proyecto}-${var.env}-subnets"
  description = "Subredes privadas para RDS"
  subnet_ids  = aws_subnet.privada[*].id
}

resource "aws_db_instance" "principal" {
  identifier = "${var.nombre_proyecto}-${var.env}-postgres"

  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 50
  storage_encrypted     = true

  db_name             = var.db_name
  username            = var.db_master_username
  password            = random_password.db.result
  skip_final_snapshot = true

  db_subnet_group_name   = aws_db_subnet_group.principal.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:30-sun:05:30"
  multi_az                = false

  tags = { Nombre = "${var.nombre_proyecto}-${var.env}-postgres" }
}
