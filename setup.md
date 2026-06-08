# AgriConnect – Farm to Market Platform
## Complete AWS Deployment Guide

> **Read this entire guide before starting.** Follow every section in order. Each section depends on resources created in the previous one.

---

## Architecture Overview

```
Internet
   │
   ▼
[ALB – agriconnect-alb]  ← Single public entry point (port 80)
   │
   ├── /api/auth/*          → Backend EC2 :3001 (auth-service)
   ├── /api/marketplace/*   → Backend EC2 :3002 (marketplace-service)
   ├── /api/orders/*        → Backend EC2 :3003 (order-service)
   ├── /api/media/*         → Backend EC2 :3004 (media-service)
   ├── /api/notifications/* → Backend EC2 :3005 (notification-service)
   └── /* (default)         → Frontend EC2 :80  (Nginx / React SPA)

[Frontend EC2 – Public Subnet]
   └── Nginx: serves React static build from /var/www/agriconnect
   └── NO proxy_pass — ALB handles all API routing

[Backend EC2 – Private Subnet]
   └── PM2: 5 microservices on ports 3001–3005
   └── Reads secrets from → AWS Secrets Manager
   └── Reads/writes images → S3

[RDS MySQL – Database Subnet]  (private, no public access)
```

> **Why single ALB?** The React app is served from `http://<ALB-DNS>/`. All API calls like `/api/auth/login` go to the same origin — the ALB routes them to the right backend service. No CORS issues, no nginx proxy, no hardcoded URLs.

---

## SECTION 1: AWS Pre-requisites — VPC & Networking

> You already have a VPC with public, private, and database subnets. Skip steps you have already done.

### 1.1 Confirm Your Subnets

In the **VPC Console → Subnets**, confirm you have:
| Name | Type | Use |
|------|------|-----|
| `agriconnect-public-1` | Public | Frontend EC2 + ALB |
| `agriconnect-public-2` | Public | ALB (needs 2 AZs) |
| `agriconnect-private-1` | Private | Backend EC2 |
| `agriconnect-db-1` | Private (DB) | RDS |
| `agriconnect-db-2` | Private (DB) | RDS (Multi-AZ) |

> If you only have 1 public subnet, create a second one in a different AZ — the ALB **requires** at least 2 AZs.

### 1.2 NAT Gateway (Required for Backend EC2)

The backend EC2 is in a **private subnet** and needs outbound internet to reach Secrets Manager and S3.

1. Go to **VPC → NAT Gateways → Create NAT Gateway**
2. Name: `agriconnect-nat`
3. Subnet: Choose one of your **public** subnets
4. Elastic IP: Click **Allocate Elastic IP**
5. Click **Create NAT Gateway**
6. Wait until Status = **Available** (2–5 minutes)
7. Go to **VPC → Route Tables**
8. Select the route table associated with your **private subnet**
9. Click **Routes → Edit routes → Add route**:
   - Destination: `0.0.0.0/0`
   - Target: Select your NAT Gateway
10. Save

### 1.3 Security Groups

Create the following **4 security groups** (all in `agriconnect-vpc`):

#### SG 1: `agriconnect-alb-sg`
| Direction | Type | Port | Source |
|-----------|------|------|--------|
| Inbound | HTTP | 80 | 0.0.0.0/0 |
| Inbound | HTTPS | 443 | 0.0.0.0/0 |
| Outbound | All | All | 0.0.0.0/0 |

#### SG 2: `agriconnect-frontend-sg`
| Direction | Type | Port | Source |
|-----------|------|------|--------|
| Inbound | HTTP | 80 | `agriconnect-alb-sg` (select by SG id) |
| Inbound | SSH | 22 | Your IP (x.x.x.x/32) |
| Outbound | All | All | 0.0.0.0/0 |

> The frontend EC2 only needs to accept HTTP from the ALB, not from the open internet. Users reach it exclusively through the ALB DNS.

#### SG 3: `agriconnect-backend-sg`
| Direction | Type | Port | Source |
|-----------|------|------|--------|
| Inbound | Custom TCP | 3001–3005 | `agriconnect-alb-sg` (select by SG id) |
| Inbound | SSH | 22 | Your IP (x.x.x.x/32) |
| Outbound | All | All | 0.0.0.0/0 |

#### SG 4: `agriconnect-rds-sg`
| Direction | Type | Port | Source |
|-----------|------|------|--------|
| Inbound | MySQL/Aurora | 3306 | `agriconnect-backend-sg` (select by SG id) |
| Outbound | All | All | 0.0.0.0/0 |

---

## SECTION 2: RDS MySQL Setup

1. Go to **RDS Console → Create database**
2. Settings:
   - **Creation method**: Standard create
   - **Engine**: MySQL 8.0.x
   - **Template**: Free tier (dev) or Production
   - **DB instance identifier**: `agriconnect-mysql`
   - **Master username**: `admin`
   - **Master password**: Create a strong password — **save it now**, you will store it in Secrets Manager
     > Suggested: Use a password manager or run `openssl rand -base64 24` on your local machine
   - **Instance class**: `db.t3.micro` (free tier) or `db.t3.small`
   - **Storage**: 20 GiB, gp3, disable autoscaling for cost control
3. **Connectivity**:
   - VPC: `agriconnect-vpc`
   - Subnet group: Create new DB subnet group using your DB subnets (`agriconnect-db-1`, `agriconnect-db-2`)
   - Public access: **No**
   - Security group: Remove default, add `agriconnect-rds-sg`
   - Availability Zone: No preference
