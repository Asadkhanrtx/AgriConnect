# AgriConnect Platform

> A cloud-native agricultural marketplace built on AWS EKS, connecting farmers and buyers across India with AI-powered assistance.

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Terraform Infrastructure](#2-terraform-infrastructure)
3. [Kubernetes & Helm](#3-kubernetes--helm)
4. [AWS Services](#4-aws-services)
5. [CI/CD Pipelines](#5-cicd-pipelines)
6. [AI Chatbots](#6-ai-chatbots)

---

## 1. Application Overview

AgriConnect is a microservices-based marketplace where farmers list produce and buyers place orders. The platform runs as 5 independent Node.js/Express services on Amazon EKS, all sharing a single MySQL RDS database via Sequelize ORM.

### Microservices

| Service | Port | Responsibility |
|---|---|---|
| **auth-service** | 3001 | JWT authentication, user registration, login, role management (admin/farmer/buyer) |
| **marketplace-service** | 3002 | Produce listings — create, search, filter by crop type, price, location |
| **order-service** | 3003 | Order lifecycle — place, accept, track, complete. Publishes events to SNS |
| **media-service** | 3004 | Image uploads for produce listings and delivery proofs — stored in S3 |
| **notification-service** | 3005 | Consumes SQS messages triggered by SNS, sends email/SMS notifications |

### How Services Talk to Each Other

Services do **not** call each other directly. They communicate via events:

```
order-service  →  SNS (AgriConnect-Events topic)
                    ↓
               SQS (Notifications-Queue)
                    ↓
          notification-service (polls SQS)
                    ↓
               Email / SMS to user
```

Direct API calls (auth token validation, listing lookups) go through the ALB via `/api/<service>/...` path routing defined in the Kubernetes Ingress.

### Database

All 5 services share one **MySQL 8.0 RDS** instance. Each service owns its own tables (Users, Listings, Orders, Media, Notifications). Sequelize models define the schema — `sequelize.sync({ alter: true })` creates or updates tables on first run without SQL scripts.

Credentials are never hardcoded. Pods fetch them from **AWS Secrets Manager** at startup using their IRSA role (no static AWS keys anywhere in the codebase).

---

## 2. Terraform Infrastructure

All AWS infrastructure is defined as code in `terraform/`. One `terraform apply` creates everything from scratch.

### Module Structure

```
terraform/
├── main.tf                   ← root: Lambda, S3, Secrets Manager, SNS, SQS, SSM
├── locals.tf                 ← name prefix, common tags, workspace config
├── variables.tf              ← all input variables
├── outputs.tf                ← SSM parameters written after apply
├── terraform.tfvars          ← actual values (gitignored for secrets)
├── policies/
│   └── aws-load-balancer-controller.json  ← IAM policy for ALB controller
└── modules/
    ├── networking/           ← VPC, subnets, IGW, route tables, NAT
    ├── security/             ← security groups, Lambda IAM role
    ├── rds/                  ← MySQL RDS instance, subnet group, parameter group
    ├── s3/                   ← produce images bucket, delivery proofs bucket
    ├── eks/                  ← EKS cluster, node groups, ECR repos, IRSA roles
    └── cloudfront/           ← CloudFront distribution, WAF, OAI
```

### Module: `networking`

Creates the entire network layer:
- **VPC** (`10.0.0.0/16`) with DNS support enabled
- **2 Public subnets** (across 2 AZs) — for ALB and NAT Gateways
- **2 Private subnets** — for EKS worker nodes and RDS
- **Internet Gateway** — public internet access
- **NAT Gateway** (one per AZ) — private subnet outbound traffic
- **Route tables** — public routes via IGW, private routes via NAT

### Module: `security`

Creates shared security groups:
- **Common SG** — allows EKS nodes to talk to RDS on port 3306
- **Lambda execution role** — allows Lambda to write CloudWatch logs, publish SNS, call Bedrock

### Module: `rds`

Creates the MySQL database:
- Engine: MySQL 8.0, class: `db.t3.micro` (dev) / `db.t3.small` (prod) — controlled by Terraform workspace
- Placed in **private subnets** — never publicly accessible
- Multi-AZ: disabled (dev), can be enabled for prod via workspace config
- Credentials stored in `terraform.tfvars`, automatically written to Secrets Manager by root `main.tf`

### Module: `s3`

Creates two application S3 buckets:
- `agriconnect-produce-images` — farmer crop photos uploaded via media-service
- `agriconnect-delivery-proofs` — proof-of-delivery photos for completed orders
- Both have public access blocked; pods access via IRSA, not bucket policies

### Module: `eks`

The largest module — creates the entire Kubernetes infrastructure:

**EKS Cluster:**
- Kubernetes v1.31, control plane managed by AWS
- OIDC provider enabled (required for IRSA)

**Node Group:**
- Instance type: `t3.medium` (configurable via `var.node_instance_type`)
- Min/Max/Desired nodes configurable — supports auto-scaling

**ECR Repositories** (5 repos, one per service):
```hcl
resource "aws_ecr_repository" "services" {
  for_each             = toset(["auth","marketplace","order","media","notification"])
  name                 = "agriconnect-${each.key}"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
}
```
- `scan_on_push = true` means every pushed image is automatically scanned for CVEs by ECR

**ECR Lifecycle Policy** (applied to each repo):
```hcl
resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = toset(["auth","marketplace","order","media","notification"])
  repository = aws_ecr_repository.services[each.key].name   # reference, not string
  # Keeps only the last 10 images — auto-deletes older ones
}
```

**IRSA Roles** (IAM Roles for Service Accounts — no static credentials):

| Role | Used by | Permissions |
|---|---|---|
| `eks-services-role` | App pods | Secrets Manager read, S3 read/write, SNS publish, SQS receive |
| `eks-lb-controller-role` | ALB controller pod | Full ELB management to provision ALBs from Ingress objects |

IRSA works by annotating the Kubernetes ServiceAccount with the IAM role ARN. When a pod starts, AWS injects temporary credentials via the OIDC token — no `AWS_ACCESS_KEY_ID` needed.

### Module: `cloudfront`

- **CloudFront Distribution** with two origins:
  - `S3` origin → serves the React frontend (`/`, `/*.js`, `/*.css`)
  - `ALB` origin → proxies `/api/*` to backend services
- **WAF (Web Application Firewall)** attached to CloudFront — AWS managed rule groups block SQLi, XSS, known bad IPs
- Distribution deployed to `us-east-1` (CloudFront requirement) using a provider alias

### Root `main.tf` — Resources Not in Modules

**Lambda Functions (3 total):**

All three Lambda functions follow the same pattern — Terraform zips the source code and deploys it:

```hcl
# Step 1: Terraform zips the source directory at plan time
data "archive_file" "farmbot" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/farmbot"   # your Python code
  output_path = "${path.module}/farmbot_package.zip" # output zip
}

# Step 2: Lambda is created with the zip as the deployment package
resource "aws_lambda_function" "farmbot" {
  filename         = data.archive_file.farmbot.output_path
  source_code_hash = data.archive_file.farmbot.output_base64sha256  # triggers redeploy on code change
  runtime          = "python3.12"
  handler          = "lambda_function.lambda_handler"
  timeout          = 30
}
```

`source_code_hash` is the SHA256 of the zip — Terraform only redeploys Lambda when the code actually changes.

**API Gateway (HTTP API) for each chatbot:**

```
POST /chat  →  API Gateway (HTTP API v2)  →  Lambda Proxy Integration  →  Lambda function
```

- Protocol: HTTP API (v2) — cheaper and lower latency than REST API
- Integration type: `AWS_PROXY` — API Gateway passes the full request to Lambda and returns Lambda's response directly
- CORS enabled — allows calls from the frontend
- `auto_deploy = true` on `$default` stage — no manual deployments needed

**Secrets Manager** — 5 secrets created:
- `agriconnect/dev/database` — RDS host, port, name, user, password
- `agriconnect/dev/jwt` — JWT secret and expiry
- `agriconnect/dev/aws` — set to `USE_IRSA` (pods never use static keys)
- `agriconnect/dev/email` — SMTP credentials for notification-service
- `agriconnect/dev/s3` — bucket names

**SNS + SQS Event Bus:**
- `AgriConnect-Events` SNS topic → `AgriConnect-Notifications-Queue` SQS subscription
- `AgriConnect-WeatherAlerts` SNS topic → admin email subscription
- SQS has a Dead Letter Queue (DLQ) — failed messages after 3 retries go here for inspection
- `visibility_timeout_seconds = 30` matches Lambda/service processing time

**EventBridge Scheduler:**
- Runs `weather-alert-processor` Lambda on a cron schedule (e.g., every morning)
- Lambda checks weather APIs and publishes to the WeatherAlerts SNS topic → email to farmers

**SSM Parameter Store** — written by Terraform after apply, read by GitHub Actions CI/CD:
```
/agriconnect/eks-cluster-name           → agriconnect-dev-eks
/agriconnect/eks-lb-controller-role-arn → arn:aws:iam::...
/agriconnect/eks-services-irsa-role-arn → arn:aws:iam::...
/agriconnect/public-subnet-ids          → subnet-xxx,subnet-yyy
/agriconnect/cloudfront-distribution-id → E2L7NFZTGMQ8ZK
/agriconnect/farmbot-api-url            → https://xxx.execute-api.ap-south-1.amazonaws.com/chat
/agriconnect/buyerbot-api-url           → https://yyy.execute-api.ap-south-1.amazonaws.com/chat
```
This means **no hardcoded ARNs or IDs anywhere in CI/CD** — pipelines read from SSM at runtime.

---

## 3. Kubernetes & Helm

The application is packaged as a single Helm chart at `helm/agriconnect/`.

### Chart Structure

```
helm/agriconnect/
├── Chart.yaml
├── values.yaml                    ← image tags updated by CI on every build
└── templates/
    ├── configmap.yaml             ← environment variables for all services
    ├── serviceaccount.yaml        ← annotated with IRSA role ARN
    ├── ingress.yaml               ← ALB Ingress — creates the load balancer
    ├── auth/
    │   ├── deployment.yaml
    │   ├── service.yaml
    │   └── hpa.yaml
    ├── marketplace/ ...
    ├── order/ ...
    ├── media/ ...
    └── notification/ ...
```

### How Deployments Work

Each service has identical structure:
- **2 replicas** minimum for high availability
- **Liveness probe** on `/health` — Kubernetes restarts pod if it fails 3 times
- **Readiness probe** on `/health` — pod only receives traffic after passing
- **Resource limits** (CPU/memory) — prevents one service from starving others
- **HPA (Horizontal Pod Autoscaler)** — scales pods up/down based on CPU/memory metrics

### IRSA ServiceAccount

```yaml
# serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: agriconnect-services
  annotations:
    eks.amazonaws.com/role-arn: {{ .Values.global.irsaRoleArn }}
```

All 5 deployments use this single ServiceAccount. When a pod starts, AWS injects a projected token into the pod. The AWS SDK automatically exchanges this token for temporary IAM credentials — no static keys, no secrets in environment variables.

### Ingress (ALB)

The Ingress object tells the AWS Load Balancer Controller to provision an ALB:
```yaml
annotations:
  kubernetes.io/ingress.class: alb
  alb.ingress.kubernetes.io/scheme: internet-facing
  alb.ingress.kubernetes.io/subnets: <public-subnet-ids from SSM>
```

Path routing rules:
```
/api/auth/*          → auth-service:3001
/api/marketplace/*   → marketplace-service:3002
/api/orders/*        → order-service:3003
/api/media/*         → media-service:3004
/api/notifications/* → notification-service:3005
```

### values.yaml — Image Tags

```yaml
auth:
  image:
    repository: 978594443309.dkr.ecr.ap-south-1.amazonaws.com/agriconnect-auth
    tag: e2d5d1e     # ← CI automatically updates this on every build
```

The `update-helm-values` CI job runs `sed` to replace the tag with the new commit SHA after all 5 images are built and pushed. This commit triggers Helm to pull the new image on next deploy.

---

## 4. AWS Services

### Summary

| Service | Role in AgriConnect |
|---|---|
| **EKS** | Runs all 5 microservices as pods |
| **ECR** | Private container registry — stores Docker images |
| **RDS (MySQL 8.0)** | Shared relational database |
| **Secrets Manager** | DB credentials, JWT secrets — fetched by pods at startup |
| **SSM Parameter Store** | Infra IDs (cluster name, ARNs) — read by CI/CD pipelines |
| **CloudFront** | Global CDN — serves React frontend + proxies /api/* to ALB |
| **WAF** | Web Application Firewall — protects CloudFront from attacks |
| **ALB** | Application Load Balancer — routes HTTP traffic to correct service pod |
| **S3** | Stores produce images, delivery proofs, Lambda zips, frontend build |
| **Lambda** | Serverless chatbots (FarmBot, BuyerBot) + weather alert processor |
| **API Gateway (HTTP)** | Public HTTP endpoint in front of each Lambda chatbot |
| **SNS** | Event fan-out — order events, weather alerts, critical bot alerts |
| **SQS** | Decoupled queue between SNS and notification-service |
| **EventBridge Scheduler** | Triggers weather Lambda on cron schedule |
| **Bedrock** | LLM inference (Amazon Nova Lite) — used by all 3 chatbots |
| **IAM / IRSA** | Zero static credentials — pods assume roles via OIDC tokens |
| **GuardDuty** | Threat detection — monitored by DevBot security scan |

---

## 5. CI/CD Pipelines

All pipelines live in `.github/workflows/`. Six total, two with manual approval gates.

### Pipeline 1 — `infra-terraform.yml` (Infrastructure)

**Trigger:** Push to `terraform/**` or manual `workflow_dispatch`

```
Push terraform change
    ↓
[Plan Job]
  terraform init
  terraform plan -out=tfplan     ← shows exactly what will change
  upload tfplan as artifact
    ↓
⏸ MANUAL APPROVAL (production environment gate)
  reviewer sees plan in logs before clicking Approve
    ↓
[Apply Job]
  downloads tfplan artifact
  terraform apply tfplan         ← applies the exact reviewed plan
    ↓
Auto-triggers CI Pipeline (workflow_run)
```

The plan artifact ensures apply runs exactly what was reviewed — no surprises.

### Pipeline 2 — `main.yml` (CI Pipeline Orchestrator)

**Trigger:** Push to `eks-migration`, or auto-triggered by infra-terraform completing, or manual `workflow_dispatch`

The `guard` job detects how it was triggered and sets `is_fresh_deploy`:

| Trigger | `is_fresh_deploy` | cd-backend runs? |
|---|---|---|
| `push` (code change) | `false` | Yes, if services/helm/shared changed |
| `workflow_run` from terraform | `true` | No (bootstrap handles first deploy) |
| `workflow_dispatch` with `fresh_deploy=true` | `true` | No |

```
guard (detect trigger)
    ↓
┌──────────────────────────── ALL 5 IN PARALLEL ────────────────────────────┐
│  ci-auth   ci-marketplace   ci-order   ci-media   ci-notification          │
│  (build → trivy scan → push ECR)  × 5                                      │
└────────────────────────────────────────────────────────────────────────────┘
    ↓ all 5 pass
update-helm-values (commits new SHA tags to values.yaml)
    ↓
cd-backend (if backend changed + not fresh deploy) ──→ ⏸ APPROVAL → helm upgrade
cd-frontend (always)                               ──→ build React → S3 + CloudFront invalidation
```

Running builds in parallel cuts build time from ~25 minutes to ~10 minutes.

### Pipeline 3 — `ci-*.yml` (Individual Service Builds — called by main.yml)

Each of the 5 service pipelines (`ci-auth.yml`, `ci-marketplace.yml`, etc.) does the same steps:

```
1. Checkout code
2. Login to ECR
3. Build Docker image (with GHA cache for speed)
4. Trivy security scan
     → severity: CRITICAL
     → exit-code: 1  (pipeline FAILS if CRITICAL CVE found)
     → ignore-unfixed: true (only fail on patchable CVEs)
5. Push to ECR with two tags:
     → :e2d5d1e (commit SHA — immutable, used by helm)
     → :latest  (convenience tag)
```

Trivy scan runs **before** push — a vulnerable image never reaches ECR.

### Pipeline 4 — `cd-backend.yml` (Helm Deploy)

**Trigger:** Called by main.yml after all builds pass + backend files changed

```
actions/checkout@v4 (ref: github.ref — gets LATEST commit including updated values.yaml)
    ↓
aws eks update-kubeconfig
    ↓
⏸ MANUAL APPROVAL (production environment gate)
    ↓
helm upgrade --install agriconnect ./helm/agriconnect
  --wait          ← waits for all pods to be Running
  --timeout 10m   ← fails if pods don't come up in 10 minutes
    ↓
kubectl rollout status (verifies each deployment)
```

The `ref: github.ref` checkout is critical — it gets the branch HEAD (with updated values.yaml from `update-helm-values`), not the original trigger SHA.

### Pipeline 5 — `bootstrap.yml` (Fresh Deploy — runs once after terraform apply)

**Trigger:** Manual `workflow_dispatch`, or auto after CI completes IF CI was triggered by terraform

The guard checks `github.event.workflow_run.event` — if CI was triggered by `workflow_run` (terraform), bootstrap proceeds. If CI was triggered by `push` (code change), bootstrap is skipped.

```
guard (only proceed if: manual OR CI came from terraform)
    ↓
Verify ECR images exist (safety check — abort if CI didn't push images)
    ↓
Read SSM parameters (cluster name, subnet IDs, IRSA roles, CloudFront ID)
    ↓
aws eks update-kubeconfig
    ↓
Install AWS Load Balancer Controller via Helm
  (creates serviceaccount annotated with lb-controller IRSA role)
    ↓
helm upgrade --install agriconnect (full chart deploy, waits for pods)
    ↓
Wait for ALB DNS to be assigned by LB controller
    ↓
Update CloudFront origin → new ALB DNS
    ↓
Run DB migration pod (node /app/shared/scripts/migrate.js)
  → sequelize.sync({ alter: true }) creates/updates all tables
    ↓
Run DB seed pod (node /app/shared/scripts/seed.js)
  → 20 farmers, 20 buyers, 100 listings, 50 orders
    ↓
Store ALB URL in SSM (/agriconnect/alb-dns-name)
```

### Full Auto-Chain After Terraform Apply

```
git push terraform/locals.tf
    ↓
infra-terraform.yml: plan → approve → apply
    ↓ (workflow_run, auto)
main.yml: guard (is_fresh_deploy=true) → 5 parallel builds → update values.yaml
    ↓ (workflow_run, auto — only because CI was triggered by terraform)
bootstrap.yml: install LB controller → deploy → migrate → seed → CloudFront
    ↓
App is live at CloudFront URL
```

---

## 6. AI Chatbots

AgriConnect has three AI-powered chatbots, all backed by **Amazon Bedrock** running **Amazon Nova** models on AWS infrastructure.

---

### 6.1 FarmBot — AI Assistant for Farmers

**What it does:** Helps farmers with crop advice, pest identification, weather alerts, and market guidance. Supports image uploads (farmers can photograph diseased crops and ask for diagnosis).

**Architecture:**

```
Farmer (frontend)  →  API Gateway HTTP  →  Lambda (farmbot-chatbot)  →  Amazon Bedrock
                                                    ↓
                                           S3 (log conversations)
                                                    ↓
                                      SNS (farmbot-critical-alerts) → Admin email
```

**Technical Stack:**
- **Runtime:** Python 3.12 on Lambda (30s timeout)
- **LLM:** Amazon Nova Lite (`amazon.nova-lite-v1:0`) via Bedrock Converse API
- **Image support:** Accepts crop photos up to 5MB (multimodal — text + image input)
- **Logging:** Conversations stored in private S3 bucket for audit
- **Critical alerts:** If Bedrock detects a critical pest outbreak or disease in the image, Lambda publishes to `farmbot-critical-alerts` SNS topic → admin gets email

**Terraform deployment:**
```hcl
data "archive_file" "farmbot" {
  type        = "zip"
  source_dir  = "../lambda/farmbot"       # Python source files
  output_path = "./farmbot_package.zip"   # zip created at terraform plan time
}

resource "aws_lambda_function" "farmbot" {
  filename         = data.archive_file.farmbot.output_path
  source_code_hash = data.archive_file.farmbot.output_base64sha256
  environment {
    variables = {
      MODEL_ID       = "amazon.nova-lite-v1:0"
      S3_BUCKET_NAME = aws_s3_bucket.farmbot_logs.bucket
      SNS_TOPIC_ARN  = aws_sns_topic.farmbot_critical.arn
    }
  }
}
```

**How requests flow:**
1. Farmer sends message (+ optional crop image) to `POST /chat`
2. API Gateway proxies to Lambda with full request payload
3. Lambda calls Bedrock `Converse` API with the message and image
4. Nova Lite generates agricultural advice
5. Response returned to farmer via API Gateway

---

### 6.2 BuyerBot — AI Assistant for Buyers

**What it does:** Helps buyers discover produce, compare market prices, understand seasonal availability, and navigate the marketplace. Aware of the live AgriConnect marketplace via ALB.

**Architecture:**

```
Buyer (frontend)  →  API Gateway HTTP  →  Lambda (buyerbot-chatbot)  →  Amazon Bedrock
                                                    ↓
                                          ALB → marketplace-service
                                          (can query live listings)
```

**Technical Stack:**
- **Runtime:** Python 3.12 on Lambda (60s timeout — longer for marketplace queries)
- **LLM:** Amazon Nova Lite (`amazon.nova-lite-v1:0`) via Bedrock Converse API
- **Live data access:** Lambda has `ALB_URL` env var — can call the marketplace-service API to fetch real listings and include them in context before calling Bedrock

**How requests flow:**
1. Buyer asks "What tomatoes are available under ₹30/kg?"
2. Lambda optionally queries marketplace-service via internal ALB for real-time listings
3. Listings are injected into the Bedrock prompt as context (RAG pattern — Retrieval Augmented Generation)
4. Nova Lite generates a natural language response grounded in actual marketplace data
5. Buyer gets an accurate, real-time answer — not a hallucinated one

**RAG Pattern used by BuyerBot:**
```
User question
    ↓
[Retrieval] Lambda calls marketplace-service API → fetches matching listings
    ↓
[Augmentation] Listings injected into prompt:
  "Here are current listings from AgriConnect: [data]
   Answer the user's question based on this data: [question]"
    ↓
[Generation] Bedrock Nova Lite generates grounded response
```

---

### 6.3 DevBot — DevSecOps AI Agent

**What it does:** Real-time observability and security agent for the AgriConnect infrastructure. Lets the DevOps team ask natural language questions about pods, pipelines, security findings, and AWS resources — and get answers backed by live tool calls.

**Location:** Separate repository (`devsecops-agent/`) — deployed independently.

**Architecture:**

```
DevOps Engineer  →  Frontend (Nginx/S3)  →  API Gateway  →  Lambda (devbot)
                                                                    ↓
                                                         Amazon Bedrock (Nova Pro)
                                                                    ↓
                                                    ┌───────────────────────────┐
                                                    │     Tool Calls            │
                                                    │  • get_pod_status         │
                                                    │  • get_pod_logs           │
                                                    │  • get_k8s_events         │
                                                    │  • get_security_summary   │
                                                    │  • get_pipeline_status    │
                                                    │  • get_cloudwatch_metrics │
                                                    │  • get_eks_nodegroups     │
                                                    │  • get_terraform_config   │
                                                    └───────────────────────────┘
```

**Technical Stack:**
- **Runtime:** Python 3.12 on Lambda (29s API Gateway hard limit)
- **LLM:** Amazon Nova Pro (`amazon.nova-pro-v1:0`) — more powerful than Lite, handles complex reasoning over tool outputs
- **Tool Calling:** Bedrock Converse API with `toolConfig` — Nova Pro decides which tools to call based on the user's question
- **Agentic Loop:** Up to 8 rounds of tool calls per request (agent reasons → calls tool → sees result → calls next tool)

**Available Tools:**

| Tool | What it does |
|---|---|
| `get_pod_status` | Lists all pods in EKS with status, restarts, age |
| `get_pod_logs` | Fetches last N lines from a specific pod |
| `describe_deployment` | Full deployment spec including image tags, resource limits |
| `restart_deployment` | Triggers rolling restart |
| `get_k8s_events` | Kubernetes events (scheduling failures, OOMKills, image pull errors) |
| `get_cloudwatch_metrics` | CPU/memory metrics from CloudWatch |
| `get_cloudwatch_logs` | Search application logs for patterns |
| `get_eks_nodegroups` | Node group details and utilization |
| `get_security_summary` | Runs all 5 security checks in parallel (see below) |
| `get_pipeline_status` | Recent GitHub Actions run statuses |
| `get_workflow_logs` | Logs from a specific CI/CD run |
| `get_recent_commits` | Recent git commits |
| `trigger_workflow` | Manually trigger a GitHub Actions workflow |
| `get_terraform_config` | Read terraform files from GitHub |

**Security Scanning (parallel):**

The `get_security_summary` tool runs all 5 checks simultaneously using Python `ThreadPoolExecutor`:

```python
checks = {
    "security_groups": check_security_groups,   # open ports to 0.0.0.0/0
    "iam_roles":       scan_iam_roles,           # overly permissive policies
    "ecr_scan":        get_ecr_scan_results,     # image CVEs per service
    "guardduty":       get_guardduty_findings,   # active threat detections
    "s3_buckets":      check_public_s3_buckets,  # publicly accessible buckets
}
with ThreadPoolExecutor(max_workers=5) as executor:
    futures = {executor.submit(fn): name for name, fn in checks.items()}
    for future in as_completed(futures, timeout=24):
        results[futures[future]] = future.result(timeout=20)
```

All 5 checks complete in ~17 seconds — well within API Gateway's 29s limit.

**Behavior Rules (System Prompt):**

DevBot follows strict tool-use rules to avoid timeouts:
- **Health check** → `get_pod_status` only (+ logs/events if unhealthy). Never calls security tools.
- **Security scan** → Always uses `get_security_summary` (parallel). Never calls individual security tools.
- **Incident** → `get_pod_status` → `get_pod_logs` → `get_k8s_events` in sequence.
- **Pipeline issue** → `get_pipeline_status` → `get_workflow_logs` on the failed run.

**Example interaction:**
```
User:  "Are all pods healthy?"
DevBot: [calls get_pod_status]
        → All 10 pods Running (2 replicas × 5 services), 0 restarts ✅

User:  "Run a security scan"
DevBot: [calls get_security_summary — all 5 checks in parallel, ~17s]
        → 3 risky security groups (port 22 open), 2 IAM roles with FullAccess,
          0 GuardDuty findings, 0 public S3 buckets, auth-service: 0 CRITICAL CVEs ✅
```

---

## Deployment Summary

| Step | Who | How |
|---|---|---|
| Infrastructure | Engineer | `git push terraform/` → GitHub Actions → approve → `terraform apply` |
| Build & Push Images | Automated | CI Pipeline auto-triggers after terraform |
| Bootstrap (first deploy) | Automated | bootstrap.yml auto-triggers after CI |
| Code deployments | Automated | Push to `services/` → CI → approve → `helm upgrade` |
| Rollback | Engineer | `helm rollback agriconnect <revision>` |
| Destroy | Engineer | `terraform destroy` |

---

*Managed by Terraform · Deployed on Amazon EKS · Region: ap-south-1*
