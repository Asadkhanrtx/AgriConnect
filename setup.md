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

Phase 2 adds: SNS payment release notifications, Lambda weather-alert processor, EventBridge schedule, farmer lat/lon for weather widget, delivery confirmation with escrow payment, and a production-ready notification popover.

> **Read all of Section 17 before starting.** The steps must be done in order: SNS topic → IAM → backend deploy → Lambda → EventBridge.

---

### 17.0 What Phase 2 Adds

| Feature | Status |
|---------|--------|
| Farmer registration with location dropdown (20 Indian cities with lat/lon) | Code deployed |
| Weather widget uses farmer's pinned location (no manual city selection) | Code deployed |
| Notification bell popover (unread dots, mark read, 30s polling) | Code deployed |
| Payment escrow model (`HELD` → `RELEASED`) | Code deployed |
| Delivery confirmation: buyer clicks "Confirm Delivery" → releases escrow | Code deployed |
| SNS publish on payment release | Requires SNS_TOPIC_ARN env var |
| Lambda `weather-alert-processor` (Open-Meteo → SNS) | Requires manual Lambda deploy |
| EventBridge schedule (every 15 min) | Requires manual rule creation |
| Email notifications via SMTP | Requires SMTP secret to be real |

---

### 17.1 New Database Columns

No manual SQL needed. Sequelize auto-adds columns with `alter: true` on the next migration run.

**Run migration after pulling Phase 2 code:**
```bash
# SSH into backend EC2
cd /home/ubuntu/AgriConnect/shared
AWS_REGION=ap-south-1 node scripts/migrate.js
```

Expected output includes lines like:
```
Executing (default): ALTER TABLE `farmers` ADD `city` VARCHAR(255) NULL
Executing (default): ALTER TABLE `farmers` ADD `latitude` FLOAT NULL
Executing (default): CREATE TABLE IF NOT EXISTS `payments` (...)
```

**Verify columns were added:**
```bash
# Still on backend EC2 (install mysql client first if needed: sudo apt-get install -y mysql-client)
# Get credentials from secrets:
aws secretsmanager get-secret-value --secret-id agriconnect/dev/database --region ap-south-1 --query SecretString --output text

# Connect to RDS and verify
mysql -h <RDS_ENDPOINT> -u admin -p agriconnect

# Inside mysql prompt:
SHOW COLUMNS FROM farmers;
# Expected: id, user_id, farm_name, location, city, state, latitude, longitude, bank_secret_reference

SHOW COLUMNS FROM orders;
# Expected: id, ..., delivery_status, buyer_confirmed, payment_released

SHOW TABLES LIKE 'payments';
# Expected: payments

EXIT;
```

**Re-seed with Phase 2 data (farmers now have lat/lon, payment records created):**
```bash
cd /home/ubuntu/AgriConnect/shared
AWS_REGION=ap-south-1 node scripts/seed.js --force
```

> **Warning**: `--force` truncates ALL tables and re-seeds from scratch. Only use on dev/staging.

**Verify seed data:**
```bash
# Check a farmer has lat/lon
mysql -h <RDS_ENDPOINT> -u admin -p agriconnect -e "SELECT farm_name, city, state, latitude, longitude FROM farmers LIMIT 3;"
```

---

### 17.2 SNS Topic — `AgriConnect-WeatherAlerts`

This single SNS topic handles both **weather alerts** (from Lambda) and **payment release** notifications (from order-service). Email subscribers receive both types of messages.

#### Step 1 — Create the SNS topic

1. Go to **AWS Console → SNS → Topics → Create topic**
2. Fill in:
   - **Type**: Standard
   - **Name**: `AgriConnect-WeatherAlerts`
   - Leave everything else as default
3. Click **Create topic**
4. You are taken to the topic detail page
5. **Copy the Topic ARN** at the top — it looks like:
   ```
   arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts
   ```
   Save this ARN — you will use it in sections 17.3, 17.4, 17.6, and when running `backend-install.sh`.

#### Step 2 — Add email subscriptions

Each person who should receive weather alerts and payment notifications must subscribe:

1. On the topic detail page, click **Create subscription**
2. Fill in:
   - **Protocol**: Email
   - **Endpoint**: the email address to notify (e.g. `your-email@gmail.com`)
3. Click **Create subscription**
4. Status shows **PendingConfirmation**
5. **Check the inbox** for the subscriber email — AWS sends a confirmation email
6. Click the **"Confirm subscription"** link in that email
7. Status changes to **Confirmed** ✓

