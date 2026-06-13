variable "aws_region" {
  description = "The AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "jenkins_instance_type" {
  description = "Instance type for Jenkins EC2 server"
  type        = string
  default     = "t3.medium"
}
