# ============================================================
# Red: VPC, subredes públicas (EC2) y privadas (RDS)
# ============================================================

resource "aws_vpc" "principal" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Nombre = "${var.nombre_proyecto}-${var.env}-vpc" }
}

# --- Subredes públicas (EC2 / web) ---
resource "aws_subnet" "publica" {
  count                   = length(var.subnet_publica_cidrs)
  vpc_id                  = aws_vpc.principal.id
  cidr_block              = var.subnet_publica_cidrs[count.index]
  availability_zone       = var.azs[count.index]
  map_public_ip_on_launch = true

  tags = { Nombre = "${var.nombre_proyecto}-${var.env}-publica-${count.index + 1}" }
}

# --- Subredes privadas (RDS) ---
resource "aws_subnet" "privada" {
  count             = length(var.subnet_privada_cidrs)
  vpc_id            = aws_vpc.principal.id
  cidr_block        = var.subnet_privada_cidrs[count.index]
  availability_zone = var.azs[count.index]

  tags = { Nombre = "${var.nombre_proyecto}-${var.env}-privada-${count.index + 1}" }
}

resource "aws_internet_gateway" "principal" {
  vpc_id = aws_vpc.principal.id

  tags = { Nombre = "${var.nombre_proyecto}-${var.env}-igw" }
}

resource "aws_route_table" "publica" {
  vpc_id = aws_vpc.principal.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.principal.id
  }

  tags = { Nombre = "${var.nombre_proyecto}-${var.env}-rt-publica" }
}

resource "aws_route_table_association" "publica" {
  count          = length(aws_subnet.publica)
  subnet_id      = aws_subnet.publica[count.index].id
  route_table_id = aws_route_table.publica.id
}

# --- Security groups ---
resource "aws_security_group" "web" {
  name        = "${var.nombre_proyecto}-${var.env}-web"
  description = "Web/API: SSH, HTTP y HTTPS desde internet"
  vpc_id      = aws_vpc.principal.id

  ingress {
    description = "SSH (deploy CI)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  dynamic "ingress" {
    for_each = var.dominio != "" ? [1] : []
    content {
      description = "HTTPS"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Nombre = "${var.nombre_proyecto}-${var.env}-sg-web" }
}

resource "aws_security_group" "rds" {
  name        = "${var.nombre_proyecto}-${var.env}-rds"
  description = "PostgreSQL: solo accesible desde la EC2"
  vpc_id      = aws_vpc.principal.id

  ingress {
    description     = "PostgreSQL desde la EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.web.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Nombre = "${var.nombre_proyecto}-${var.env}-sg-rds" }
}