Repeat for each email you want to receive alerts. For demo, subscribe your own email.

**Verify subscription status:**
```bash
aws sns list-subscriptions-by-topic \
  --topic-arn arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts \
  --region ap-south-1
# Look for: "SubscriptionArn": "arn:aws:sns:..." (not "PendingConfirmation")
```

#### Step 3 — Test the topic manually

```bash
aws sns publish \
  --topic-arn "arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts" \
  --subject "AgriConnect Test" \
  --message "SNS topic is working. You will receive weather alerts and payment notifications here." \
  --region ap-south-1
```

Expected output:
```json
{ "MessageId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
```

Check your inbox — email should arrive within 60 seconds.

> **Not arriving?** Check spam folder. Check subscription status is Confirmed (not PendingConfirmation).

---

### 17.3 IAM Permissions for Phase 2

Two IAM updates are needed:
1. Add `sns:Publish` to the **backend EC2 role** (`AgriConnectEC2Role`) — so order-service can publish payment releases
2. Create a **Lambda execution role** — so the Lambda can publish weather alerts and write CloudWatch logs

#### 17.3.1 Update the Backend EC2 IAM Policy

1. Go to **IAM → Policies → AgriConnectBackendPolicy** (created in Section 5)
2. Click **Edit**
3. Click **JSON** tab
4. Add this new statement inside the `"Statement": [...]` array (after the existing statements, before the closing `]`):
   ```json
   ,{
     "Sid": "SNSPublish",
     "Effect": "Allow",
     "Action": ["sns:Publish"],
     "Resource": "arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts"
   }
   ```
5. Replace `978594443309` with your actual AWS account ID
6. Click **Next** → **Save changes**

**Verify the EC2 has the updated role:**
```bash
# On the backend EC2
aws sts get-caller-identity --region ap-south-1
# Should show: "Arn": "arn:aws:sts::978594443309:assumed-role/AgriConnectEC2Role/..."

# Test SNS publish from the EC2
aws sns publish \
  --topic-arn "arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts" \
  --message "Test from EC2" \
  --region ap-south-1
# Should succeed with a MessageId
```

#### 17.3.2 Create the Lambda IAM Role

1. Go to **IAM → Roles → Create role**
2. **Trusted entity**: AWS service → Lambda
3. Click **Next: Permissions**
4. Search and attach: **AWSLambdaBasicExecutionRole** (gives CloudWatch Logs access)
5. Click **Next** → **Next**
6. Role name: `AgriConnectLambdaRole`
7. Click **Create role**

Now add SNS Publish permission:
8. Click on `AgriConnectLambdaRole` to open it
9. Click **Add permissions → Create inline policy**
10. Click the **JSON** tab and paste:
    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Sid": "SNSPublish",
          "Effect": "Allow",
          "Action": ["sns:Publish"],
          "Resource": "arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts"
        }
      ]
    }
    ```
11. Replace `978594443309` with your actual AWS account ID
12. Click **Next** → Name it `SNSPublishPolicy` → **Create policy**

The role now has: CloudWatch Logs (from `AWSLambdaBasicExecutionRole`) + SNS Publish.

---

### 17.4 Deploy Phase 2 Backend (Order Service + SNS)

The `backend-install.sh` and `backend-update.sh` scripts have been updated to automatically handle `SNS_TOPIC_ARN`. You no longer need to manually restart the order-service.

#### Fresh install (new EC2 / complete reinstall)

```bash
# SSH into backend EC2
cd /home/ubuntu/AgriConnect
git pull origin main
bash scripts/backend-install.sh
```

The script will prompt:
```
Enter your AWS Region (e.g. ap-south-1): ap-south-1
SNS Topic ARN is used for payment release and weather alerts.
Format: arn:aws:sns:<region>:<account-id>:AgriConnect-WeatherAlerts
Enter SNS Topic ARN (or press Enter to skip for now): arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts
```

The SNS ARN is saved to `~/.agriconnect-config` and passed to the order-service PM2 process automatically.

#### Updating existing backend

```bash
cd /home/ubuntu/AgriConnect
git pull origin main
bash scripts/backend-update.sh
```

The update script:
1. Sources `~/.agriconnect-config` for the saved SNS_TOPIC_ARN (no re-prompting)
2. Updates all dependencies
3. Runs migrations
4. Restarts all services
5. Passes updated `SNS_TOPIC_ARN` to order-service via `pm2 restart --update-env`
6. Runs `pm2 save` so config survives EC2 reboots

**Verify SNS env is set in order-service:**
```bash
pm2 env agriconnect-order | grep SNS_TOPIC_ARN
# Expected: SNS_TOPIC_ARN: arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts
```

#### Payment escrow flow end-to-end

1. Buyer places order → `Payment` record created with `status: HELD`
2. Farmer clicks "Ship" → order `IN_TRANSIT`, buyer gets DB notification
3. Farmer clicks "Delivered" → order `DELIVERED`, buyer gets notification + sees "Confirm Delivery" button
4. Buyer clicks "Confirm Delivery" → `payment_released = true`, `Payment.status = RELEASED`, SNS published, both parties get DB notification
5. SNS delivers email to all confirmed subscribers

**Test the payment release endpoint:**
```bash
# First, get a buyer JWT token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer1@example.com","password":"password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

