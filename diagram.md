# AgriConnect — Cloud Architecture Diagram

---

## Full Architecture Overview

```
╔══════════════════════════════════════════════════════════════════════════════════════════════╗
║                         AGRICONNECT — CLOUD ARCHITECTURE (AWS)                              ║
║                    Infrastructure managed by Terraform (IaC) from local                     ║
╚══════════════════════════════════════════════════════════════════════════════════════════════╝


  [ DEVELOPER / TERRAFORM ]
         │
         │  terraform apply (from local machine only, never from EC2)
         │  State stored in S3: agriconnect-terraform-state (ap-south-1)
         │
         ▼
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  Terraform IaC (local)                                                       │
  │  versions.tf  providers.tf  variables.tf  locals.tf  main.tf  outputs.tf    │
  │  modules: networking / security / ec2 / alb / rds / s3 / cloudfront         │
  └──────────────────────────────────────────────────────────────────────────────┘


════════════════════════════════════════════════════════════════════════════════════
  USER REQUEST FLOW
════════════════════════════════════════════════════════════════════════════════════


  [  USER BROWSER  ]
         │
         │  HTTPS — e.g. https://d1abc.cloudfront.net/api/marketplace/listings
         │
         ▼
╔══════════════════════════════════════════════════════════════════════════════════╗
║  AWS GLOBAL EDGE NETWORK  ──  Region: us-east-1  (required for CloudFront WAF) ║
║                                                                                  ║
║  ┌────────────────────────────────────────────────────────────────────────────┐ ║
║  │  CLOUDFRONT DISTRIBUTION  (agriconnect-dev-cf)                             │ ║
║  │                                                                            │ ║
║  │  Cache Behaviors:                                                          │ ║
║  │    /*              → Origin: ALB  (forwarded, not cached)                 │ ║
║  │    /static/*       → Origin: ALB  (cached at edge, TTL 1 day)             │ ║
║  │    /api/*          → Origin: ALB  (forwarded, cache disabled)             │ ║
║  │                                                                            │ ║
║  │  HTTPS termination happens here — user talks HTTPS to CloudFront          │ ║
║  │  CloudFront → ALB is plain HTTP (inside AWS network)                      │ ║
║  └──────────────────────────────┬─────────────────────────────────────────────┘ ║
║                                 │  every request passes through WAF first        ║
║  ┌──────────────────────────────▼─────────────────────────────────────────────┐ ║
║  │  WAF Web ACL  (scope: CLOUDFRONT — must live in us-east-1)                │ ║
║  │                                                                            │ ║
║  │  Rule 1: AWSManagedRulesCommonRuleSet   → blocks common web exploits      │ ║
║  │  Rule 2: AWSManagedRulesSQLiRuleSet     → blocks SQL injection            │ ║
║  │  Rule 3: Rate limit 2000 req / 5 min per IP → blocks DDoS / scrapers      │ ║
║  │                                                                            │ ║
║  │  ALLOW → request passes to ALB origin                                     │ ║
║  │  BLOCK → 403 returned to user immediately, never reaches your servers     │ ║
║  └──────────────────────────────┬─────────────────────────────────────────────┘ ║
╚═════════════════════════════════╪════════════════════════════════════════════════╝
                                  │  clean traffic forwarded to ALB (HTTP)
                                  │
                                  ▼
╔══════════════════════════════════════════════════════════════════════════════════════════════╗
║  AWS REGION: ap-south-1  (Mumbai)                                                           ║
║                                                                                              ║
║  ┌──────────────────────────────────────────────────────────────────────────────────────┐   ║
║  │  VPC  agriconnect-dev-vpc   CIDR: 10.0.0.0/16                                       │   ║
║  │  DNS support: enabled    DNS hostnames: enabled                                      │   ║
║  │                                                                                      │   ║
║  │  ┌──────────────────────────────────────────────────────────────────────────────┐   │   ║
║  │  │  INTERNET GATEWAY  (agriconnect-dev-igw)                                     │   │   ║
║  │  │  Attached to VPC — enables public subnets to reach the internet              │   │   ║
║  │  └──────────────────────────────────────────────────────────────────────────────┘   │   ║
║  │                                                                                      │   ║
║  │ ┌────────────────────────────────────────────────────────────────────────────────┐  │   ║
║  │ │  PUBLIC SUBNETS  (route table → Internet Gateway  0.0.0.0/0)                  │  │   ║
║  │ │                                                                                │  │   ║
║  │ │  AZ: ap-south-1a                        AZ: ap-south-1b                       │  │   ║
║  │ │  10.0.1.0/24                            10.0.2.0/24                           │  │   ║
║  │ │                                                                                │  │   ║
║  │ │  ┌──────────────────────────────────────────────────────────────────────────┐ │  │   ║
║  │ │  │  ALB  agriconnect-dev-alb  (Application Load Balancer)                   │ │  │   ║
║  │ │  │  Spans both public subnets (cross-AZ)   Listener: HTTP port 80           │ │  │   ║
║  │ │  │                                                                           │ │  │   ║
║  │ │  │  PATH-BASED ROUTING  (priority order)                                    │ │  │   ║
║  │ │  │  Priority 10   /api/auth/*          → TG: agriconnect-dev-tg-auth        │ │  │   ║
║  │ │  │  Priority 20   /api/marketplace/*   → TG: agriconnect-dev-tg-market      │ │  │   ║
║  │ │  │  Priority 30   /api/orders/*        → TG: agriconnect-dev-tg-orders      │ │  │   ║
║  │ │  │  Priority 40   /api/media/*         → TG: agriconnect-dev-tg-media       │ │  │   ║
║  │ │  │  Priority 50   /api/notifications/* → TG: agriconnect-dev-tg-notif       │ │  │   ║
║  │ │  │  Default        /*                  → TG: agriconnect-dev-tg-frontend    │ │  │   ║
║  │ │  └──────────────────────────────────────────────────────────────────────────┘ │  │   ║
║  │ │                                                                                │  │   ║
║  │ │  ┌─────────────────────────────────┐   ┌───────────────────────────────────┐  │  │   ║
║  │ │  │  NAT Gateway (ap-south-1a)      │   │  Bastion Host  t2.micro           │  │  │   ║
║  │ │  │  agriconnect-dev-nat            │   │  agriconnect-dev-bastion           │  │  │   ║
║  │ │  │  Elastic IP attached            │   │  SSH :22  public IP assigned      │  │  │   ║
║  │ │  │  Private subnet → internet      │   │  Jump server for private subnet   │  │  │   ║
║  │ │  └────────────────┬────────────────┘   └───────────────────────────────────┘  │  │   ║
║  │ └────────────────────│──────────────────────────────────────────────────────────┘  │   ║
║  │                      │ outbound route for private subnet                           │   ║
║  │                      │                                                             │   ║
║  │  ALB forwards to ────┼─────────────────────────────────────────────────────────   │   ║
║  │                      │                                                             │   ║
║  │ ┌────────────────────▼───────────────────────────────────────────────────────────┐│   ║
║  │ │  PRIVATE SUBNETS  (route table → NAT Gateway  0.0.0.0/0)                      ││   ║
║  │ │  No direct internet access — outbound only via NAT (for package installs etc) ││   ║
║  │ │                                                                                ││   ║
║  │ │  AZ: ap-south-1a                            AZ: ap-south-1b                   ││   ║
║  │ │  10.0.10.0/24                               10.0.11.0/24                      ││   ║
║  │ │                                                                                ││   ║
║  │ │  ┌─────────────────────────────────────────────────────────────────────────┐  ││   ║
║  │ │  │  Frontend EC2  agriconnect-dev-frontend   t2.micro  (ap-south-1a)       │  ││   ║
║  │ │  │  Ubuntu 24.04  →  React app served on port 80                          │  ││   ║
║  │ │  │  Receives: ALB default rule  /*                                         │  ││   ║
║  │ │  └─────────────────────────────────────────────────────────────────────────┘  ││   ║
║  │ │                                                                                ││   ║
║  │ │  ┌─────────────────────────────────────────────────────────────────────────┐  ││   ║
║  │ │  │  Backend EC2  agriconnect-dev-backend    t2.micro  (ap-south-1a)        │  ││   ║
║  │ │  │  Ubuntu 24.04   5 microservices run as separate processes               │  ││   ║
║  │ │  │                                                                         │  ││   ║
║  │ │  │  ┌─────────────────────────────────────────────────────────────────┐   │  ││   ║
║  │ │  │  │  Auth Service          port 3001   /api/auth/*                  │   │  ││   ║
║  │ │  │  │  JWT login, register, token refresh, role-based access          │   │  ││   ║
║  │ │  │  └─────────────────────────────────────────────────────────────────┘   │  ││   ║
║  │ │  │  ┌─────────────────────────────────────────────────────────────────┐   │  ││   ║
║  │ │  │  │  Marketplace Service   port 3002   /api/marketplace/*           │   │  ││   ║
║  │ │  │  │  Crop listings, produce uploads → S3, listing CRUD              │   │  ││   ║
║  │ │  │  └─────────────────────────────────────────────────────────────────┘   │  ││   ║
║  │ │  │  ┌─────────────────────────────────────────────────────────────────┐   │  ││   ║
║  │ │  │  │  Order Service         port 3003   /api/orders/*                │   │  ││   ║
║  │ │  │  │  Buy now, order tracking, delivery proof upload → S3            │   │  ││   ║
║  │ │  │  └─────────────────────────────────────────────────────────────────┘   │  ││   ║
║  │ │  │  ┌─────────────────────────────────────────────────────────────────┐   │  ││   ║
║  │ │  │  │  Media Service         port 3004   /api/media/*                 │   │  ││   ║
║  │ │  │  │  Image handling, S3 pre-signed URLs, bid management             │   │  ││   ║
║  │ │  │  └─────────────────────────────────────────────────────────────────┘   │  ││   ║
║  │ │  │  ┌─────────────────────────────────────────────────────────────────┐   │  ││   ║
║  │ │  │  │  Notification Service  port 3005   /api/notifications/*         │   │  ││   ║
║  │ │  │  │  Polls SQS queue → processes messages → saves to RDS + email    │   │  ││   ║
║  │ │  │  └─────────────────────────────────────────────────────────────────┘   │  ││   ║
║  │ │  │                                                                         │  ││   ║
║  │ │  │  All services on startup:                                               │  ││   ║
║  │ │  │    1. Read credentials from Secrets Manager (DB, JWT, SMTP, S3)         │  ││   ║
║  │ │  │    2. Connect to RDS MySQL                                              │  ││   ║
║  │ │  │    3. Begin serving requests                                            │  ││   ║
║  │ │  └─────────────────────────────────────────────────────────────────────────┘  ││   ║
║  │ │         │  MySQL           │  MySQL          │  S3 uploads                    ││   ║
║  │ │         ▼                  ▼                 ▼                                ││   ║
║  │ │  ┌───────────────────────────────┐   ┌──────────────────────────────────┐    ││   ║
║  │ │  │  RDS MySQL 8.0               │   │  S3 Buckets                      │    ││   ║
║  │ │  │  agriconnect-dev-rds          │   │  agriconnect-produce-images      │    ││   ║
║  │ │  │  db.t3.micro  20GB storage    │   │  agriconnect-delivery-proofs     │    ││   ║
║  │ │  │  Database: agriconnect        │   │                                  │    ││   ║
║  │ │  │  Private only, port 3306      │   │  Versioning enabled              │    ││   ║
║  │ │  │  No public endpoint           │   │  Private (no public access)      │    ││   ║
║  │ │  └───────────────────────────────┘   └──────────────────────────────────┘    ││   ║
║  │ └────────────────────────────────────────────────────────────────────────────────┘│   ║
║  └──────────────────────────────────────────────────────────────────────────────────┘    ║
║                                                                                           ║
║  ┌─────────────────── AWS MANAGED SERVICES  (outside VPC, in ap-south-1) ──────────────┐ ║
║  │                                                                                      │ ║
║  │  Secrets Manager                                                                     │ ║
║  │    agriconnect/dev/database  →  { host, port, username, password }                  │ ║
║  │    agriconnect/dev/jwt       →  { jwt_secret, jwt_expiry }                          │ ║
║  │    agriconnect/dev/email     →  { host, port, user, pass, from }                    │ ║
║  │    agriconnect/dev/aws       →  { access_key: USE_IAM_ROLE }                        │ ║
║  │    agriconnect/dev/s3        →  { produce_bucket, delivery_bucket, region }         │ ║
║  │                                                                                      │ ║
║  └──────────────────────────────────────────────────────────────────────────────────────┘ ║
╚══════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## Event & Notification Flow

```
════════════════════════════════════════════════════════════════════════════════════
  ASYNC EVENTS PIPELINE  (triggered by user actions on the platform)
