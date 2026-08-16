# ============================================================
# EC2: servidor web/API. El CI/CD se conecta por SSH y despliega
# con docker compose. El user_data instala las herramientas.
# ============================================================

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_key_pair" "deploy" {
  count      = var.ec2_ssh_public_key != "" ? 1 : 0
  key_name   = "${var.nombre_proyecto}-${var.env}-deploy"
  public_key = var.ec2_ssh_public_key
}

resource "aws_instance" "web" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.ec2_instance_type
  subnet_id              = aws_subnet.publica[0].id
  vpc_security_group_ids = [aws_security_group.web.id]
  key_name               = var.ec2_ssh_public_key != "" ? aws_key_pair.deploy[0].key_name : null
  iam_instance_profile   = aws_iam_instance_profile.ec2.name

  user_data = file("${path.module}/ec2/user_data.sh")

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }

  tags = { Nombre = "${var.nombre_proyecto}-${var.env}-web" }
}

resource "aws_eip" "web" {
  domain   = "vpc"
  instance = aws_instance.web.id

  tags = { Nombre = "${var.nombre_proyecto}-${var.env}-eip-web" }
}
