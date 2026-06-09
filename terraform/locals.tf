data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name

  name_prefix = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
  }

  # Secrets Manager secret IDs (existing — read via data sources)
  secret_ids = {
    database = "agriconnect/${var.environment}/database"
    jwt      = "agriconnect/${var.environment}/jwt"
    aws      = "agriconnect/${var.environment}/aws"
    email    = "agriconnect/${var.environment}/email"
    s3       = "agriconnect/${var.environment}/s3"
  }
}