════════════════════════════════════════════════════════════════════════════════════

  Examples of events that trigger this pipeline:
    ─ Buyer places an order
    ─ Farmer accepts / rejects a bid
    ─ Order delivery confirmed
    ─ Weather alert for a farmer's region


  [Backend Service]  (Order / Marketplace / Notification service on Backend EC2)
         │
         │  AWS SDK  →  sns.publish({ TopicArn, Message, Subject })
         │
         ▼
  ┌────────────────────────────────────────────────────────────┐
  │  SNS Topic:  AgriConnect-Events                            │
  │  Publisher:  any backend service                           │
  │  Message:    JSON  { type, userId, payload }               │
  └───────────────────────────┬────────────────────────────────┘
                              │  SNS fan-out subscription
                              │  (protocol: sqs, raw delivery)
                              ▼
  ┌────────────────────────────────────────────────────────────┐
  │  SQS Queue:  AgriConnect-Notifications-Queue               │
  │                                                            │
  │  visibility_timeout: 30 seconds                            │
  │    └─ message hidden from other consumers while processing │
  │  message_retention:  1 day                                 │
  │  long_poll:          20 seconds (cheaper, faster)          │
  │                                                            │
  │  SQS Queue Policy: only SNS topic above can SendMessage    │
  └───────────────────────────┬────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────────────────┐
          │  processing       │  3 failed attempts             │
          ▼                   ▼                               │
  ┌──────────────────┐  ┌──────────────────────────────────┐  │
  │  Notification    │  │  SQS DLQ:                        │  │
  │  Service :3005   │  │  AgriConnect-Notifications-DLQ   │  │
  │  on Backend EC2  │  │                                  │  │
  │                  │  │  maxReceiveCount: 3               │  │
  │  Polls SQS every │  │  retention: 14 days              │  │
  │  few seconds     │  │                                  │  │
  │  (long polling)  │  │  Use for: debug failed messages  │  │
  └────────┬─────────┘  └──────────────────────────────────┘
           │
     ┌─────┴──────────────────────────────────────────┐
     │                                                 │
     ▼                                                 ▼
  ┌──────────────────────────────────┐   ┌─────────────────────────────────┐
  │  RDS MySQL                       │   │  Gmail SMTP                     │
  │  INSERT INTO notifications       │   │  (credentials from Secrets Mgr) │
  │  { user_id, type, message,       │   │                                 │
  │    is_read: false, created_at }  │   │  Sends email to user's address  │
  │                                  │   │  e.g. "Your bid was accepted"   │
  │  User reads via                  │   └─────────────────────────────────┘
  │  GET /api/notifications          │
  │  Bell icon count updated         │
  └──────────────────────────────────┘
