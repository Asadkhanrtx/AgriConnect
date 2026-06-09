# AgriConnect — Terraform Complete Guide

This guide explains everything Terraform does in this project, from the very first command you run to advanced concepts like remote state, workspaces, and drift. Every concept is explained using the actual files in this repository so you always have a concrete reference.

---

## What is Terraform?

Terraform is an Infrastructure as Code (IaC) tool made by HashiCorp. Instead of clicking through the AWS console to create a VPC, EC2, RDS, etc., you write `.tf` files that describe what infrastructure you want. Terraform reads those files, talks to AWS, and creates everything automatically.

The key idea: your infrastructure is code. It lives in your git repository, can be version controlled, reviewed, and reproduced identically every time.

---

## The Terraform Folder Structure in This Project

```
terraform/
├── versions.tf          ← Terraform version + S3 backend config
├── providers.tf         ← AWS provider configuration
├── variables.tf         ← All input variables declared here
├── locals.tf            ← Computed local values (workspace env, config map)
├── main.tf              ← Root config — modules + direct resources
├── outputs.tf           ← Values printed after apply
├── modules/
│   ├── networking/      ← VPC, subnets, route tables, NAT gateway
│   ├── security/        ← Security groups, IAM roles, instance profiles
│   ├── ec2/             ← Bastion, backend, frontend EC2 instances
│   ├── alb/             ← Load balancer, target groups, listener rules
│   ├── rds/             ← MySQL RDS instance
│   ├── s3/              ← S3 buckets
│   └── cloudfront/      ← CloudFront distribution + WAF
```

---

## Step 1 — terraform init

This is always the first command you run. It prepares the working directory.

```bash
terraform init
```

**What happens internally:**

1. Terraform reads `versions.tf` and sees the `backend "s3"` block — it connects to your S3 bucket `agriconnect-terraform-state` and downloads the state file for the current workspace
2. It reads the `required_providers` block and downloads the AWS provider plugin (~200MB) into `.terraform/providers/`
3. It reads every `source` in every `module` block in `main.tf` and copies those module folders into `.terraform/modules/`
4. It creates `.terraform.lock.hcl` — a lockfile recording the exact provider version downloaded (like `package-lock.json` in Node)

After `init`, the `.terraform/` folder contains everything Terraform needs to run. You never commit `.terraform/` to git — only `.terraform.lock.hcl` gets committed.

**First-time setup vs re-running:**
- First time: downloads everything fresh
- After adding a new module or provider: run `terraform init` again
- After changing backend config: run `terraform init -migrate-state` to move existing state to the new backend

---

## Step 2 — Providers

**File:** `terraform/providers.tf`

```hcl
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
```

A provider is the plugin that knows how to talk to a specific cloud or service. Without a provider, Terraform has no idea what `aws_vpc` or `aws_s3_bucket` means.

**The default provider** (no alias) is the one used by everything unless specified otherwise. It uses `var.aws_region` which defaults to `ap-south-1`.

**The aliased provider** (`us_east_1`) exists because WAF Web ACLs for CloudFront must be created in `us-east-1` — this is an AWS hard requirement. Any resource that needs to live in us-east-1 passes `provider = aws.us_east_1`.

**`default_tags`** is a powerful feature — every single AWS resource created by the default provider automatically gets these tags without you writing `tags = ...` on every resource:
```hcl
tags = {
  Project     = "agriconnect"
  Environment = "dev"       ← comes from local.workspace_env
  ManagedBy   = "Terraform"
}
```

**How Terraform authenticates to AWS:**
Terraform uses the AWS credentials configured on your machine — the same ones the AWS CLI uses. It checks in this order:
1. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
2. `~/.aws/credentials` file (what `aws configure` sets up)
3. EC2 instance profile (when running on EC2)

---

## Step 3 — Variables

**File:** `terraform/variables.tf`

Variables are the inputs to your Terraform configuration. They work exactly like function parameters — they let you customise behaviour without hardcoding values.

```hcl
variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "rds_password" {
  type      = string
  sensitive = true     ← never printed in output or logs
}

variable "key_pair_name" {
  type = string         ← no default = required, must be provided
}
```

**How you provide values:**