echo "Token: $TOKEN"

# Find an order with DELIVERED status
curl -s http://localhost:3003/api/orders/my-orders \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | grep -A5 "DELIVERED"

# Confirm delivery for order ID 1 (replace 1 with actual delivered order ID)
curl -i -X POST http://localhost:3003/api/orders/1/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
# Expected: HTTP 200, {"message":"Delivery confirmed and payment released","payment":{...}}
```

Check PM2 logs to confirm SNS publish:
```bash
pm2 logs agriconnect-order --lines 20
# Look for: [SNS] Payment release published: <MessageId>
```

---

### 17.5 Email Notifications (SMTP Setup)

Email is sent via nodemailer when events occur (bid placed, order created, delivery confirmed). Emails are fire-and-forget — a failed email never crashes the app.

#### Configure Gmail SMTP in Secrets Manager

1. **Get a Gmail App Password** (required — regular Gmail password doesn't work with SMTP):
   - Go to [Google Account](https://myaccount.google.com/) → **Security**
   - Under "How you sign in to Google", click **2-Step Verification** (must be enabled)
   - Scroll down → **App passwords**
   - App: select "Mail" or type "AgriConnect" → **Generate**
   - Copy the **16-character password** (e.g. `abcd efgh ijkl mnop`) — shown once

2. **Update the secret in AWS Secrets Manager**:
   - Go to **Secrets Manager → agriconnect/dev/email → Retrieve secret value → Edit**
   - Replace placeholder values:
   ```json
   {
     "smtp_host": "smtp.gmail.com",
     "smtp_port": 587,
     "smtp_user": "your-actual-gmail@gmail.com",
     "smtp_password": "abcdefghijklmnop"
   }
   ```
   - Use your real Gmail address for `smtp_user`
   - Use the 16-character App Password (no spaces) for `smtp_password`
   - Click **Save**

3. **Restart services to clear the 5-minute secrets cache:**
   ```bash
   pm2 restart all
   ```

#### Verify emails are sending

Trigger a notification (place a bid as a buyer), then check PM2 logs:
```bash
pm2 logs agriconnect-market --lines 30
```

Look for one of these log lines:
```
[EMAIL SENT] To: farmer1@example.com | Subject: New Bid Received — ...
```
Not:
```
[EMAIL SIMULATED] To: ...   ← means smtp_user is still the placeholder
[EMAIL FAILED] To: ... | Error: ...  ← means credentials are wrong or Gmail blocked it
```

#### Common email issues

| Log message | Cause | Fix |
|------------|-------|-----|
| `[EMAIL SIMULATED]` | `smtp_user` in secret is still `your-email@gmail.com` | Update the secret with real credentials |
| `[EMAIL FAILED] ... Invalid login` | Wrong App Password | Re-generate Gmail App Password and update secret |
| `[EMAIL FAILED] ... ECONNREFUSED` | SMTP host unreachable | Check EC2 outbound rules allow port 587 (usually open by default) |
| `[EMAIL FAILED] ... self signed certificate` | TLS validation | Already fixed — the code now includes `tls: { rejectUnauthorized: false }` |
| Email arrives in spam | Google flagged it | Add sender to contacts / check Gmail spam folder |

---

### 17.6 Lambda — `weather-alert-processor`

The Lambda function polls 10 high-rainfall Indian city locations via Open-Meteo (free, no API key). If rain probability > 70% or storm is detected, it publishes an SNS alert. Triggered by EventBridge every 15 minutes.

#### Step 1 — Package the Lambda on your local machine

**On Mac/Linux:**
```bash
cd AgriConnect/lambda/weather-alert-processor
npm install
zip -r weather-alert-processor.zip .
```

**On Windows (PowerShell):**
```powershell
cd AgriConnect\lambda\weather-alert-processor
npm install
# Must include node_modules in the zip
Compress-Archive -Path ".\*" -DestinationPath ".\weather-alert-processor.zip" -Force
```

Verify the zip contains:
```
index.js
package.json
node_modules/
  @aws-sdk/
    client-sns/
    ...