```

---

## Weather Alert Flow (Serverless)

```
════════════════════════════════════════════════════════════════════════════════════
  WEATHER ALERT PIPELINE  (fully serverless, runs every 6 hours automatically)
════════════════════════════════════════════════════════════════════════════════════


  ┌────────────────────────────────────────────────────────────────────────────┐
  │  EventBridge Scheduler                                                     │
  │  Name:      agriconnect-weather-check                                      │
  │  Schedule:  rate(6 hours)   Timezone: Asia/Kolkata                         │
  │  State:     ENABLED                                                        │
  │  Role:      scheduler-role  (IAM — allows invoking Lambda only)            │
  └──────────────────────────────────┬─────────────────────────────────────────┘
                                     │  invokes Lambda every 6 hours
                                     │
                                     ▼
  ┌────────────────────────────────────────────────────────────────────────────┐
  │  Lambda Function:  weather-alert-processor                                 │
  │  Runtime:  Node.js 18.x      Timeout: 60 seconds                          │
  │  Role:     lambda-role  (IAM — allows SNS publish, VPC access, logs)       │
  │                                                                            │
  │  Environment Variables:                                                    │
  │    SNS_TOPIC_ARN    = arn:aws:sns:...:AgriConnect-WeatherAlerts            │
  │    EVENTS_TOPIC_ARN = arn:aws:sns:...:AgriConnect-Events                  │
  │                                                                            │
  │  Code lives at: lambda/weather-alert-processor/index.js                   │
  │  Packaged as ZIP, deployed via Terraform (source_code_hash tracks changes) │
  │                                                                            │
  │  What the code does:                                                       │
  │    1. Query RDS for all active farmers + their registered locations        │
  │    2. For each unique location → call OpenWeather API                      │
  │    3. Check for: heavy rain, frost, extreme heat, strong winds             │
  │    4. Generate alert message per affected farmer                           │
  │    5. Publish to both SNS topics                                           │
  └────────────────┬───────────────────────────────────────────────────────────┘
                   │  sns.publish()
         ┌─────────┴───────────────────────────────────────┐
         │                                                   │
         ▼                                                   ▼
  ┌──────────────────────────────┐          ┌───────────────────────────────────┐
  │  SNS Topic:                  │          │  SNS Topic:                       │
  │  AgriConnect-WeatherAlerts   │          │  AgriConnect-Events               │
  │                              │          │                                   │
  │  Used for: direct email /    │          │  Used for: general platform       │
  │  SMS subscriptions to        │          │  events (orders, bids, delivery)  │
  │  farmers (can add later)     │          │                                   │
  └──────────────────────────────┘          └────────────────┬──────────────────┘
                                                              │  subscription
                                                              ▼
                                            ┌───────────────────────────────────┐
                                            │  SQS: Notifications-Queue         │
                                            │  (same queue as platform events)  │
                                            └──────────────┬────────────────────┘
                                                           │
                                                           ▼
                                            ┌───────────────────────────────────┐
                                            │  Notification Service  :3005      │
                                            │  Processes message type:          │
                                            │  WEATHER_ALERT                    │
                                            │                                   │
                                            │  → Saves bell notification to RDS │
                                            │  → Sends email to farmer          │
                                            │  → Farmer sees alert on dashboard │
                                            └───────────────────────────────────┘