4. **Additional configuration**:
   - Initial database name: `agriconnect` ← **Important — do not skip**
   - Backup retention: 1 day
   - Disable performance insights (saves cost)
5. Click **Create database** and wait ~10 minutes for status: **Available**
6. **Note the endpoint**: Go to the database → Connectivity & security → copy the **Endpoint** (looks like `agriconnect-mysql.xxxxxxxxx.ap-south-1.rds.amazonaws.com`)

---

## SECTION 3: S3 Buckets

### Bucket 1: Produce Images (Public Read)

1. Go to **S3 Console → Create bucket**
2. **Bucket name**: `agriconnect-produce-images-978594443309`
3. **Region**: Same region you're using everywhere (e.g. `ap-south-1`)
4. **Block Public Access**: **Uncheck** "Block all public access"
   - Acknowledge the warning
5. **Versioning**: Enable
6. Create the bucket
7. Go to the bucket → **Permissions → Bucket Policy → Edit** → paste:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::agriconnect-produce-images-978594443309/*"
    }
  ]
}
```
> Replace `978594443309` with your actual 12-digit AWS account ID. Find it in the top-right account menu.

### Bucket 2: Delivery Proofs (Private)

1. **Bucket name**: `agriconnect-delivery-proofs-978594443309`
2. **Block Public Access**: Keep **all blocked** (default)
3. **Versioning**: Enable
4. Create — no bucket policy needed

---

## SECTION 4: AWS Secrets Manager

Go to **Secrets Manager → Store a new secret**.
For each secret: choose **Other type of secret**, then click **Plaintext** tab and paste the JSON below.

> **Important naming**: Use the exact secret names shown — the application code reads these exact paths.

---

### Secret 1: `agriconnect/dev/database`

```json
{
  "host": "agriconnect-mysql.XXXXXXXXXX.ap-south-1.rds.amazonaws.com",
  "port": 3306,
  "username": "admin",
  "password": "YOUR_RDS_PASSWORD_HERE",
  "database": "agriconnect"
}
```
- Replace `host` with the RDS endpoint you copied in Section 2
- Replace `password` with the RDS master password you created

---

### Secret 2: `agriconnect/dev/jwt`

```json
{
  "jwt_secret": "PASTE_A_LONG_RANDOM_STRING_HERE",
  "jwt_expiry": "24h"
}
```
> **Generate a secure jwt_secret** — run this on your local machine:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```
> Copy the output (128 hex characters) as the `jwt_secret` value.

---

### Secret 3: `agriconnect/dev/aws`

```json
{
  "region": "ap-south-1",
  "access_key": "USE_IAM_ROLE",
  "secret_key": "USE_IAM_ROLE"
}
```
> Setting `access_key` to `"USE_IAM_ROLE"` tells the media service to use the EC2 instance profile instead of hardcoded credentials. Replace `region` with your actual region.

---

### Secret 4: `agriconnect/dev/email`

```json
{
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_user": "your-email@gmail.com",
  "smtp_password": "your-app-password"
}
```
> Email notifications are simulated (console.log) for now. You can fill in real values later when integrating SNS or SMTP.

---

### Secret 5: `agriconnect/dev/s3`

```json
{
  "produce_bucket": "agriconnect-produce-images-978594443309",
  "delivery_bucket": "agriconnect-delivery-proofs-978594443309"
}
```
> Replace `978594443309` with your 12-digit AWS account ID (same as bucket names).

---

## SECTION 5: IAM Role for Backend EC2

The backend EC2 needs permission to read Secrets Manager and access S3.

### 5.1 Create IAM Policy

1. Go to **IAM → Policies → Create policy**
2. Click **JSON** tab and paste:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SecretsManagerAccess",
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:*:*:secret:agriconnect/dev/*"
    },
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::agriconnect-produce-images-978594443309/*",
        "arn:aws:s3:::agriconnect-delivery-proofs-978594443309/*"
      ]
    }
  ]
}
```
3. Name: `AgriConnectBackendPolicy`
4. Create policy

### 5.2 Create IAM Role

1. Go to **IAM → Roles → Create role**
2. **Trusted entity**: AWS service → EC2
3. Attach the policy: `AgriConnectBackendPolicy`
4. Role name: `AgriConnectEC2Role`
5. Create role

---

## SECTION 6: EC2 Instances

### 6.1 Backend EC2 (Private Subnet)

1. Go to **EC2 Console → Launch Instance**
2. Name: `agriconnect-backend`
3. AMI: **Ubuntu Server 22.04 LTS** (64-bit x86)
4. Instance type: `t3.medium` (recommended) or `t3.small`
5. Key pair: Create or use existing — **save the .pem file**
6. **Network settings**:
   - VPC: `agriconnect-vpc`
   - Subnet: `agriconnect-private-1` (private subnet)
   - Auto-assign public IP: **Disable**
   - Security group: `agriconnect-backend-sg`
7. **Advanced details**:
   - IAM instance profile: `AgriConnectEC2Role`
8. Storage: 20 GiB gp3
9. Launch

### 6.2 Frontend EC2 (Public Subnet)

1. Go to **EC2 Console → Launch Instance**
2. Name: `agriconnect-frontend`
3. AMI: **Ubuntu Server 22.04 LTS** (64-bit x86)
4. Instance type: `t3.small`
5. Key pair: Same or different — **save the .pem file**
6. **Network settings**:
   - VPC: `agriconnect-vpc`
   - Subnet: `agriconnect-public-1` (public subnet)
   - Auto-assign public IP: **Enable**
   - Security group: `agriconnect-frontend-sg`
7. Storage: 15 GiB gp3
8. Launch

### 6.3 SSH Access to Private Backend EC2

Since the backend is in a private subnet, you need to either:

**Option A – SSH via Frontend as bastion (simple):**
```bash
# From your local machine, copy your key to the frontend
scp -i frontend.pem frontend.pem ubuntu@<FRONTEND_PUBLIC_IP>:~/.ssh/

# SSH into frontend
ssh -i frontend.pem ubuntu@<FRONTEND_PUBLIC_IP>

# From frontend, SSH into backend
chmod 400 ~/.ssh/frontend.pem
ssh -i ~/.ssh/frontend.pem ubuntu@<BACKEND_PRIVATE_IP>
```

**Option B – SSH ProxyJump (cleaner):**
Add to `~/.ssh/config` on your local machine:
```
Host agriconnect-frontend
    HostName <FRONTEND_PUBLIC_IP>
    User ubuntu
    IdentityFile ~/path/to/frontend.pem

Host agriconnect-backend
    HostName <BACKEND_PRIVATE_IP>
    User ubuntu
    IdentityFile ~/path/to/backend.pem
    ProxyJump agriconnect-frontend
```
Then: `ssh agriconnect-backend`

---

## SECTION 7: Push Code to GitHub & Clone

### 7.1 Push to GitHub

On your **local machine** (where you have the AgriConnect project):
```bash
cd /path/to/AgriConnect
git init
git add .
git commit -m "Initial AgriConnect deployment"
git remote add origin https://github.com/<your-username>/agriconnect.git
git push -u origin main
```

> Create the GitHub repository at github.com first (public or private — if private, you'll need a Personal Access Token to clone on EC2).

### 7.2 Clone on Backend EC2

SSH into the **backend EC2** and run:
```bash
sudo apt-get update -y
git clone https://github.com/<your-username>/agriconnect.git /home/ubuntu/AgriConnect
# If private repo:
# git clone https://<token>@github.com/<your-username>/agriconnect.git /home/ubuntu/AgriConnect
```

### 7.3 Clone on Frontend EC2

SSH into the **frontend EC2** and run:
```bash
sudo apt-get update -y
git clone https://github.com/<your-username>/agriconnect.git /home/ubuntu/AgriConnect
```

---

## SECTION 8: Backend Deployment

SSH into the **backend EC2** and run:

```bash
cd /home/ubuntu/AgriConnect
bash scripts/backend-install.sh
```

The script will prompt:
```
Enter your AWS Region (e.g. ap-south-1): ap-south-1
```

**What the script does:**
1. Installs Node.js 20.x
2. Installs PM2 (process manager)
3. Installs npm dependencies for all 5 services
4. Runs database migration (creates all tables in RDS)
5. Seeds the database (1 admin + 20 farmers + 20 buyers + 50 listings)
6. Starts all 5 services via PM2
7. Configures PM2 to auto-restart on reboot

### Verify Backend

```bash
# Check all 5 services are running
pm2 status

# Expected output: all 5 services status = online
# agriconnect-auth      online
# agriconnect-market    online
# agriconnect-order     online
# agriconnect-media     online
# agriconnect-notif     online

# Test health endpoints
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health

# Expected: {"status":"ok","service":"auth-service","timestamp":"..."}

# View logs
pm2 logs agriconnect-auth --lines 20
```

**Common Issues:**

| Problem | Cause | Fix |
|---------|-------|-----|
| Service shows `errored` | Secrets not found | Check secret names in Section 4 exactly match `agriconnect/dev/...` |
| DB connection fails | Wrong host/password | Re-check `agriconnect/dev/database` secret |
| `AccessDeniedException` | Missing IAM role | Attach `AgriConnectEC2Role` to the EC2 instance |

---

## SECTION 9: ALB Configuration

The ALB is the **single public entry point** for the entire application — both the React frontend and all backend API services.

### 9.1 Create Target Groups

Go to **EC2 Console → Target Groups → Create target group** and create all **6** groups below.

#### Backend target groups (register Backend EC2, override port)

| Target Group Name | Port | Target | Health Check Path |
|-------------------|------|--------|-------------------|
| `agriconnect-auth-tg` | 3001 | Backend EC2 | `/health` |
| `agriconnect-market-tg` | 3002 | Backend EC2 | `/health` |
| `agriconnect-order-tg` | 3003 | Backend EC2 | `/health` |
| `agriconnect-media-tg` | 3004 | Backend EC2 | `/health` |
| `agriconnect-notif-tg` | 3005 | Backend EC2 | `/health` |

#### Frontend target group (register Frontend EC2, port 80)

| Target Group Name | Port | Target | Health Check Path |
|-------------------|------|--------|-------------------|
| `agriconnect-frontend-tg` | 80 | Frontend EC2 | `/` |

**Settings for every target group:**
- Target type: **Instances**
- Protocol: HTTP
- VPC: `agriconnect-vpc`
- Healthy threshold: 2
- Unhealthy threshold: 3
- Timeout: 5 s
- Interval: 30 s

**Register targets:**
- Backend TGs: select **Backend EC2** → override port to the number shown above
- Frontend TG: select **Frontend EC2** → port 80 (no override needed)

> The backend `/health` endpoints are at the root (e.g. `http://backend-ip:3001/health`), not under `/api/`. The frontend `/` health check just verifies Nginx is returning 200.

### 9.2 Create the ALB

1. Go to **EC2 Console → Load Balancers → Create Load Balancer → Application Load Balancer**
2. Name: `agriconnect-alb`
3. Scheme: **Internet-facing**
4. IP address type: IPv4
5. VPC: `agriconnect-vpc`
6. Mappings: Select **both public subnets** (the ALB requires at least 2 AZs)
7. Security groups: `agriconnect-alb-sg`
8. Listeners: HTTP:80 → Default action: Forward to `agriconnect-frontend-tg`
9. Click **Create load balancer**
10. **Copy the ALB DNS name** — e.g. `agriconnect-alb-851613288.ap-south-1.elb.amazonaws.com`
    > This DNS is your application's public URL. **Bookmark it — you will use it for everything.**

### 9.3 Listener Rules

1. Go to the ALB → **Listeners → HTTP:80 → Manage rules**
2. Add the following rules **in this exact priority order**:

| Priority | Condition (Path pattern) | Forward to |
|----------|--------------------------|------------|
| 1 | `/api/auth/*` | `agriconnect-auth-tg` |
| 2 | `/api/marketplace/*` | `agriconnect-market-tg` |
| 3 | `/api/orders/*` | `agriconnect-order-tg` |
| 4 | `/api/media/*` | `agriconnect-media-tg` |
| 5 | `/api/notifications/*` | `agriconnect-notif-tg` |
| Default | *(all other paths)* | `agriconnect-frontend-tg` |

> **Why this order?** The ALB evaluates rules top-to-bottom. `/api/*` paths go to backend services; everything else (including `/`, `/login`, `/farmer`, etc.) falls through to the frontend Nginx which serves `index.html` for React client-side routing.

### 9.4 Verify ALB Routing

From your local machine, replace `<ALB-DNS>` with your real ALB DNS:

```bash
ALB="http://agriconnect-alb-851613288.ap-south-1.elb.amazonaws.com"

# Frontend — should return HTML (React app)
curl -I $ALB/

# Backend services — should return JSON health responses
curl $ALB/api/auth/login             # 400 (missing body) = service is up
curl $ALB/api/marketplace/listings   # 200 with JSON listings array

# Direct health checks (ALB uses these, not /api/*/health)
# You cannot test these through the ALB path rules.
# Test them directly on the backend EC2 via SSH:
#   curl http://localhost:3001/health  → {"status":"ok","service":"auth-service"}
```

---

## SECTION 10: Frontend Deployment

> **Complete Section 9 (ALB) before this step.** The frontend must be deployed first so the ALB frontend target group health check passes.

SSH into the **frontend EC2** and run:

```bash
cd /home/ubuntu/AgriConnect
bash scripts/frontend-install.sh
```

**No prompts required.** The script detects its own location automatically.

**What the script does:**
1. Installs Node.js 20.x and Nginx (skips if already installed)
2. Builds the React app (`npm run build`) — no `BACKEND_URL` needed because the React app uses relative API paths (`/api/auth/...`) and the ALB handles routing
3. Deploys built files to `/var/www/agriconnect` (not the home directory — avoids permission errors)
4. Sets correct ownership: `chown -R www-data:www-data /var/www/agriconnect`
5. Writes a clean Nginx config — serves static files only, **no proxy_pass** (the ALB routes `/api/*`)
6. Validates nginx config (`nginx -t`) before restarting

### Verify Frontend

```bash
# Nginx is running
sudo systemctl status nginx

# Nginx serves the React app on port 80
curl -I http://localhost/
# Expected: HTTP/1.1 200 OK

# Files are deployed with correct ownership
ls -la /var/www/agriconnect/
# Expected: files owned by www-data
```

### Access the Application

```
http://agriconnect-alb-851613288.ap-south-1.elb.amazonaws.com/
```

> ⚠️ **Use the ALB DNS, NOT the frontend EC2's public IP.**
> 
> - Via **ALB DNS** → React loads → API calls go to same domain → ALB routes `/api/*` to backend → ✅ works
> - Via **EC2 IP** → React loads → API calls go to EC2 IP → Nginx has no `/api/` route → ❌ 404 on all API calls

---

## SECTION 11: Test the Full Application

### 11.1 Default Credentials (Seeded)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@agriconnect.com | password123 |
| Farmer | farmer1@example.com | password123 |
| Buyer | buyer1@example.com | password123 |

> ⚠️ Change these passwords before going live.

### 11.2 End-to-End Test Flow

1. **Login as Buyer** (`buyer1@example.com` / `password123`)
   - Browse the Marketplace tab — you should see 50 produce listings
   - Search for "Rice" — filter should work
   - Click "Buy Now" on a listing → enter quantity → Confirm Order
   - Switch to "My Orders" tab — order should appear with status PENDING

2. **Login as Farmer** (`farmer1@example.com` / `password123`)
   - Go to "Orders & Sales" tab — the buyer's order should appear
   - Click "Ship" → status changes to IN_TRANSIT
   - Click "Delivered" → status changes to DELIVERED

3. **Create a Listing as Farmer**
   - Click "New Listing"
   - Fill all fields — optionally upload an image
   - Save — listing appears in "My Listings" tab

4. **Place a Bid as Buyer**
   - Go to Marketplace
   - Click "Bid" on any listing
   - Enter bid amount → Submit Bid
   - Go to "My Bids" tab — bid should appear with status PENDING

5. **Login as Admin** (`admin@agriconnect.com` / `password123`)
   - See stats cards: Users, Farmers, Buyers, Revenue
   - Charts: Monthly orders/revenue bar chart
   - Users tab: All users with role badges
   - Orders tab: All orders across the platform

### 11.3 Test S3 Image Upload

1. Login as a Farmer
2. Create a new listing and click "Upload Produce Image"
3. Select any image file
4. Save the listing
5. In AWS S3 console → `agriconnect-produce-images-<account-id>` → you should see the uploaded file
6. The listing's image should display in the marketplace

---

## SECTION 12: Verification Checklist

Use this checklist to confirm everything is working:

```
Infrastructure:
[ ] RDS endpoint is accessible from backend EC2 (test: nc -zv <rds-endpoint> 3306)
[ ] All 5 PM2 services show status: online
[ ] All 5 /health endpoints return {"status":"ok"} (curl localhost:3001/health on backend EC2)
[ ] All 6 ALB target groups show Healthy targets (check EC2 → Target Groups)
[ ] Frontend loads at http://agriconnect-alb-851613288.ap-south-1.elb.amazonaws.com/
[ ] /var/www/agriconnect/ exists and is owned by www-data on frontend EC2

Authentication:
[ ] Login as Farmer works
[ ] Login as Buyer works
[ ] Login as Admin works
[ ] JWT token is stored in localStorage
[ ] Logout clears token and redirects to /login

Farmer Flow:
[ ] Can view My Listings (empty or seeded)
[ ] Can create a new listing
[ ] Can edit a listing
[ ] Can delete a listing
[ ] Can view Orders & Sales
[ ] Can update order status (Pending → In Transit → Delivered)

Buyer Flow:
[ ] Marketplace loads with 50 seeded listings
[ ] Search by product name works
[ ] Category filter works
[ ] Can place a Buy Now order (quantity dialog)
[ ] Order appears in My Orders tab
[ ] Can place a bid (Bid dialog)
[ ] Bid appears in My Bids tab

Admin Flow:
[ ] Stats cards show real counts
[ ] Monthly chart renders
[ ] Users table shows all users
[ ] Orders table shows all orders

S3:
[ ] Produce image upload works (creates new listing with image)
[ ] Uploaded image URL is accessible (not blocked)
[ ] Delivery proof upload works

Secrets Manager:
[ ] Backend started without "Failed to retrieve secret" errors
[ ] pm2 logs show "Database connection has been established"
```

---

## SECTION 13: Future Integrations (Phase 2)

When ready to extend the platform, these services slot in cleanly:

| Service | Purpose | Where to wire |
|---------|---------|--------------|
| Amazon SNS | Real push notifications | `notification-service` — replace console.log |
| Amazon SQS | Async order processing | Between `order-service` and `notification-service` |
| CloudWatch | Centralized logs & alarms | Add `winston` + CloudWatch transport to each service |
| WAF | DDoS protection + rate limiting | Attach to the ALB |
| CloudFront | CDN for frontend + S3 images | Point to frontend EC2 and S3 bucket |
| Route 53 | Custom domain | Point to CloudFront or ALB |
| SES | Transactional email | Replace SMTP config in `agriconnect/dev/email` |
| Weather API | Harvest alerts on Farmer dashboard | New widget in `FarmerDashboard.jsx` |

---

## SECTION 14: Updating the Application

### Update Backend
```bash
# SSH into backend EC2
cd /home/ubuntu/AgriConnect
AWS_REGION=ap-south-1 bash scripts/backend-update.sh
```

### Update Frontend
```bash
# SSH into frontend EC2
cd /home/ubuntu/AgriConnect
bash scripts/frontend-update.sh
```

---

## SECTION 15: Troubleshooting Reference

### Backend Logs
```bash
pm2 logs                          # All services
pm2 logs agriconnect-auth         # Auth service only
pm2 logs agriconnect-market       # Marketplace service only
pm2 flush                         # Clear all logs
```

### Restart Services
```bash
pm2 restart all                   # Restart all
pm2 restart agriconnect-auth      # Restart one service
pm2 reload all                    # Zero-downtime reload
```

### Check Database Connectivity
```bash
# Install mysql client on backend EC2
sudo apt-get install -y mysql-client

# Test connection (get host from Secrets Manager or AWS console)
mysql -h <RDS_ENDPOINT> -u admin -p agriconnect
# Enter your RDS password
# You should see: mysql> prompt
# Type: SHOW TABLES; to verify tables exist
```

### Check Secrets Manager Access
```bash
# On the backend EC2, test that the IAM role can read secrets
aws secretsmanager get-secret-value \
  --secret-id agriconnect/dev/database \
  --region ap-south-1 \
  --query SecretString \
  --output text
# Should print the JSON with your database credentials
```

### Nginx Logs
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### ALB Health Checks Failing
```bash
# On backend EC2, verify health endpoint is responding
curl http://localhost:3001/health
# Expected: {"status":"ok","service":"auth-service","timestamp":"..."}

# Check the security group: backend-sg must allow ports 3001-3005 from alb-sg
```

---

## SECTION 16: Phase 1 Features & What Changed

This section documents all Phase 1 improvements applied after the initial deployment.

### 16.1 New Features Added

| Feature | Location | Notes |
|---------|----------|-------|
| Full-screen Login/Register UI | `frontend/src/pages/Auth/` | Split-screen hero layout with farm imagery |
| Weather Widget (Open-Meteo) | `frontend/src/components/WeatherWidget.jsx` | Free API, no key required, 20 Indian cities |
| Farmer Earnings Chart | `Farmer/Dashboard.jsx` | Area chart from sales history |
| Received Bids tab (Farmer) | `Farmer/Dashboard.jsx` | Farmer can accept/reject bids inline |
| Buyer Stats Cards | `Buyer/Dashboard.jsx` | Total spent, active orders, bids |
| Bid Notifications | `marketplace-service` | DB notification + email when bid placed |
| Order Notifications | `order-service` | DB notification + email when order placed |
| Bid Accept/Reject Notifications | `marketplace-service` | Buyer notified when farmer acts on bid |
| Order Status Notifications | `order-service` | Buyer notified when order shipped/delivered |
| Email templates | `shared/utils/email.js` | Beautiful HTML email templates |
| `GET /api/marketplace/farmer-bids` | marketplace-service | New route: bids received by farmer |
| `PUT /api/notifications/read-all` | notification-service | Mark all notifications read at once |
| `GET /api/notifications/unread-count` | notification-service | Fast unread count endpoint |
| Expanded seed data | `shared/scripts/seed.js` | 20 farmers, 100 listings, 50 orders, 100 bids |

### 16.2 Critical Bug Fixed

**The `\${token}` template literal bug in `frontend/src/App.jsx`.**

The original file had:
```js
axios.get('/api/auth/me', { headers: { Authorization: `Bearer \${token}` } })
```

The `\$` escaped the dollar sign, so `token` was never substituted. Every page refresh would log the user out. This is now fixed to:
```js
Authorization: `Bearer ${token}`
```

### 16.3 Re-Seeding the Database with New Richer Data

If you already ran the old seed and want fresh realistic data:

```bash
# SSH into backend EC2
cd /home/ubuntu/AgriConnect
git pull origin main

# Re-install shared (adds nodemailer)
cd shared && npm install && cd ..

# Force re-seed: truncates all data and re-seeds with 100 listings, 50 orders, 100 bids
AWS_REGION=ap-south-1 node shared/scripts/seed.js --force
```

> **Warning**: `--force` deletes ALL existing data (users, listings, orders, bids). Only use on a dev/staging database.

**New default accounts (same passwords):**
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@agriconnect.com | password123 |
| Farmer | farmer1@example.com | password123 |
| Buyer | buyer1@example.com | password123 |

### 16.4 Weather Widget

The weather widget in the Farmer Dashboard uses [Open-Meteo](https://open-meteo.com/) — a **free, open-source weather API** that requires no API key and has no rate limits for personal use.

Supported cities: Amritsar, Ludhiana, Delhi, Agra, Lucknow, Jaipur, Bhopal, Nagpur, Pune, Mumbai, Nashik, Hyderabad, Bangalore, Mysore, Chennai, Coimbatore, Patna, Kolkata, Bhubaneswar, Chandigarh.

**Farmer receives:**
- Current temperature
- Weather condition with icon
- Humidity, rain probability, wind speed
- Smart farming alerts (fog → "delay harvest", rain → "cover produce", storm → "protect equipment")

### 16.5 Email Notifications (SMTP Setup)

Notifications are written to the DB immediately. Email delivery requires SMTP configuration in `agriconnect/dev/email`:

```json
{
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_user": "your-actual-email@gmail.com",
  "smtp_password": "your-gmail-app-password"
}
```

> **Gmail App Password**: Go to Google Account → Security → 2-Step Verification → App Passwords → Create one for "AgriConnect". Use that 16-character password — **not** your regular Gmail password.

If SMTP is not configured (placeholder values), the system logs a simulated email to the console and continues without crashing.

**Notifications triggered automatically:**
1. Buyer places bid → Farmer gets DB notification + email
2. Farmer creates order → Farmer gets DB notification + email  
3. Farmer accepts/rejects bid → Buyer gets DB notification
4. Farmer ships order → Buyer gets DB notification
5. Order delivered → Buyer gets DB notification

### 16.5b ALB Path Routing — Critical Caveat

The ALB listener rule `/api/orders/*` matches paths that have **at least one character after the trailing slash**, e.g. `/api/orders/create`, `/api/orders/my-orders`. It does **not** match the bare path `/api/orders` (no sub-path).

If a request hits the bare path, the ALB falls through to the default rule → frontend Nginx. Nginx returns **405 Method Not Allowed** for POST requests because static file serving only allows GET/HEAD.

**This is why the order creation endpoint is `POST /api/orders/create` (not `POST /api/orders`).**

All API routes in this project follow the rule: every endpoint always has a named sub-path so it unambiguously matches its ALB listener rule:

| Service | ALB Rule | Create endpoint |
|---------|----------|-----------------|
| Auth | `/api/auth/*` | `POST /api/auth/register` |
| Marketplace | `/api/marketplace/*` | `POST /api/marketplace/listings` |
| Orders | `/api/orders/*` | `POST /api/orders/create` ← |
| Media | `/api/media/*` | `POST /api/media/upload/produce` |
| Notifications | `/api/notifications/*` | `POST /api/notifications/send` |

### 16.6 Deploying Phase 1 Changes

After pulling the updated code on both EC2s:

**Backend EC2:**
```bash
cd /home/ubuntu/AgriConnect
git pull origin main

# Re-install shared dependencies (nodemailer added)
cd shared && npm install && cd ..

# Restart all services (no migration needed — no schema changes)
pm2 restart all
pm2 status

# Verify all 5 services are online
for port in 3001 3002 3003 3004 3005; do
  echo -n ":$port → "; curl -s http://localhost:$port/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))"
done
```

**Frontend EC2:**
```bash
cd /home/ubuntu/AgriConnect
git pull origin main
bash scripts/frontend-install.sh
```

> The frontend install script rebuilds the React app (picks up all UI changes) and re-deploys to `/var/www/agriconnect`.

---

## SECTION 17: Phase 2 — AWS Integrations, Payment Workflow, Weather Alerts

Phase 2 adds: SNS payment release, Lambda weather alerts, EventBridge schedule, farmer location/weather widget, delivery confirmation, and notification center.

---

### 17.1 New Database Columns (auto-migrated via Sequelize alter)

No manual SQL needed. When you run `node scripts/migrate.js`, Sequelize adds:

| Table | New Column | Type | Purpose |
|-------|-----------|------|---------|
| `farmers` | `city` | VARCHAR | Structured city name |
| `farmers` | `state` | VARCHAR | State name |
| `farmers` | `latitude` | FLOAT | For weather API |
| `farmers` | `longitude` | FLOAT | For weather API |
| `orders` | `buyer_confirmed` | TINYINT(1) | Buyer clicked "Confirm Delivery" |
| `orders` | `payment_released` | TINYINT(1) | Payment escrow released |
| `payments` | (new table) | — | Escrow tracking per order |

**Re-run migration after pulling Phase 2 code:**
```bash
cd /home/ubuntu/AgriConnect/shared
AWS_REGION=ap-south-1 node scripts/migrate.js
```

**Re-seed with Phase 2 data (farmers now have lat/lon):**
```bash
AWS_REGION=ap-south-1 node scripts/seed.js --force
```

---

### 17.2 SNS Topic — `AgriConnect-WeatherAlerts`

This single SNS topic handles both **weather alerts** (Lambda) and **payment release** notifications (order-service).

#### Create the topic

Go to **SNS → Topics → Create topic**:
- Type: **Standard**
- Name: `AgriConnect-WeatherAlerts`
- Click **Create topic**
- Copy the **Topic ARN** — you will use it in the next steps

#### Add email subscriptions (farmer emails)

Go to **SNS → Topics → AgriConnect-WeatherAlerts → Create subscription**:
- Protocol: **Email**
- Endpoint: farmer email address (e.g. `farmer1@example.com`)
- Click **Create subscription**
- Each subscriber must **confirm** via the confirmation email sent to their inbox

For demo, subscribe your own email:
1. Create subscription → Email → your email
2. Check inbox → click "Confirm subscription"
3. You will now receive all weather alerts and payment release notifications

#### Test the topic manually
```bash
aws sns publish \
  --topic-arn arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts \
  --subject "Test Alert" \
  --message "AgriConnect SNS is working correctly." \
  --region ap-south-1
```

---

### 17.3 IAM Updates — New Permissions Required

Add these permissions to the **AgriConnectEC2Policy** (Backend EC2 IAM role) and the **Lambda execution role**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["sns:Publish"],
      "Resource": "arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts"
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:*:*:secret:agriconnect/dev/*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

Go to **IAM → Policies → AgriConnectEC2Policy → Edit** and add the `sns:Publish` statement.

---

### 17.4 Order Service — SNS Payment Release

The order-service now publishes an SNS event when a buyer confirms delivery.

**Set `SNS_TOPIC_ARN` in PM2 startup on the backend EC2:**

```bash
# Stop existing PM2 process
pm2 stop agriconnect-order

# Restart with SNS topic ARN env variable
cd /home/ubuntu/AgriConnect/services/order-service
npm install   # picks up @aws-sdk/client-sns

AWS_REGION=ap-south-1 \
SNS_TOPIC_ARN=arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts \
pm2 start index.js --name agriconnect-order

pm2 save
```

**Or update the PM2 startup script** — edit `/home/ubuntu/AgriConnect/scripts/backend-install.sh` or restart all services with the env var:

```bash
# Quick way — restart order-service with correct env
pm2 delete agriconnect-order
cd /home/ubuntu/AgriConnect/services/order-service
AWS_REGION=ap-south-1 SNS_TOPIC_ARN=arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts \
  pm2 start index.js --name agriconnect-order
pm2 save
```

**Payment flow end-to-end:**
1. Buyer places order → Payment record created (status: `HELD`)
2. Farmer updates order to `IN_TRANSIT` → Buyer notified
3. Farmer updates order to `DELIVERED` → Buyer notified, "Confirm Delivery" button appears
4. Buyer clicks "Confirm Delivery" → Payment released, SNS published, both parties notified

**Test payment release:**
```bash
# On backend EC2 — confirm order ID 1 as buyer (get token first via login)
curl -i -X POST http://localhost:3003/api/orders/1/confirm \
  -H "Authorization: Bearer <BUYER_JWT_TOKEN>" \
  -H "Content-Type: application/json"
# Expected: 200 with { message: "Delivery confirmed and payment released" }
# Check your email for SNS notification
```

---

### 17.5 Lambda — `weather-alert-processor`

#### Deploy the Lambda

**Step 1 — Package the Lambda:**
```bash
# On your local machine (or any machine with Node 18+)
cd AgriConnect/lambda/weather-alert-processor
npm install
zip -r weather-alert-processor.zip . -x "*.git*"
```

On Windows (PowerShell):
```powershell
cd AgriConnect\lambda\weather-alert-processor
npm install
Compress-Archive -Path * -DestinationPath weather-alert-processor.zip -Force
```

**Step 2 — Create the Lambda function:**

Go to **Lambda → Create function**:
- Author from scratch
- Function name: `weather-alert-processor`
- Runtime: **Node.js 20.x**
- Architecture: x86_64
- Execution role: Create new role with basic Lambda permissions (then add SNS permissions — see 17.3)

**Step 3 — Upload the zip:**
- Click **Upload from** → **.zip file**
- Upload `weather-alert-processor.zip`

**Step 4 — Set environment variable:**

Go to **Configuration → Environment variables → Edit**:
| Key | Value |
|-----|-------|
| `SNS_TOPIC_ARN` | `arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts` |

**Step 5 — Attach SNS Publish permission to Lambda IAM role:**

Go to **IAM → Roles** → find the role created for your Lambda (e.g. `weather-alert-processor-role-xxxx`) → **Add permissions → Attach policies** → search for `AmazonSNSFullAccess` (or create inline policy from 17.3).

**Step 6 — Test the Lambda manually:**

Go to **Lambda → Test** → create a test event with empty JSON `{}` → click **Test**.

Expected output:
```json
{
  "statusCode": 200,
  "body": "{\"alertsPublished\": 2, \"alerts\": [...]}"
}
```

Check your email for weather alert notifications.

---

### 17.6 EventBridge — Scheduled Weather Checks

#### Create the schedule

Go to **EventBridge → Rules → Create rule**:
- Name: `agriconnect-weather-check`
- Description: Check weather for farmer locations every 15 minutes
- Rule type: **Schedule**
- Schedule pattern: **Rate expression**
  - Rate: `15 minutes`

**Target:**
- Target type: **AWS service**
- Select a target: **Lambda function**
- Function: `weather-alert-processor`

Click **Create rule**.

#### Verify EventBridge is triggering Lambda

Go to **Lambda → Monitor → Logs** in CloudWatch — you should see invocations every 15 minutes.

```bash
# Check Lambda logs via AWS CLI
aws logs tail /aws/lambda/weather-alert-processor --follow --region ap-south-1
```

---

### 17.7 Weather Widget — Farmer Location Auto-Detection

The `WeatherWidget` component now auto-uses the farmer's registered location (city + lat/lon stored in the `farmers` table). No city picker is shown on the Farmer Dashboard — the widget shows weather for the farmer's actual location.

**Farmer registration** now has a location dropdown with 20 Indian cities (including Mawsynram, Cherrapunji, Agumbe — highest-rainfall areas for demo).

**Seed data** has 6 farmers in Meghalaya (Mawsynram + Cherrapunji + Shillong), making weather alerts easy to demonstrate — these locations frequently have high rain probability.

---

### 17.8 Notification Center

The navbar bell icon now opens a **notification popover** with:
- List of last 15 notifications (newest first)
- Unread count badge (polls every 30 seconds)
- Green dot for unread notifications
- Click individual notification to mark as read
- "Mark All Read" button (DoneAll icon)

No deployment steps needed — this is frontend-only, deployed with `frontend-install.sh`.

---

### 17.9 Phase 2 Deployment Steps

**Backend EC2:**
```bash
cd /home/ubuntu/AgriConnect
git pull origin main

# Install new deps (SNS SDK in order-service)
cd services/order-service && npm install && cd ../..
cd shared && npm install && cd ..

# Run migration (adds new columns)
AWS_REGION=ap-south-1 node shared/scripts/migrate.js

# Re-seed with Phase 2 data (lat/lon added to all farmers)
# WARNING: this truncates and re-seeds all data
AWS_REGION=ap-south-1 node shared/scripts/seed.js --force

# Restart services with SNS env var for order-service
pm2 delete all 2>/dev/null || true

pm2 start services/auth-service/index.js         --name agriconnect-auth   -- --env AWS_REGION=ap-south-1
pm2 start services/marketplace-service/index.js  --name agriconnect-market -- --env AWS_REGION=ap-south-1
pm2 start services/media-service/index.js        --name agriconnect-media  -- --env AWS_REGION=ap-south-1
pm2 start services/notification-service/index.js --name agriconnect-notif  -- --env AWS_REGION=ap-south-1

# Order service needs SNS_TOPIC_ARN
SNS_TOPIC_ARN=arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts \
  AWS_REGION=ap-south-1 \
  pm2 start services/order-service/index.js --name agriconnect-order

pm2 save

# Verify all services
pm2 status
for port in 3001 3002 3003 3004 3005; do
  echo -n ":$port → "
  curl -s http://localhost:$port/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "ERR"
done
```

**Frontend EC2:**
```bash
cd /home/ubuntu/AgriConnect
git pull origin main
bash scripts/frontend-install.sh
```

---

### 17.10 Phase 2 Verification Checklist

```
Database:
[ ] farmers table has columns: city, state, latitude, longitude
[ ] orders table has columns: buyer_confirmed, payment_released
[ ] payments table exists

Orders & Payment:
[ ] POST /api/orders/create → 401 (not 405) when tested without token
[ ] POST /api/orders/1/confirm → 401 without token
[ ] Buyer can click "Confirm Delivery" → button changes to "Payment Released"
[ ] SNS email received after delivery confirmation

Notifications:
[ ] Bell icon opens popover with notification list
[ ] Unread badge updates within 30 seconds of new notification
[ ] "Mark All Read" clears the badge

Weather Widget:
[ ] Farmer Dashboard shows weather for farmer's registered city (not city picker)
[ ] No location dropdown visible on Farmer Dashboard (location is pinned)

Lambda & EventBridge:
[ ] Lambda test in console publishes SNS notification → email received
[ ] EventBridge rule shows "Enabled" status
[ ] CloudWatch logs show Lambda invocations every 15 min

SNS:
[ ] aws sns list-subscriptions returns your email subscription (Status: Confirmed)
[ ] Manual publish to topic → email received within 60 seconds
```

---

### 17.11 Secrets Manager — No New Secrets Required

Phase 2 does not add new secrets. The SNS topic ARN is passed as an **environment variable** in PM2 and Lambda — not stored in Secrets Manager (it is not sensitive).

Existing secrets remain unchanged:
- `agriconnect/dev/database` — DB credentials
- `agriconnect/dev/jwt` — JWT signing key
- `agriconnect/dev/email` — SMTP (if configured)
- `agriconnect/dev/s3` — bucket names
- `agriconnect/dev/aws` — S3 credentials / IAM role flag