```

#### Step 2 — Create the Lambda function

1. Go to **AWS Console → Lambda → Create function**
2. Select **Author from scratch**
3. Fill in:
   - **Function name**: `weather-alert-processor`
   - **Runtime**: Node.js 20.x
   - **Architecture**: x86_64
   - **Execution role**: Use an existing role → `AgriConnectLambdaRole` (created in 17.3.2)
4. Click **Create function**

#### Step 3 — Upload the zip

1. On the function page, click **Upload from** → **.zip file**
2. Click **Upload**, select `weather-alert-processor.zip`
3. Click **Save**

Verify the handler is correct:
- Go to **Code → Runtime settings → Edit**
- Handler should be: `index.handler`
- Click **Save**

#### Step 4 — Set environment variables

1. Go to **Configuration → Environment variables → Edit**
2. Click **Add environment variable**:
   | Key | Value |
   |-----|-------|
   | `SNS_TOPIC_ARN` | `arn:aws:sns:ap-south-1:978594443309:AgriConnect-WeatherAlerts` |
3. Replace `978594443309` with your actual AWS account ID
4. Click **Save**

> `AWS_REGION` is injected automatically by the Lambda runtime — do not set it manually.

#### Step 5 — Increase the timeout

The Lambda checks 10 locations, each requiring an HTTP call to Open-Meteo. Increase the timeout to avoid premature termination:

1. Go to **Configuration → General configuration → Edit**
2. Set **Timeout**: 1 min 0 sec
3. Click **Save**

#### Step 6 — Test the Lambda manually

1. Go to the **Test** tab
2. Click **Create new event**
3. Event name: `test-run`
4. Event JSON: `{}`
5. Click **Test**

Expected successful output (response):
```json
{
  "statusCode": 200,
  "body": "{\"alertsPublished\": 3, \"alerts\": [{\"location\": \"Mawsynram\", \"alert\": \"HEAVY_RAIN\", ...}]}"
}
```

If 0 alerts: check the **Log output** tab — you'll see each city's weather code and rain probability. 0 alerts just means no alert conditions are currently active (no storm, rain < 70%) — this is normal.

**Check CloudWatch Logs:**
1. Go to **Monitor → View CloudWatch logs**
2. Click the most recent log stream
3. You should see entries like:
   ```
   [WeatherAlert] Lambda triggered: {}
   [WeatherAlert] Mawsynram: code=61, rain=82%, temp=23.1°C → HEAVY_RAIN
   [WeatherAlert] SNS published for Mawsynram: abc123...
   [WeatherAlert] Done. 1 alert(s) published.
   ```

---

### 17.7 EventBridge — Trigger Lambda Every 15 Minutes

#### Step 1 — Create the EventBridge rule

1. Go to **AWS Console → EventBridge → Rules → Create rule**
2. Fill in:
   - **Name**: `agriconnect-weather-check`
   - **Description**: Trigger weather-alert-processor Lambda every 15 minutes
   - **Event bus**: default
   - **Rule type**: Schedule
3. Click **Next**
4. **Schedule pattern**: A schedule that runs at a regular rate
   - Select **Rate-based schedule**
   - Rate: `15` minutes
5. Click **Next**

#### Step 2 — Add Lambda as the target

1. **Target type**: AWS service
2. **Select a target**: Lambda function
3. **Function**: `weather-alert-processor`
4. Click **Next** → **Next** → **Create rule**

#### Step 3 — Verify the rule is active

1. Go to **EventBridge → Rules** — rule `agriconnect-weather-check` shows **Enabled** status
2. Wait 15–20 minutes after creating the rule
3. Go to **Lambda → weather-alert-processor → Monitor → View CloudWatch logs**
4. You should see a new log stream for each 15-minute invocation

**Check invocation count:**
```bash
# Count how many times the Lambda has been invoked (last 1 hour)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=weather-alert-processor \
  --start-time $(date -u -d '1 hour ago' '+%Y-%m-%dT%H:%M:%SZ') \
  --end-time $(date -u '+%Y-%m-%dT%H:%M:%SZ') \
  --period 3600 \
  --statistics Sum \
  --region ap-south-1