Option 1 — `terraform.tfvars` file (most common):
```hcl
key_pair_name  = "my-key"
rds_password   = "supersecret123"
jwt_secret     = "abc123hex..."
smtp_user      = "you@gmail.com"
smtp_pass      = "apppassword"
```

Option 2 — command line flag:
```bash
terraform apply -var="rds_password=supersecret123"
```

Option 3 — environment variable (prefix `TF_VAR_`):
```bash
export TF_VAR_rds_password=supersecret123
terraform apply
```

**Variable types available:**
```hcl
type = string              # "ap-south-1"
type = number              # 20
type = bool                # true
type = list(string)        # ["10.0.1.0/24", "10.0.2.0/24"]
type = map(string)         # { key = "value" }
type = object({            # structured type
  name = string
  port = number
})
```

**In this project:**
- `var.vpc_cidr`, `var.public_subnet_cidrs` — networking
- `var.rds_password`, `var.jwt_secret`, `var.smtp_pass` — sensitive credentials (never logged)
- `var.key_pair_name` — no default, must always be provided
- `var.aws_region` — has a default of `ap-south-1`

Variables with `sensitive = true` are redacted in `terraform plan` output and never written to the state file in plaintext.

---

## Step 4 — Locals

**File:** `terraform/locals.tf`

Locals are computed values — things derived from variables or other locals that you want to reuse without repeating logic.

```hcl
locals {
  # terraform.workspace is "default" when you haven't created a named workspace
  # We map "default" → "dev" so existing infra names stay unchanged
  workspace_env = terraform.workspace == "default" ? "dev" : terraform.workspace

  workspace_config = {
    dev = {
      backend_instance_type  = "t2.micro"
      rds_instance_class     = "db.t3.micro"
      rds_allocated_storage  = 20
    }
    prod = {
      backend_instance_type  = "t3.small"
      rds_instance_class     = "db.t3.small"
      rds_allocated_storage  = 50
    }
  }

  config      = local.workspace_config[local.workspace_env]
  name_prefix = "${var.project_name}-${local.workspace_env}"

  common_tags = {
    Project     = var.project_name
    Environment = local.workspace_env
    ManagedBy   = "Terraform"
  }
}
```

**The key difference between variables and locals:**
- Variables are inputs — they come from outside (tfvars, CLI, environment)
- Locals are computed inside Terraform — they're derived values, not inputs

`local.name_prefix` resolves to `agriconnect-dev` in dev workspace and `agriconnect-prod` in prod. Every resource name in the project uses this prefix, so all AWS resources are automatically named correctly per environment.

`local.config` looks up the correct sizing map for the current workspace. When you're on `dev`, `local.config.rds_instance_class` = `"db.t3.micro"`. Switch to `prod` and it automatically becomes `"db.t3.small"` — no variable changes needed.

**Data sources** are also defined alongside locals — they query AWS for live information:
```hcl
data "aws_caller_identity" "current" {}   # gets your AWS account ID
data "aws_region" "current" {}            # gets the current region

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name
}
```

These are used in the Lambda permission's `source_arn` to construct the correct ARN string without hardcoding account IDs.

---

## Step 5 — Resources

Resources are the actual AWS things Terraform creates. Every resource block follows the same pattern:

```hcl
resource "<provider_type>" "<local_name>" {
  argument = value
}
```

Example from `modules/networking/main.tf`:
```hcl
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr        # "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.name_prefix}-vpc" } # "agriconnect-dev-vpc"
}
```

- `aws_vpc` = the provider type (tells Terraform: call the AWS API to create a VPC)
- `main` = the local name (used to reference this resource elsewhere in the same module)
- `var.vpc_cidr` = input from the module's variables

**Referencing a resource's output attribute:**
Once you declare a resource, you can reference its attributes:
```hcl
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id    # ← uses the VPC's ID once it is created
}
```

`aws_vpc.main.id` is how you say "the `id` attribute of the resource named `main` of type `aws_vpc`". Terraform figures out that it must create the VPC first before the gateway, because the gateway depends on the VPC's ID.

**The `count` meta-argument** — creates multiple copies of a resource:
```hcl
resource "aws_subnet" "public" {
  count             = length(var.public_subnet_cidrs)   # creates 2 subnets
  cidr_block        = var.public_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]
}
```

