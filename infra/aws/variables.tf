# ============================================================
# BakeryCloud - Variables
# ============================================================

variable "aws_region" {
  description = "Región AWS (el roadmap fija España: eu-south-2)"
  type        = string
  default     = "eu-south-2"
}

variable "env" {
  description = "Entorno (dev | prod). Sufijo de nombres y tags"
  type        = string
  default     = "prod"
}

variable "nombre_proyecto" {
  description = "Prefijo de nombres de recursos"
  type        = string
  default     = "bakerycloud"
}

variable "vpc_cidr" {
  description = "CIDR de la VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_publica_cidrs" {
  description = "CIDRs de las subredes públicas (1 por AZ)"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "subnet_privada_cidrs" {
  description = "CIDRs de las subredes privadas (para RDS, 1 por AZ)"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

variable "azs" {
  description = "Zonas de disponibilidad a usar"
  type        = list(string)
  default     = ["eu-south-2a", "eu-south-2b"]
}

variable "ec2_instance_type" {
  description = "Tipo de instancia del servidor web/API"
  type        = string
  default     = "t3.micro"
}

variable "db_instance_class" {
  description = "Clase de la instancia RDS (PostgreSQL)"
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Nombre de la base de datos"
  type        = string
  default     = "bakerycloud"
}

variable "db_master_username" {
  description = "Usuario administrador de la BD (solo se usa para la inicialización)"
  type        = string
  default     = "bakery_admin"
}

variable "ec2_ssh_public_key" {
  description = "Clave pública SSH para acceder a la EC2 (opcional). Si se deja vacía no se crea key pair"
  type        = string
  default     = ""
}

variable "dominio" {
  description = "Dominio público (sin https://). Si se deja vacío no se abre el puerto 443"
  type        = string
  default     = ""
}
