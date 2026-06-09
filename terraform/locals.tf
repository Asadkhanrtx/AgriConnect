data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  # "default" workspace maps to "dev" — existing infra lives in default workspace.
  # Any other workspace name (e.g. "prod") maps to itself.
  workspace_env = terraform.workspace == "default" ? "dev" : terraform.workspace

  # Per-workspace infrastructure sizing.
  # Switch to prod workspace to get prod sizes automatically — no variable changes needed.
  workspace_config = {
    dev = {
      bastion_instance_type  = "t2.micro"
      backend_instance_type  = "t2.micro"
      frontend_instance_type = "t2.micro"
      rds_instance_class     = "db.t3.micro"
      rds_allocated_storage  = 20
    }
    prod = {
      bastion_instance_type  = "t2.micro"
      backend_instance_type  = "t3.small"
      frontend_instance_type = "t3.small"
      rds_instance_class     = "db.t3.small"
      rds_allocated_storage  = 50
    }
  }

  config = local.workspace_config[local.workspace_env]

  account_id  = data.aws_caller_identity.current.account_id
  region      = data.aws_region.current.name
  name_prefix = "${var.project_name}-${local.workspace_env}"

  common_tags = {
    Project     = var.project_name
    Environment = local.workspace_env
    ManagedBy   = "Terraform"
  }
}