```

---

## IAM & Security Layer

```
════════════════════════════════════════════════════════════════════════════════════
  IAM ROLES  (least-privilege, no hardcoded keys anywhere)
════════════════════════════════════════════════════════════════════════════════════

  EC2 Instance Profile  (ec2-instance-profile)
  └── ec2-role  →  Allows:
        SecretsManager: GetSecretValue  (read DB, JWT, SMTP, S3 credentials)
        S3: PutObject, GetObject        (produce-images, delivery-proofs buckets)
        SNS: Publish                    (publish events to both topics)
        SQS: SendMessage, ReceiveMessage, DeleteMessage  (notifications queue)

  Lambda Execution Role  (lambda-role)
  └── Allows:
        SNS: Publish                    (publish weather alerts)
        Logs: CreateLogGroup, PutLogEvents  (CloudWatch Logs)
        EC2 VPC networking              (if Lambda is inside VPC)

  EventBridge Scheduler Role  (scheduler-role)
  └── Allows:
        Lambda: InvokeFunction          (invoke weather-alert-processor only)

  Why no hardcoded keys?
    aws_creds secret contains: { access_key: "USE_IAM_ROLE" }
    Backend services detect this and use the EC2 instance profile instead.
    AWS SDK automatically picks up instance credentials — no keys stored anywhere.
