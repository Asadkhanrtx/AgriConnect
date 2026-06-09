terraform {
  required_version = ">= 1.5.0"

  # Remote state stored in S3.
  # "default" workspace  = dev  (your existing infra lives here)
  # "prod"    workspace  = prod (empty until you're ready)
  backend "s3" {
    bucket  = "agriconnect-terraform-state"
    key     = "terraform.tfstate"
    region  = "ap-south-1"
    encrypt = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}
