terraform {
  required_version = ">= 1.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# -------------------------------------------------------------------------
# VPC for Jenkins and EKS
# -------------------------------------------------------------------------
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"

  name = "wordcraft-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = true
  enable_dns_hostnames = true

  tags = {
    "kubernetes.io/cluster/wordcraft-eks" = "shared"
  }
}

# -------------------------------------------------------------------------
# Jenkins EC2 Server
# -------------------------------------------------------------------------
resource "aws_security_group" "jenkins_sg" {
  name        = "jenkins-sg"
  description = "Security group for Jenkins"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

data "aws_iam_role" "jenkins_role" {
  name = "ec2adminaccess"
}

resource "aws_iam_instance_profile" "jenkins_profile" {
  name = "wordcraft-jenkins-profile"
  role = data.aws_iam_role.jenkins_role.name
}

resource "aws_instance" "jenkins" {
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = "t3.medium"
  subnet_id     = module.vpc.public_subnets[0]

  vpc_security_group_ids      = [aws_security_group.jenkins_sg.id]
  associate_public_ip_address = true
  key_name                    = var.key_name
  iam_instance_profile        = aws_iam_instance_profile.jenkins_profile.name

  # Script to install Docker, Jenkins, Git
  user_data = <<-EOF
              #!/bin/bash
              # Update OS
              dnf update -y
              
              # Install Docker
              dnf install -y docker
              systemctl enable docker
              systemctl start docker
              usermod -aG docker ec2-user
              
              # Install Java (required for Jenkins)
              dnf install -y java-21-amazon-corretto-headless
              
              # Install Jenkins
              wget -O /etc/yum.repos.d/jenkins.repo https://pkg.jenkins.io/redhat-stable/jenkins.repo
              rpm --import https://pkg.jenkins.io/redhat-stable/jenkins.io-2023.key
              dnf install -y jenkins
              systemctl enable jenkins
              systemctl start jenkins
              
              # Add jenkins to docker group
              usermod -aG docker jenkins
              systemctl restart jenkins
              
              # Install Git
              dnf install -y git
              
              # Install kubectl
              curl -LO "https://dl.k8s.io/release/v1.36.0/bin/linux/amd64/kubectl"
              chmod +x ./kubectl
              mv ./kubectl /usr/local/bin/kubectl
              
              # Install eksctl
              curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_Linux_amd64.tar.gz" | tar xz -C /tmp
              mv /tmp/eksctl /usr/local/bin
              
              # Note: GitHub and DockerHub credentials need to be added manually or via JCasC
              EOF

  tags = {
    Name = "WordCraft-Jenkins"
  }
}

# -------------------------------------------------------------------------
# Kubernetes Cluster (EKS)
# -------------------------------------------------------------------------
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "wordcraft-eks"
  cluster_version = "1.36"

  vpc_id                         = module.vpc.vpc_id
  subnet_ids                     = module.vpc.private_subnets
  cluster_endpoint_public_access = true

  # Grant the Jenkins EC2 Instance access to the cluster
  enable_cluster_creator_admin_permissions = true
  access_entries = {
    jenkins = {
      kubernetes_groups = []
      principal_arn     = data.aws_iam_role.jenkins_role.arn

      policy_associations = {
        admin = {
          policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = {
            type = "cluster"
          }
        }
      }
    }
  }

  cluster_security_group_additional_rules = {
    ingress_jenkins = {
      description              = "Allow Jenkins EC2 to access cluster API"
      protocol                 = "tcp"
      from_port                = 443
      to_port                  = 443
      type                     = "ingress"
      source_security_group_id = aws_security_group.jenkins_sg.id
    }
  }

  eks_managed_node_group_defaults = {
    instance_types = ["t3.medium"]
  }

  eks_managed_node_groups = {
    wordcraft_nodes = {
      min_size     = 1
      max_size     = 3
      desired_size = 2
    }
  }
}