`count.index` is 0 on the first iteration, 1 on the second. This creates `aws_subnet.public[0]` and `aws_subnet.public[1]` — one for each CIDR in the list.

---

## Step 6 — Modules

Modules are reusable groups of resources. Instead of writing hundreds of lines in one file, you break infrastructure into logical folders. Each folder is a module.

**Think of a module like a function:** it takes inputs (variables), creates resources, and returns outputs.

**How a module is called from `main.tf`:**
```hcl
module "networking" {
  source               = "./modules/networking"   # folder path

  # These are the module's inputs (defined in modules/networking/variables.tf)
  name_prefix          = local.name_prefix
  vpc_cidr             = var.vpc_cidr
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  availability_zones   = var.availability_zones
}
```

**Inside `modules/networking/`:**
- `variables.tf` — declares what inputs this module accepts
- `main.tf` — creates VPC, subnets, NAT gateway, route tables
- `outputs.tf` — exposes values for other modules to use

**Using a module's output in another module:**
```hcl
module "security" {
  source = "./modules/security"
  vpc_id = module.networking.vpc_id   # output from networking module
}

module "ec2" {
  source       = "./modules/ec2"
  common_sg_id = module.security.common_sg_id   # output from security module
}
```

This creates a dependency chain: networking → security → ec2. Terraform builds a dependency graph from these references and applies in the correct order automatically.

**The complete module dependency chain in this project:**
```
networking
    ↓
security (needs vpc_id from networking)
    ↓
rds     (needs private_subnet_ids, common_sg_id)
ec2     (needs public/private subnets, security group, instance profile)
s3      (no upstream dependencies)
    ↓
alb     (needs vpc_id, ec2 instance IDs)
    ↓
cloudfront (needs alb_dns_name)
```

**The CloudFront module is special** — it uses a multi-provider pattern because WAF must be in us-east-1:

```hcl
module "cloudfront" {
  source = "./modules/cloudfront"

  providers = {
    aws           = aws           # default provider (ap-south-1) for CloudFront
    aws.us_east_1 = aws.us_east_1 # aliased provider for WAF
  }

  alb_dns_name = module.alb.alb_dns_name
}
```

Inside `modules/cloudfront/main.tf`, the module declares it needs both providers:
```hcl
terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 5.0"
      configuration_aliases = [aws.us_east_1]   # declares it accepts a second alias
    }
  }
}

resource "aws_wafv2_web_acl" "main" {
  provider = aws.us_east_1   # this resource goes to us-east-1
  ...
}

resource "aws_cloudfront_distribution" "main" {
  # no provider = uses the default one passed in
  ...
}
```

---

## Step 7 — Outputs

**File:** `terraform/outputs.tf`

Outputs are values that Terraform prints to your terminal after a successful `apply`. They are also accessible programmatically and can be passed between separate Terraform configurations.

```hcl
output "cloudfront_url" {
  description = "Primary app URL"
  value       = module.cloudfront.cloudfront_url
}

output "rds_endpoint" {
  value     = module.rds.endpoint
  sensitive = true   # printed as <sensitive> in terminal, but stored in state
}

output "ssh_bastion" {
  value = "ssh -i ~/.ssh/${var.key_pair_name}.pem ubuntu@${module.ec2.bastion_public_ip}"
}
```

After `terraform apply` completes, you see:
```
Outputs:

cloudfront_url = "https://d1234abc.cloudfront.net"
ssh_bastion    = "ssh -i ~/.ssh/my-key.pem ubuntu@13.234.x.x"
rds_endpoint   = <sensitive>
```

**Reading an output after the fact:**
```bash
terraform output cloudfront_url
terraform output -raw cloudfront_url    # no quotes, useful for scripts
terraform output -json                   # all outputs as JSON
```

**Module outputs** work the same way — `modules/networking/outputs.tf` exposes `vpc_id` and `public_subnet_ids`, which `main.tf` then reads as `module.networking.vpc_id`.

---

## Step 8 — terraform plan

```bash
terraform plan
```

Plan compares what is in your `.tf` files against what is recorded in the state file and shows you exactly what will change — without making any actual changes.