# Expected: Sum >= 4 (4 invocations in 1 hour at 15-min intervals)
```

#### Pause / resume weather alerts

```bash
# Disable (pause billing and invocations)
aws events disable-rule --name agriconnect-weather-check --region ap-south-1

# Re-enable
aws events enable-rule --name agriconnect-weather-check --region ap-south-1
```

---

### 17.8 Notification Center — Production-Ready Bell

The notification popover in the Navbar renders outside the AppBar to avoid React portal issues. The list uses a simple Box layout (no MUI ListItemText nesting) to prevent DOM hierarchy crashes.

**What works out of the box (no deploy step needed):**
- Bell icon shows unread count badge (polls every 30 seconds)
- Clicking bell opens popover anchored to the bell
- Last 15 notifications displayed with timestamps ("2m ago", "1h ago")
- Green dot = unread; grey dot = read
- Click any notification → marks it read, dot disappears
- "Mark All Read" button (checkmark icon) → clears all dots and badge
- Panel auto-refreshes on open (fetches fresh list each time)

**Deploy note:** This is frontend-only. Rebuild and redeploy frontend to pick up the fix:
```bash
# SSH into frontend EC2
cd /home/ubuntu/AgriConnect
git pull origin main
bash scripts/frontend-install.sh
```

---

### 17.9 Weather Widget — Farmer Location Auto-Detection

**How it works:**
1. Farmer registers → selects city from dropdown (20 options including high-rainfall cities)
2. Registration stores `city`, `state`, `latitude`, `longitude` in the `farmers` table
3. On login, auth service returns `profile` (which includes the farmer record)
4. Farmer Dashboard passes `user.profile` to `<WeatherWidget farmerLocation={user.profile} />`
5. Widget detects `farmerLocation.latitude && farmerLocation.longitude` → uses those coordinates
6. Widget shows weather label: "Mawsynram, Meghalaya" instead of a city picker

**If the farmer has no lat/lon set** (registered before Phase 2 or via old API): widget falls back to the manual city picker dropdown.

---

### 17.10 Phase 2 Full Deployment Guide

This section gives you the complete deployment sequence from scratch with Phase 2 code.

#### A. Prerequisites (complete first)
- [ ] Phase 1 infrastructure is running (RDS, ALB, EC2s, secrets, target groups — Sections 1–12)
- [ ] SNS topic `AgriConnect-WeatherAlerts` created and ARN copied (Section 17.2)
- [ ] EC2 IAM policy updated with `sns:Publish` (Section 17.3.1)
- [ ] Lambda IAM role `AgriConnectLambdaRole` created (Section 17.3.2)

#### B. Backend EC2

SSH into the backend EC2 and run:
```bash
cd /home/ubuntu/AgriConnect
git pull origin main
bash scripts/backend-update.sh
```

The script will:
1. Source `~/.agriconnect-config` (if exists) — loads saved AWS_REGION and SNS_TOPIC_ARN
2. Prompt for any missing values
3. Pull new code (already done above)
4. Install new dependencies (including `@aws-sdk/client-sns` in order-service)
5. Run database migration (adds city/state/lat/lon to farmers, buyer_confirmed/payment_released to orders, creates payments table)
6. Restart all 5 services
7. Restart order-service with updated `SNS_TOPIC_ARN` env var
8. Run `pm2 save` to persist env vars across reboots

If this is a completely fresh EC2 (not a Phase 1 → Phase 2 upgrade):
```bash
bash scripts/backend-install.sh
# Then re-seed:
cd /home/ubuntu/AgriConnect/shared
AWS_REGION=ap-south-1 node scripts/seed.js --force
```

**Verify backend is healthy:**
```bash
pm2 status
# All 5 services: status online

# Check SNS env is set
pm2 env agriconnect-order | grep SNS_TOPIC_ARN
# Expected: SNS_TOPIC_ARN: arn:aws:sns:ap-south-1:...

# Check all health endpoints
for port in 3001 3002 3003 3004 3005; do
  echo -n "Port $port: "
  curl -s http://localhost:$port/health | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','ERR'))" 2>/dev/null
