# PPT Generation Brief — AgriConnect Cloud Architecture

## Project Context (Read this before generating slides)

AgriConnect is a full-stack cloud-native agricultural marketplace built on AWS. It connects farmers and buyers for direct produce trading, eliminating middlemen. The backend is built as 5 Node.js microservices (Auth, Marketplace, Orders, Media, Notifications) running on EC2, with a React frontend. The entire infrastructure is provisioned using Terraform (IaC) on AWS in the Mumbai region (ap-south-1).

Key AWS services used: CloudFront, WAF, ALB (Application Load Balancer), EC2, RDS MySQL, S3, SNS, SQS (with Dead Letter Queue), Lambda, EventBridge Scheduler, Secrets Manager, IAM — all deployed and managed via Terraform with remote state on S3.

Please generate a professional, clean, modern PowerPoint presentation. Use an agricultural/tech theme — dark greens, earthy tones, and white text. Each slide should be visually clean with icons or minimal diagrams where appropriate. The tone is professional and technical — suitable for a cloud/DevOps portfolio or university project presentation.

---

## Slide 1 — Title Slide

**Title:** AgriConnect

**Subtitle:** A Cloud-Native Agricultural Marketplace on AWS

**Tagline:** Connecting Farmers to Buyers — Directly, Digitally, at Scale

**Footer:** Built on AWS | Terraform IaC | Microservices Architecture

---

## Slide 2 — Problem Statement & Application Overview

**Title:** The Problem We're Solving

**Headline:** Indian farmers lose 30–40% of their income to middlemen

**Problem Points:**
- Small and marginal farmers have no direct access to buyers — they depend on local agents who take large commissions
- Buyers (wholesalers, retailers, consumers) struggle to source fresh produce with price transparency
- No digital platform exists that gives farmers real-time market pricing, bidding, and direct communication with buyers
- Weather events destroy crops with no early warning system in place for farmers

**Our Solution — AgriConnect:**
- A direct digital marketplace where farmers list their produce and buyers browse, bid, or purchase instantly
- Real-time bidding system — buyers compete, farmers get the best price
- Weather alert system — farmers receive automated weather warnings for their region
- End-to-end order tracking with delivery proof upload
- Instant notifications via email and in-app bell for every key event

**Built For:**
- Farmers: list crops, manage orders, receive bids, get weather alerts
- Buyers: browse listings, place bids, buy directly, track deliveries

---

## Slide 3 — Architecture Diagram

*(Architecture diagram — added separately)*

---

## Slide 4 — CloudFront & WAF

**Title:** CloudFront + WAF — Edge Security & Global Delivery

**Section Header:** The first two layers every user request passes through

**CloudFront — Content Delivery Network:**
- Sits at the edge of the AWS global network — closest server to the user responds
- Terminates HTTPS at the edge — SSL/TLS encryption handled here, not at the application server
- 3 cache behaviors configured:
  - `/*` — forwards all requests to the ALB (default)
  - `/static/*` — caches static assets (React JS, CSS, images) at the edge for 1 day
  - `/api/*` — bypasses cache, forwards live API calls to ALB
- Reduces latency for Indian users — AWS edge locations in Mumbai, Chennai, Delhi

**WAF (Web Application Firewall) — Why it must be in us-east-1:**
- AWS requires that WAF for CloudFront distributions is created in us-east-1 (hard AWS constraint)
- AgriConnect uses a second Terraform provider aliased to us-east-1 specifically for this resource

**WAF Protection Rules in AgriConnect:**
- AWS Managed Rule: **CommonRuleSet** — blocks common web exploits (path traversal, bad user-agents)
- AWS Managed Rule: **SQLiRuleSet** — blocks SQL injection attempts on all API endpoints
- **Rate Limiting Rule** — blocks any single IP sending more than 2,000 requests per 5 minutes (DDoS / scraper protection)
- Any blocked request returns 403 instantly — never reaches EC2 servers

**Flow:** User → CloudFront (edge cache) → WAF (security filter) → ALB (origin)

---

## Slide 5 — Application Load Balancer

**Title:** Application Load Balancer — High Availability & Smart Routing

**Section Header:** One entry point. Six services. Zero confusion.