**What the symbols mean:**
```
+ create     ← this resource will be created
- destroy    ← this resource will be deleted
~ update     ← this resource will be modified in place
-/+ replace  ← this resource will be destroyed and recreated
```

**Always read the plan carefully before applying.** If you see `-/+ replace` on your RDS instance, that means your database will be destroyed and recreated — a major destructive change.

Example output snippet:
```
  # module.networking.aws_vpc.main will be created
  + resource "aws_vpc" "main" {
      + cidr_block = "10.0.0.0/16"
      + id         = (known after apply)
    }

Plan: 47 to add, 0 to change, 0 to destroy.
```

`(known after apply)` means Terraform doesn't know the value yet because it can only be determined after AWS creates the resource (like the VPC's ID).

---

## Step 9 — terraform apply

```bash
terraform apply
```

Runs a plan, shows it to you, and asks "Do you want to perform these actions?" You type `yes` to proceed.

```bash
terraform apply -auto-approve   # skips the yes/no prompt (use in CI/CD only)
```

Terraform applies resources in parallel wherever possible (respecting the dependency graph). Resources with no dependencies on each other are created simultaneously.

**What happens for this project on first apply (47 resources):**
1. Networking module creates VPC, subnets, IGW, NAT gateway, route tables in parallel where possible
2. Security module creates security group, IAM roles, instance profiles
3. S3 module creates both buckets (no dependencies, runs in parallel with security)
4. RDS module creates the MySQL instance (waits for networking + security)
5. EC2 module creates bastion, frontend, backend instances (waits for networking + security)
6. ALB module creates load balancer, target groups, listener rules (waits for EC2 instance IDs)
7. Root main.tf creates Secrets Manager secrets, SNS topics, SQS queues, Lambda, EventBridge scheduler
8. CloudFront module creates WAF in us-east-1 and CloudFront distribution

Total time: ~15-20 minutes (RDS and CloudFront are the slowest).

---

## Step 10 — Terraform State

State is the most important concept in Terraform. It is a JSON file (`terraform.tfstate`) that records every resource Terraform has created and their current attribute values (IDs, ARNs, IP addresses, etc.).

**Why state is necessary:**
When you run `terraform plan`, Terraform needs to know what already exists. Without state, it has no memory — it would try to create everything from scratch every time, causing duplicate resources and errors.

**What state contains (example entry):**
```json
{
  "type": "aws_vpc",
  "name": "main",
  "provider": "aws",
  "instances": [{
    "attributes": {
      "id": "vpc-0a1b2c3d4e",
      "cidr_block": "10.0.0.0/16",
      "arn": "arn:aws:ec2:ap-south-1:978594443309:vpc/vpc-0a1b2c3d4e"
    }
  }]
}
```

Terraform uses this to know that `aws_vpc.main` already exists with ID `vpc-0a1b2c3d4e`. On next plan, it queries AWS for the current state of that VPC and compares it against what's in state and what's in your `.tf` files.

**Never manually edit the state file.** If you need to manipulate state, use `terraform state` commands.

**Useful state commands:**
```bash
terraform state list                          # list all resources in state
terraform state show module.ec2.aws_instance.backend  # show full details of one resource
terraform state rm aws_sns_topic.weather_alerts       # remove from state without destroying
terraform state mv old_name new_name          # rename a resource in state
```

---

## Step 11 — Remote State with S3

**File:** `terraform/versions.tf`

```hcl
backend "s3" {
  bucket  = "agriconnect-terraform-state"
  key     = "terraform.tfstate"
  region  = "ap-south-1"
  encrypt = true
}
```

Without a backend configuration, state is stored as a local file `terraform/terraform.tfstate`. This has problems:
- If your laptop is lost or reformatted, state is gone
- Two people can't work on the same infrastructure
- State for dev and prod get mixed up

With the S3 backend:
- State lives at `s3://agriconnect-terraform-state/terraform.tfstate` (default workspace) or `s3://agriconnect-terraform-state/env:/prod/terraform.tfstate` (prod workspace)
- Encrypted at rest (AES-256)
- Versioned — every apply creates a new version of the state file in S3, so you can roll back if needed
- Anyone with AWS credentials can run Terraform and get the correct state

**Migrating from local to S3:**
```bash
terraform init -migrate-state
# Terraform asks: "Do you want to copy existing state to the new backend?" → yes
```