done
```

#### C. Frontend EC2

SSH into the frontend EC2 and run:
```bash
cd /home/ubuntu/AgriConnect
git pull origin main
bash scripts/frontend-install.sh
```

This rebuilds the React app and redeploys. The build picks up:
- Fixed notification bell (no blank page crash)
- "Confirm Delivery" button on buyer dashboard
- Weather widget using farmer's pinned location
- Location dropdown on registration form

#### D. Lambda and EventBridge

Follow Sections 17.6 and 17.7 in order:
1. Package and upload the Lambda zip
2. Set `SNS_TOPIC_ARN` env var on the Lambda
3. Set timeout to 60 seconds
4. Test manually (Lambda → Test tab)
5. Create EventBridge rule `agriconnect-weather-check` (15 min rate)
6. Verify Lambda invocations in CloudWatch

#### E. Email (optional but recommended)

Follow Section 17.5 to configure Gmail SMTP in the `agriconnect/dev/email` secret, then `pm2 restart all` on backend.

---

### 17.11 Phase 2 Verification Checklist

```
Database:
[ ] farmers table has: city, state, latitude, longitude columns
    SQL: SHOW COLUMNS FROM farmers;
[ ] orders table has: buyer_confirmed, payment_released columns
    SQL: SHOW COLUMNS FROM orders;
[ ] payments table exists
    SQL: SHOW TABLES LIKE 'payments';
[ ] Seeded farmers have lat/lon set
    SQL: SELECT farm_name, city, latitude FROM farmers LIMIT 5;

Backend Services:
[ ] All 5 PM2 services show status: online
    Command: pm2 status
[ ] order-service has SNS_TOPIC_ARN in its env
    Command: pm2 env agriconnect-order | grep SNS_TOPIC_ARN

SNS:
[ ] Topic AgriConnect-WeatherAlerts exists in SNS console
[ ] At least one confirmed email subscription
    Command: aws sns list-subscriptions-by-topic --topic-arn <ARN> --region ap-south-1
[ ] Manual test publish sends email within 60 seconds

Payment Flow:
[ ] POST /api/orders/create → 401 without token (not 405)
    Command: curl -i -X POST http://localhost:3003/api/orders/create
[ ] Buyer Dashboard shows "Confirm Delivery" button on DELIVERED orders
[ ] Clicking "Confirm Delivery" → button changes to "Payment Released" chip
[ ] PM2 logs show [SNS] payment release published
    Command: pm2 logs agriconnect-order --lines 20

Email:
[ ] PM2 logs show [EMAIL SENT] (not [EMAIL SIMULATED] or [EMAIL FAILED])
    Command: pm2 logs agriconnect-market --lines 30

Notification Center:
[ ] Bell icon shows correct unread count
[ ] Clicking bell opens popover (no blank page crash)
[ ] Notifications list shows with timestamps and green unread dots
[ ] Clicking a notification marks it read (dot disappears)
[ ] Mark All Read clears badge count to 0

Weather Widget:
[ ] Farmer Dashboard shows weather for farmer's registered city
[ ] No city picker dropdown on Farmer Dashboard (location is pinned)
[ ] Weather widget shows city name, temperature, condition

Lambda:
[ ] Function weather-alert-processor exists in Lambda console
[ ] Handler is set to index.handler
[ ] Runtime is Node.js 20.x
[ ] SNS_TOPIC_ARN environment variable is set
[ ] Timeout is 60 seconds
[ ] Test invocation (empty JSON event) returns statusCode: 200
[ ] CloudWatch Logs show weather check entries