```

---

## Request Flow: Step-by-Step Walkthrough

```
════════════════════════════════════════════════════════════════════════════════════
  EXAMPLE: Buyer views crop listings
════════════════════════════════════════════════════════════════════════════════════

  Step 1  Browser sends:
          GET https://d1abc.cloudfront.net/api/marketplace/listings
          Authorization: Bearer <jwt_token>

  Step 2  CloudFront receives the request at nearest edge location (e.g. Mumbai POP)
          Behavior match: /api/* → cache disabled → forward to ALB origin
          Before forwarding: passes request through WAF

  Step 3  WAF evaluates:
          ✓ No SQL injection patterns found
          ✓ No XSS patterns found
          ✓ IP not rate-limited
          → ALLOW: request forwarded to ALB

  Step 4  ALB receives HTTP request on port 80
          Path: /api/marketplace/listings
          Matches rule priority 20: /api/marketplace/*
          → Routes to Target Group: agriconnect-dev-tg-market  (port 3002)
          Health check: backend EC2 port 3002 /health returns 200 ✓

  Step 5  Marketplace Service (port 3002) on Backend EC2 receives request
          Validates JWT token using secret from Secrets Manager
          Queries RDS: SELECT * FROM listings WHERE status='active' LIMIT 20
          Returns JSON response

  Step 6  Response travels back:
          Backend EC2 → ALB → CloudFront → User

  Total round trip: ~50-100ms  (mostly RDS query time)


════════════════════════════════════════════════════════════════════════════════════
  EXAMPLE: Buyer places an order (triggers notification pipeline)
════════════════════════════════════════════════════════════════════════════════════

  Step 1  POST /api/orders  { listing_id, quantity, payment_method }

  Step 2  CloudFront → WAF → ALB (routes /api/orders/* to port 3003)

  Step 3  Order Service:
          INSERT INTO orders { buyer_id, listing_id, quantity, status:'pending' }
          INSERT INTO payments { order_id, amount, status:'pending' }

  Step 4  Order Service publishes to SNS:
          sns.publish({
            TopicArn: EVENTS_TOPIC_ARN,
            Message: JSON.stringify({
              type: 'ORDER_PLACED',
              farmerId: <id>,
              buyerName: <name>,
              crop: <name>,
              quantity: <qty>,
              amount: <price>
            })
          })

  Step 5  SNS delivers message to SQS (Notifications-Queue)

  Step 6  Notification Service (port 3005) is long-polling SQS
          Receives message (visibility timeout: 30s — hidden from others)
          Processes ORDER_PLACED event:
            a) INSERT INTO notifications { user_id: farmerId, message: "New order..." }
            b) Send email to farmer via Gmail SMTP
            c) sqs.deleteMessage() — removes from queue (success)

  Step 7  Farmer opens app → bell icon shows unread count
          GET /api/notifications → returns unread notifications from RDS

  Step 8  Farmer marks as read → PATCH /api/notifications/:id/read
          UPDATE notifications SET is_read=true WHERE id=:id
```

---

## DNS & Network Flow Summary

```
════════════════════════════════════════════════════════════════════════════════════
  NETWORK ROUTING AT A GLANCE
════════════════════════════════════════════════════════════════════════════════════

  INTERNET
      │
      │  DNS: d1abc.cloudfront.net  →  CloudFront edge IP  (AWS Anycast)
      │
  CloudFront  (us-east-1 global)
      │
      │  Origin: ALB DNS name (agriconnect-dev-alb.ap-south-1.elb.amazonaws.com)
      │
  ALB  (public subnets 10.0.1.0/24  +  10.0.2.0/24)
      │
      │  Target group attachments → private subnet instances
      │
  EC2 Backend  (private subnet 10.0.10.0/24)   port 3001–3005
  EC2 Frontend (private subnet 10.0.10.0/24)   port 80
      │
      │  MySQL TCP port 3306
      │
  RDS  (private subnet 10.0.10.0/24)   no public endpoint


  OUTBOUND (EC2 → internet for npm, git, AWS APIs):
  EC2 private subnet  →  NAT Gateway (public subnet 10.0.1.0/24)  →  Internet Gateway  →  internet

  ADMIN SSH ACCESS:
  Developer laptop  →  Bastion (public IP, port 22)  →  SSH tunnel  →  Backend EC2 (private)
  Developer laptop  →  Bastion (public IP, port 22)  →  SSH tunnel  →  RDS port 3306


  SECURITY GROUPS  (all resources share one common SG):
  Inbound:   22 (SSH), 80 (HTTP), 443 (HTTPS), 3001-3005 (services), 3306 (MySQL)
  Outbound:  all traffic allowed (0.0.0.0/0)
```

---

## Architecture Layers Summary

```
╔══════════════════════════════════════════════════════════════════════════╗
║  LAYER               SERVICES                          LOCATION         ║
╠══════════════════════════════════════════════════════════════════════════╣
║  Edge / CDN          CloudFront, WAF                   us-east-1 global ║
║  Load Balancing      ALB                               ap-south-1       ║
║  Compute             EC2 (frontend, backend, bastion)  ap-south-1 VPC   ║
║  Database            RDS MySQL 8                       private subnet   ║
║  Storage             S3 (images, proofs)               ap-south-1       ║
║  Secrets             Secrets Manager                   ap-south-1       ║
║  Messaging           SNS (2 topics), SQS (queue + DLQ) ap-south-1       ║
║  Serverless          Lambda (weather processor)        ap-south-1       ║
║  Scheduling          EventBridge Scheduler             ap-south-1       ║
║  IAC                 Terraform (runs locally)          your machine     ║
║  State Storage       S3 backend                        ap-south-1       ║
╚══════════════════════════════════════════════════════════════════════════╝
```