---

## Step 12 — State Locking with DynamoDB (Not Implemented, but Explained)

State locking prevents two people (or two CI/CD pipelines) from running `terraform apply` at the same time, which could corrupt the state file.

**How it would work in this project:**
Add one line to the backend config:
```hcl
backend "s3" {
  bucket         = "agriconnect-terraform-state"
  key            = "terraform.tfstate"
  region         = "ap-south-1"
  encrypt        = true
  dynamodb_table = "agriconnect-terraform-locks"   # ← this line
}
```

Create the DynamoDB table first (one-time):
```bash
aws dynamodb create-table \
  --table-name agriconnect-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

**What happens with locking:**
1. You run `terraform apply` → Terraform writes a lock record to DynamoDB with your username and timestamp
2. Someone else runs `terraform apply` → Terraform tries to write a lock, sees one exists, and errors immediately:
   ```
   Error: Error acquiring the state lock
   Lock Info: ID=abc123, Operation=apply, Who=asad@laptop
   ```
3. Your apply finishes → lock record is deleted
4. Now the second person can run their apply

The DynamoDB table costs essentially nothing (on-demand billing, a few lock records = cents per month).

For a solo project like AgriConnect where you're the only one running Terraform, locking is optional. For a team, it's essential.

---

## Step 13 — Workspaces

Workspaces let you have multiple independent states in the same S3 bucket and the same codebase — one for dev, one for prod.

**The workspace-to-state mapping:**
```
default workspace → s3://agriconnect-terraform-state/terraform.tfstate
prod workspace    → s3://agriconnect-terraform-state/env:/prod/terraform.tfstate
```

**How workspaces work in this project:**

`locals.tf` contains:
```hcl
workspace_env = terraform.workspace == "default" ? "dev" : terraform.workspace
```

`terraform.workspace` is a built-in value — it's always the name of the current workspace. The `default` workspace is what exists before you create any named workspaces. We map it to `"dev"` so your existing dev infrastructure (already in the default workspace) keeps the same resource names.

**All workspace commands:**
```bash
terraform workspace list          # list all workspaces (* marks current)
terraform workspace show          # show current workspace name
terraform workspace new prod      # create a new empty workspace
terraform workspace select dev    # switch to default workspace (dev)
terraform workspace select prod   # switch to prod workspace
terraform workspace delete prod   # delete a workspace (must have no resources)
```

**What changes between workspaces:**

| What | dev (default) | prod |
|---|---|---|
| State file in S3 | `terraform.tfstate` | `env:/prod/terraform.tfstate` |
| `local.workspace_env` | `"dev"` | `"prod"` |
| Resource names | `agriconnect-dev-*` | `agriconnect-prod-*` |
| Secret paths | `agriconnect/dev/database` | `agriconnect/prod/database` |
| Backend EC2 size | t2.micro | t3.small |
| RDS class | db.t3.micro | db.t3.small |

**The golden rule:** Always check which workspace you're on before running `apply`.
```bash
terraform workspace show   # always do this first
```

---

## Step 14 — Dependencies (Implicit and Explicit)

Terraform builds a dependency graph automatically from resource references.

**Implicit dependency** — Terraform detects it automatically:
```hcl
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id   # ← Terraform sees this reference and knows:
                              #   create aws_vpc.main BEFORE aws_internet_gateway.main
}
```

Because `aws_vpc.main.id` is referenced, Terraform adds an edge in its graph: gateway depends on VPC.

**The full implicit dependency chain in this project:**
```
aws_vpc → aws_internet_gateway
aws_vpc → aws_subnet.public[0,1]
aws_vpc → aws_subnet.private[0,1]
aws_subnet.public[0] → aws_nat_gateway
aws_nat_gateway → aws_route.private_nat
module.networking → module.security (via vpc_id)
module.security → module.ec2 (via common_sg_id, ec2_instance_profile_name)
module.networking → module.ec2 (via subnet IDs)
module.ec2 → module.alb (via backend_instance_id, frontend_instance_id)
module.alb → module.cloudfront (via alb_dns_name)
module.rds → aws_secretsmanager_secret_version.database (via endpoint)
```

**Explicit dependency with `depends_on`** — used when there is no reference but ordering still matters:

```hcl
# In main.tf — EventBridge scheduler
resource "aws_scheduler_schedule" "weather_check" {
  ...
  depends_on = [aws_lambda_permission.scheduler_invoke]
}
```

Why this is needed: `aws_lambda_permission.scheduler_invoke` uses a constructed string for `source_arn` instead of referencing `aws_scheduler_schedule.weather_check.arn`. Because of this string construction, Terraform doesn't see a reference and doesn't know these two resources are related. Without `depends_on`, Terraform might create the scheduler before the Lambda permission exists — meaning the scheduler would try to invoke the Lambda before it has permission to do so.

`depends_on` tells Terraform: "always create `aws_lambda_permission.scheduler_invoke` before creating `aws_scheduler_schedule.weather_check`".

**When to use `depends_on`:**
- When using constructed strings (ARNs, names) instead of direct resource references
- When two resources interact at runtime but have no configuration-level reference to each other
- When a module depends on a side effect of another module (not its outputs)

---

## Step 15 — Terraform Taint and -replace

`terraform taint` was the old command (Terraform < 0.15) to mark a resource as "damaged" so it gets destroyed and recreated on the next apply. It has been replaced by the `-replace` flag.

**Modern syntax:**
```bash
terraform apply -replace="module.ec2.aws_instance.backend"
```

**What this does:** Forces Terraform to destroy and recreate that specific resource even if nothing in your config changed. The rest of the infrastructure is untouched.

**How this could be used in this project:**

*Scenario 1 — EC2 instance is corrupted:*
Your `agriconnect-dev-backend` EC2 got into a bad state. Services are not starting. The fastest fix is to replace the instance — Terraform will destroy it and provision a fresh one with the same user-data script:
```bash
terraform apply -replace="module.ec2.aws_instance.backend"
```

*Scenario 2 — Lambda deployment not picking up new code:*
You updated `lambda/weather-alert-processor/index.js` but `source_code_hash` didn't detect the change (rare edge case):
```bash
terraform apply -replace="aws_lambda_function.weather_alert"
```

*Scenario 3 — RDS got stuck in a bad parameter state:*
```bash
terraform apply -replace="module.rds.aws_db_instance.main"
```
WARNING: this destroys your database. For RDS, always take a manual snapshot first.

*Scenario 4 — Bastion host SSH key is compromised:*
Forcing a new bastion instance with the same configuration effectively rotates the instance (new instance ID, same key pair):
```bash
terraform apply -replace="module.ec2.aws_instance.bastion"
```

---

## Step 16 — Module Registry

The Terraform Registry (`registry.terraform.io`) is the public marketplace of modules written by the community and AWS. Instead of writing your own VPC module from scratch, you can use a published one.

**Example — using the official AWS VPC module from the registry:**
```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"   # registry.terraform.io source
  version = "~> 5.0"

  name            = "agriconnect-dev-vpc"
  cidr            = "10.0.0.0/16"
  azs             = ["ap-south-1a", "ap-south-1b"]
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24"]
  enable_nat_gateway = true
}
```

This would replace your entire `modules/networking/` folder — the registry module creates VPC, subnets, IGW, NAT, route tables — identical to what your custom module does but with more options.

**In this project** you wrote all modules yourself (`source = "./modules/networking"`). This gives you full control and understanding of every resource created. Registry modules are better for teams who want battle-tested, AWS-recommended patterns without maintaining the code themselves.

**When to use registry vs custom:**
- Solo project / learning: write your own (like this project) — you understand every line
- Team / production: use registry modules — they're tested by thousands of users and maintained by AWS partners

---

## Step 17 — Terraform Drift

Drift happens when the real state of your AWS infrastructure is different from what Terraform's state file says it should be.

**How drift happens in this project:**

*Example 1:* You SSH into the bastion and manually add an inbound rule to the security group in the AWS console — "just for a quick test." Now AWS has that rule but Terraform's state doesn't know about it.

*Example 2:* Someone manually changes the RDS instance class from `db.t3.micro` to `db.t3.small` directly in the AWS console during an incident.

*Example 3:* An S3 bucket gets additional tags applied by an AWS Config rule.

**Detecting drift:**
```bash
terraform plan
```
Plan always refreshes state from AWS before comparing. If drift exists, plan will show changes. Example:
```
~ resource "aws_security_group" "common" {
    ~ ingress = [
        - {          ← this rule exists in AWS but not in your config
            from_port = 8080
            to_port   = 8080
          }
      ]
  }
