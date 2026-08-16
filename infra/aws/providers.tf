# ============================================================
# BakeryCloud - Providers y backend de estado
#
# Ejecutar desde infra/aws/:
#   terraform init
#   terraform plan
#   terraform apply
#
# Para estado remoto (recomendado en equipo), crear antes el bucket:
#   aws s3 mb s3://bakerycloud-tfstate-<env> --region eu-south-2
# y descomentar el bloque backend.
# ============================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # State remoto (descomentar tras crear el bucket de estado):
  # backend "s3" {
  #   bucket = "bakerycloud-tfstate-<env>"
  #   key    = "bakerycloud/terraform.tfstate"
  #   region = "eu-south-2"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Proyecto = "BakeryCloud"
      Entorno  = var.env
    }
  }
}

provider "random" {}