EventBridge:
[ ] Rule agriconnect-weather-check shows status: Enabled
[ ] After 15+ minutes, Lambda CloudWatch shows a new invocation
[ ] Weather alert email received (if any location has rain > 70%)
```

---

### 17.12 End-to-End Demo Script

Use this script to demonstrate all Phase 2 features to stakeholders. Takes about 10 minutes.

#### Demo A: Payment Escrow Flow

1. **Login as Farmer** (`farmer1@example.com` / `password123`)
   - Dashboard opens showing weather widget with farmer's pinned city (e.g. "Mawsynram, Meghalaya")
   - No city dropdown visible

2. **Switch to Buyer** (`buyer1@example.com` / `password123`)
   - Click "Buy Now" on any listing → place an order
   - "My Orders" tab → order appears as `PENDING`, no "Confirm Delivery" button yet

3. **Back to Farmer** → "Orders & Sales" tab
   - See the buyer's order
   - Click **Ship** → status → `IN_TRANSIT`
   - Click **Delivered** → status → `DELIVERED`

4. **Back to Buyer** → "My Orders" tab
   - Order now shows `DELIVERED` with a green "Confirm Delivery" button
   - Click **Confirm Delivery**
   - Button changes to "Payment Released" chip
   - Bell icon badge shows **2** (one notification for buyer, one for farmer)
   - **Check email** — SNS payment release notification arrives within 60 seconds

5. **Click the bell icon**
   - Popover opens showing 2 notifications with "just now" timestamp
   - Green unread dots visible
   - Click one → dot disappears (marked read)
   - Click "Mark All Read" → badge goes to 0

#### Demo B: Weather Alert Flow

1. **Manual Lambda trigger:**
   - AWS Console → Lambda → `weather-alert-processor` → Test tab → Create event `{}` → Test
   - Scroll to "Log output" — shows each city's weather code and rain probability
   - If any city has rain > 70%, SNS alert is published

2. **Check email** — weather alert email with:
   - Alert type (HEAVY_RAIN / STORM / RAIN)
   - Temperature, wind speed, rain probability
   - Farming advice bullet points (cover stored produce, postpone harvest, etc.)

3. **Scheduled alerts:**
   - EventBridge rule fires every 15 min automatically
   - CloudWatch Logs → Log groups → `/aws/lambda/weather-alert-processor` → latest log stream
   - Shows all cities checked, alerts published

#### Demo C: Notification Bell from Bid Flow

1. **Login as Buyer** → Place a bid on any listing
2. **Login as Farmer** → Received Bids tab → Accept the bid
3. **Login as Buyer** → Bell icon shows badge → Click bell → See "Bid Accepted" notification

---

### 17.13 Troubleshooting Phase 2

| Symptom | Check | Fix |
|---------|-------|-----|
| Bell click → blank page | PM2 logs for errors; check frontend is rebuilt | Run `bash scripts/frontend-install.sh` on frontend EC2 |
| `[EMAIL SIMULATED]` in logs | SMTP secret still has placeholder | Update `agriconnect/dev/email` with real Gmail + App Password; `pm2 restart all` |
| `[EMAIL FAILED] Invalid login` | Wrong App Password | Regenerate Gmail App Password → update secret → `pm2 restart all` |
| `[SNS] No SNS_TOPIC_ARN` in logs | Order service doesn't have the env var | Run `pm2 env agriconnect-order | grep SNS`; if missing, re-run `backend-update.sh` |
| SNS email not arriving | Subscription not confirmed | Check subscription status in SNS console; resend confirmation email |
| Lambda test: `SNS_TOPIC_ARN not set` | Missing env var on Lambda | Configuration → Environment variables → Add SNS_TOPIC_ARN |
| Lambda test: `Task timed out` | Timeout too short | Configuration → General → Timeout → set to 60 seconds |
| EventBridge not triggering Lambda | Rule disabled or wrong target | Check rule is Enabled; verify target is `weather-alert-processor` |
| No lat/lon on Farmer Dashboard weather | Old farmer record before Phase 2 | Re-seed DB with `node scripts/seed.js --force` OR farmer must re-register |
| `HELD` payment never released | Buyer never clicked Confirm Delivery | UI flow: Farmer must mark DELIVERED first; then Buyer sees the button |
| `POST /api/orders/create → 405` | ALB listener rule missing sub-path | Check ALB rule condition is `/api/orders/*` not `/api/orders`; see Section 16.5b |

---

### 17.14 Secrets Manager Reference (Phase 2)

No new secrets are added in Phase 2. The SNS topic ARN is passed as a PM2 environment variable (not sensitive, not secret).

| Secret Name | What to verify |
|-------------|----------------|
| `agriconnect/dev/database` | host = RDS endpoint, database = agriconnect |
| `agriconnect/dev/jwt` | jwt_secret is a long random string (not the placeholder) |
| `agriconnect/dev/email` | smtp_user = real Gmail address (not `your-email@gmail.com`) |
| `agriconnect/dev/s3` | bucket names match what you created in Section 3 |
| `agriconnect/dev/aws` | access_key = `USE_IAM_ROLE` (EC2 uses instance profile, not hardcoded keys) |

**Refresh secrets cache after updating any secret:**
```bash
pm2 restart all
# Secrets are cached for 5 minutes — restart flushes the cache immediately
```