```

**Handling drift — two options:**

Option 1 — Fix it (recommended): Run `terraform apply` to bring AWS back to your declared configuration. The manually added rule gets removed.

Option 2 — Accept it: If the manual change was intentional, update your `.tf` file to include it, then `terraform apply` to reconcile state. Now the change is code-controlled.

**Force a full refresh:**
```bash
terraform plan -refresh-only    # only refresh state, show what drifted, make no changes
terraform apply -refresh-only   # update state to match current AWS reality (use carefully)
```

**Best practice:** Never touch infrastructure manually in the AWS console if Terraform manages it. Any manual change creates drift and can be overwritten on the next `terraform apply`. If you need to make a quick change, make it in the `.tf` files and apply.

---

## Step 18 — Other Important Commands

**Validate syntax:**
```bash
terraform validate   # checks .tf files for syntax errors without connecting to AWS
```

**Format code:**
```bash
terraform fmt        # auto-formats all .tf files to standard indentation
terraform fmt -check # CI check: exits with error if files are not formatted
```

**Destroy everything:**
```bash
terraform destroy    # destroys ALL resources in current workspace
```
This is irreversible for your database. Always double-check the workspace first.

**Destroy one specific resource:**
```bash
terraform destroy -target="aws_sns_topic.weather_alerts"
```

**Apply only a specific resource:**
```bash
terraform apply -target="module.cloudfront"
```
Useful when you've added CloudFront to an existing setup and don't want to touch the rest.

**Import an existing resource into state:**
```bash
terraform import aws_s3_bucket.my_bucket my-existing-bucket-name
```
Used when you have existing AWS resources not created by Terraform and want Terraform to start managing them.

---

## Step 19 — The Full Workflow for This Project

```bash
# 1. First time only — create S3 bucket for state
bash scripts/tf-bootstrap.sh

