#!/bin/bash
# ============================================================
# BakeryCloud - User data de la EC2 (se ejecuta en el primer arranque)
# Instala Docker + plugin compose + Git y prepara /app.
# El despliegue real lo hace el pipeline CI/CD por SSH.
# ============================================================
set -euxo pipefail

dnf update -y
dnf install -y docker git

systemctl enable --now docker
usermod -aG docker ec2-user

# Plugin docker compose (imagen x86_64)
DOCKER_COMPOSE_VERSION="v2.29.7"
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Directorio del despliegue (el CI lo rellena con git pull)
mkdir -p /app/bakerycloud
chown ec2-user:ec2-user /app/bakerycloud

# CloudWatch Agent no necesario para el arranque; se documenta en el README.