**What the ALB does in AgriConnect:**
- Single entry point for all backend traffic coming from CloudFront
- Routes each request to the correct microservice based on the URL path — no service needs to know about the others
- Spans two Availability Zones (ap-south-1a and ap-south-1b) for high availability — if one AZ goes down, traffic automatically shifts

**Path-Based Routing Rules (in priority order):**

| Priority | URL Path | Target Service | Port |
|---|---|---|---|
| 10 | /api/auth/* | Auth Service | 3001 |
| 20 | /api/marketplace/* | Marketplace Service | 3002 |
| 30 | /api/orders/* | Order Service | 3003 |
| 40 | /api/media/* | Media Service | 3004 |
| 50 | /api/notifications/* | Notification Service | 3005 |
| Default | /* | React Frontend | 80 |

**Health Checks:**
- ALB sends a GET /health request to each service every 30 seconds
- If a service fails 3 consecutive health checks → ALB stops sending traffic to it
- Ensures zero downtime routing — unhealthy targets are automatically removed

**High Availability Setup:**
- ALB itself is distributed across 2 public subnets in 2 AZs
- If one AZ or instance fails, ALB routes 100% of traffic to the healthy AZ

---

## Slide 6 — Amazon S3

**Title:** Amazon S3 — Scalable Object Storage for Produce & Deliveries

**Section Header:** Two dedicated buckets. Two distinct purposes.

**Bucket 1 — agriconnect-produce-images**
- Farmers upload photos of their crop listings (wheat, rice, vegetables, fruits)
- Images stored as objects with unique keys — referenced in the RDS listings table
- EC2 backend uploads via AWS SDK using the IAM instance profile (no hardcoded keys)
- Used by: Marketplace Service (port 3002) and Media Service (port 3004)

**Bucket 2 — agriconnect-delivery-proofs**
- Buyers upload delivery confirmation photos when they receive their order
- Photo reference stored in the orders table in RDS
- Triggers order status update to "delivered" — farmer gets notified via SNS
- Used by: Order Service (port 3003)

**Why S3 and not storing on EC2:**
- EC2 instance storage is ephemeral — if the instance is replaced, files are lost
- S3 is infinitely scalable, durable (99.999999999% — 11 nines), and costs a fraction of EBS
- Objects accessible from any EC2 instance, Lambda, or future service — decoupled from compute

**Security:**
- Both buckets: versioning enabled, public access completely blocked
- Access only via IAM role attached to EC2 (no public URLs, no hardcoded credentials)
- Secrets Manager stores bucket names and region for services to read on startup

---

## Slide 7 — SNS & SQS — Event-Driven Notifications

**Title:** SNS + SQS — Decoupled, Async Event Pipeline

**Section Header:** No direct calls. No tight coupling. Every event flows through the pipeline.

**Two SNS Topics:**
- **AgriConnect-Events** — receives all platform events (order placed, bid accepted, delivery confirmed)
- **AgriConnect-WeatherAlerts** — receives weather alert messages published by Lambda

**Why SNS first instead of writing to DB directly?**
- Backend services don't need to wait for notification logic to complete — they publish and move on
- SNS can fan-out to multiple subscribers simultaneously (SQS, email, SMS — all at once)
- Decouples business logic from notification delivery

**SQS Queue — AgriConnect-Notifications-Queue:**
- SNS delivers every event message into this queue automatically (subscription)
- **Visibility timeout: 30 seconds** — when the Notification Service picks up a message, it's hidden from all other consumers during processing. If not deleted in 30s, it reappears for retry
- **Long polling: 20 seconds** — Notification Service waits up to 20s for a message instead of constantly hammering the API (cheaper, faster)
- **Retention: 1 day** — unprocessed messages stay for 24 hours

**Dead Letter Queue (DLQ) — AgriConnect-Notifications-DLQ:**
- If a message fails processing 3 times → automatically moved to the DLQ
- **Retention: 14 days** — messages sit here for investigation/debugging
- Ensures no notification is silently lost — all failures are captured

**Full Event Flow:**
```
Backend Service → SNS Topic → SQS Queue → Notification Service → RDS (bell) + Gmail (email)
                                               ↓ on 3 failures
                                             DLQ (14 days)
```

---

## Slide 8 — Lambda & EventBridge — Serverless Weather Alerts

**Title:** Lambda + EventBridge — Serverless Weather Intelligence

**Section Header:** Automated. Scheduled. Serverless. Zero servers to manage.

**The Problem It Solves:**
- Farmers need to be warned about bad weather before it damages their crops
- This check must happen automatically, repeatedly, without any user triggering it
- Running a 24/7 server just for a weather check every 6 hours is wasteful

**EventBridge Scheduler:**
- Triggers the Lambda function automatically every 6 hours
- Timezone: Asia/Kolkata (IST) — aligned with Indian farmers' day
- Flexible time window: OFF (fires exactly on schedule, not within a window)
- IAM role attached: only allowed to invoke this one specific Lambda function

**Lambda Function — weather-alert-processor:**
- Runtime: Node.js 18.x | Timeout: 60 seconds
- Code: `lambda/weather-alert-processor/index.js`
- Deployed via Terraform — source code hash tracked, auto-redeployed on any code change

**What the Lambda Does (step by step):**
1. Queries RDS for all active farmers and their registered locations
2. For each unique location → calls the OpenWeather API
3. Checks for dangerous conditions: heavy rain, frost, extreme heat, strong winds
4. Generates a personalised alert message for each affected farmer
5. Publishes to **AgriConnect-WeatherAlerts** SNS topic
6. Also publishes to **AgriConnect-Events** SNS topic (so it flows through SQS → Notification Service)

**End Result for Farmer:**
- Bell notification appears on dashboard: "Heavy rainfall expected in Pune tomorrow — secure your harvest"
- Email sent to registered address
- No manual check needed — completely automated

**Key AWS wiring:**
- `aws_lambda_permission` — explicitly allows EventBridge Scheduler to invoke Lambda
- `depends_on` in Terraform — ensures permission is created before the scheduler

---

## Slide 9 — Amazon RDS — The Database Layer

**Title:** Amazon RDS — Managed Relational Database

**Section Header:** All application data lives here. Fully managed. Private. Secure.

**Database:** MySQL 8.0 on Amazon RDS
- Instance class: `db.t3.micro` (dev) / `db.t3.small` (prod)
- Storage: 20 GB (dev) / 50 GB (prod) — General Purpose SSD
- Database name: `agriconnect`

**What's Stored in RDS:**

| Table | Owned By | Contents |
|---|---|---|
| users | Auth Service | Farmer/Buyer profiles, hashed passwords, roles |
| listings | Marketplace Service | Crop listings, prices, quantity, image S3 keys |
| bids | Marketplace Service | Buyer bids on listings, status, amounts |
| orders | Order Service | Purchase orders, delivery status, proof S3 keys |
| notifications | Notification Service | Bell notification records, read/unread status |

**Security — why RDS is private-only:**
- Deployed in private subnets (10.0.10.0/24, 10.0.11.0/24)
- `publicly_accessible = false` — no public endpoint, zero exposure to internet
- Only EC2 instances inside the same VPC (same security group) can connect on port 3306
- Credentials stored in **Secrets Manager** (`agriconnect/dev/database`) — never hardcoded

**How Services Connect:**
1. Service starts → reads `agriconnect/dev/database` secret from Secrets Manager
2. Gets `{ host, port, username, password }` at runtime
3. Opens connection pool to RDS endpoint — fully inside the private subnet

**Why RDS over self-managed MySQL on EC2:**
- Automated backups, point-in-time recovery
- Automatic minor version patching
- Multi-AZ failover capability
- No DBA overhead — AWS manages the engine

---

## Slide 10 — IAM — Identity & Access Management

**Title:** IAM — Least Privilege Security Across All Services

**Section Header:** No hardcoded keys. Every service has exactly the permissions it needs — nothing more.

**Three IAM Roles in AgriConnect:**

**Role 1 — EC2 Instance Profile (ec2-role)**
Attached to: both Backend and Frontend EC2 instances
Permissions:
- `secretsmanager:GetSecretValue` — read DB credentials, JWT secret, SMTP config, S3 bucket names
- `s3:PutObject`, `s3:GetObject` — upload/download from produce-images and delivery-proofs buckets
- `sns:Publish` — publish order and bid events to AgriConnect-Events topic
- `sqs:SendMessage`, `sqs:ReceiveMessage`, `sqs:DeleteMessage` — interact with Notifications queue

**Role 2 — Lambda Execution Role (lambda-role)**
Attached to: weather-alert-processor Lambda function
Permissions:
- `sns:Publish` — publish weather alerts to both SNS topics
- `logs:CreateLogGroup`, `logs:PutLogEvents` — write execution logs to CloudWatch
- EC2 VPC networking permissions — allows Lambda to make network calls

**Role 3 — EventBridge Scheduler Role (scheduler-role)**
Attached to: EventBridge Scheduler rule
Permissions:
- `lambda:InvokeFunction` — invoke only the `weather-alert-processor` function
- Scoped with `sts:AssumeRole` — only EventBridge Scheduler service can assume this role

**The "No Hardcoded Keys" Pattern:**
- `agriconnect/dev/aws` secret in Secrets Manager contains: `{ access_key: "USE_IAM_ROLE" }`
- Backend services detect this value and fall back to the EC2 instance profile
- AWS SDK automatically picks up instance credentials from the metadata service
- Result: no AWS access keys stored in code, config files, environment variables, or databases

**Why This Matters:**
- If EC2 instance is compromised — attacker gets the IAM role, not permanent AWS keys
- Role permissions can be revoked instantly from IAM without touching the application
- Every API call is logged in CloudTrail — full audit trail of who accessed what

---

## Slide 11 — Terraform IaC — Infrastructure as Code

**Title:** Terraform — The Entire Infrastructure as Code

**Section Header:** 47 AWS resources. One command. Repeatable. Version-controlled. Environment-aware.

**What Terraform Manages (everything):**

| Module | Resources Created |
|---|---|
| networking | VPC, 2 public subnets, 2 private subnets, Internet Gateway, NAT Gateway, Route Tables |
| security | Security Groups, IAM Roles (EC2, Lambda, Scheduler), Instance Profile |
| ec2 | Bastion Host, Frontend EC2, Backend EC2 (all with user-data bootstrap scripts) |
| alb | Application Load Balancer, 6 Target Groups, 1 Listener, 5 Routing Rules |
| rds | MySQL 8 RDS instance, subnet group |
| s3 | produce-images bucket, delivery-proofs bucket (versioning + encryption) |
| cloudfront | CloudFront distribution + WAF Web ACL (dual-provider: ap-south-1 + us-east-1) |
| (root) | SNS topics, SQS queues, SQS policy, SNS subscription, Lambda, Lambda permission, EventBridge Scheduler, 5x Secrets Manager secrets |

**Key Terraform Features Used:**

**Remote State (S3 Backend)**
- State file stored in `s3://agriconnect-terraform-state` — not on local machine
- Versioned and encrypted — every apply creates a new state version
- Anyone with AWS credentials can run Terraform and get the correct state

**Workspaces (Dev / Prod)**
- `default` workspace = dev environment (existing infrastructure)
- `prod` workspace = production (larger instance sizes when needed)
- `locals.tf` maps workspaces to instance types: `dev → t2.micro`, `prod → t3.small`
- All resource names, secrets, S3 keys automatically include environment: `agriconnect/dev/database`

**Dual Provider (us-east-1 alias)**
- CloudFront WAF must live in us-east-1 — AWS hard requirement
- Terraform uses a second AWS provider aliased to us-east-1 only for the WAF resource
- Main infrastructure stays in ap-south-1

**Explicit `depends_on`**
- EventBridge Scheduler has `depends_on = [aws_lambda_permission.scheduler_invoke]`
- Ensures Lambda permission exists before the scheduler is created — prevents race condition at deploy time

**Sensitive Variables**
- `rds_password`, `jwt_secret`, `smtp_pass` declared `sensitive = true` in variables.tf
- Never printed in `terraform plan` output or stored in logs

**One-Command Deploy:**
```bash
bash scripts/tf-bootstrap.sh    # one-time: create S3 state bucket
terraform init                  # download providers, connect to remote state
terraform workspace select default
terraform plan                  # preview all 47 resources
terraform apply                 # provision entire AgriConnect infrastructure
```