# 2. Initialize (every new clone or after adding modules/providers)
cd terraform
terraform init

# 3. Check which workspace you're on
terraform workspace show      # should say "default" (= dev)

# 4. See what will change
terraform plan

# 5. Apply
terraform apply

# 6. After apply — check your outputs
terraform output cloudfront_url
terraform output ssh_bastion

# --- When you want to set up prod someday ---

# 7. Create prod workspace
terraform workspace new prod

# 8. Apply prod (uses prod.tfvars with prod-specific values)
terraform apply -var-file=prod.tfvars

# 9. Switch back to dev
terraform workspace select default
```

---

## Step 20 — Summary: What Each File Does

| File | Role |
|---|---|
| `versions.tf` | Declares Terraform version, S3 backend, required providers |
| `providers.tf` | Configures AWS credentials region + aliased us-east-1 provider for WAF |
| `variables.tf` | All input parameters (region, passwords, bucket names, instance sizes) |
| `locals.tf` | Derived values: workspace→env mapping, sizing config map, name prefix, tags |
| `main.tf` | Calls all 7 modules + creates Secrets Manager, SNS, SQS, Lambda, EventBridge |
| `outputs.tf` | Prints CloudFront URL, SSH commands, ARNs, IPs after apply |
| `modules/networking/` | VPC, 2 public subnets, 2 private subnets, IGW, NAT gateway, route tables |
| `modules/security/` | Security group (ports 22/80/443/3001-3005/3306) + 3 IAM roles + instance profile |
| `modules/ec2/` | Bastion (public), frontend (public), backend (private) EC2 instances |
| `modules/alb/` | ALB, 6 target groups, 1 listener, 5 path-based routing rules |
| `modules/rds/` | MySQL 8 RDS in private subnet, no public accessibility |
| `modules/s3/` | produce-images bucket + delivery-proofs bucket |
| `modules/cloudfront/` | WAF (us-east-1) + CloudFront distribution with 3 cache behaviors |
| `scripts/tf-bootstrap.sh` | One-time: creates S3 state bucket with versioning + encryption |
