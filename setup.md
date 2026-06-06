# AgriConnect – Farm to Market Platform
## Complete AWS Deployment Guide

> **Read this entire guide before starting.** Follow every section in order. Each section depends on resources created in the previous one.

---

## Architecture Overview

```
Internet
   │
   ▼
[ALB – agriconnect-alb]  (Public, port 80)
   │  Path-based routing: /api/auth/* /api/marketplace/* etc.
   ▼
[Backend EC2 – Private Subnet]
   └── PM2: 5 microservices on ports 3001–3005
   └── Reads secrets from → AWS Secrets Manager
   └── Reads/writes images → S3

[Frontend EC2 – Public Subnet]
   └── Nginx: serves React build + proxies /api/* to ALB

[RDS MySQL – Database Subnet]  (private, no public access)
```

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
| Inbound | HTTP | 80 | 0.0.0.0/0 |
| Inbound | SSH | 22 | Your IP (x.x.x.x/32) |
| Outbound | All | All | 0.0.0.0/0 |

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
6. **Note the endpoint**: Go to the database → Connectivity & security → copy the **Endpoint** (looks like `agriconnect-mysql.xxxxxxxxx.us-east-1.rds.amazonaws.com`)

---

## SECTION 3: S3 Buckets

### Bucket 1: Produce Images (Public Read)

1. Go to **S3 Console → Create bucket**
2. **Bucket name**: `agriconnect-produce-images-<your-account-id>`
   > S3 bucket names must be globally unique. Append your AWS account ID (12-digit number) to guarantee uniqueness.
3. **Region**: Same region you're using everywhere (e.g. `us-east-1`)
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
      "Resource": "arn:aws:s3:::agriconnect-produce-images-<your-account-id>/*"
    }
  ]
}
```
> Replace `<your-account-id>` with your actual 12-digit AWS account ID. Find it in the top-right account menu.

### Bucket 2: Delivery Proofs (Private)

1. **Bucket name**: `agriconnect-delivery-proofs-<your-account-id>`
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
  "host": "agriconnect-mysql.XXXXXXXXXX.us-east-1.rds.amazonaws.com",
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
  "region": "us-east-1",
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
  "produce_bucket": "agriconnect-produce-images-<your-account-id>",
  "delivery_bucket": "agriconnect-delivery-proofs-<your-account-id>"
}
```
> Replace `<your-account-id>` with your 12-digit AWS account ID (same as bucket names).

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
        "arn:aws:s3:::agriconnect-produce-images-<your-account-id>/*",
        "arn:aws:s3:::agriconnect-delivery-proofs-<your-account-id>/*"
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
Enter your AWS Region (e.g. us-east-1): us-east-1
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

The ALB routes traffic from the internet to the correct microservice port on the backend.

### 9.1 Create Target Groups

Go to **EC2 Console → Target Groups → Create target group** for each:

| Target Group Name | Protocol | Port | Health Check Path |
|-------------------|----------|------|-------------------|
| `agriconnect-auth-tg` | HTTP | 3001 | `/health` |
| `agriconnect-market-tg` | HTTP | 3002 | `/health` |
| `agriconnect-order-tg` | HTTP | 3003 | `/health` |
| `agriconnect-media-tg` | HTTP | 3004 | `/health` |
| `agriconnect-notif-tg` | HTTP | 3005 | `/health` |

For each target group:
- Target type: **Instances**
- VPC: `agriconnect-vpc`
- Health check protocol: HTTP
- Health check path: `/health`
- Healthy threshold: 2
- Unhealthy threshold: 3
- Timeout: 5 seconds
- Interval: 30 seconds

After creating each target group:
1. Click **Register targets**
2. Select your **backend EC2 instance**
3. Override port to the correct port (3001, 3002, etc.)
4. Click **Include as pending below → Register pending targets**

### 9.2 Create the ALB

1. Go to **EC2 Console → Load Balancers → Create Load Balancer → Application Load Balancer**
2. Name: `agriconnect-alb`
3. Scheme: **Internet-facing**
4. IP address type: IPv4
5. VPC: `agriconnect-vpc`
6. Mappings: Select **both public subnets** (required: minimum 2 AZs)
7. Security groups: `agriconnect-alb-sg`
8. Listeners: HTTP:80 → Default action: Forward to `agriconnect-auth-tg` (temporary)
9. Click **Create load balancer**
10. **Copy the ALB DNS name** — looks like `agriconnect-alb-1234567890.us-east-1.elb.amazonaws.com`

### 9.3 Listener Rules

1. Go to the ALB → **Listeners → HTTP:80 → Manage rules**
2. Add the following rules (in order, before the default):

| Priority | Condition | Action |
|----------|-----------|--------|
| 1 | Path is `/api/auth/*` | Forward to `agriconnect-auth-tg` |
| 2 | Path is `/api/marketplace/*` | Forward to `agriconnect-market-tg` |
| 3 | Path is `/api/orders/*` | Forward to `agriconnect-order-tg` |
| 4 | Path is `/api/media/*` | Forward to `agriconnect-media-tg` |
| 5 | Path is `/api/notifications/*` | Forward to `agriconnect-notif-tg` |

> The default rule (lowest priority) can remain pointing to `agriconnect-auth-tg`.

### 9.4 Verify ALB Routing

From your local machine or any internet-connected machine:
```bash
# Replace with your actual ALB DNS
ALB="http://agriconnect-alb-1234567890.us-east-1.elb.amazonaws.com"

curl $ALB/health                     # Should hit auth-service → "auth-service"
curl $ALB/api/auth/health            # Wait -- actually use the /health path at root

# Proper test:
curl $ALB/api/marketplace/listings   # Should return JSON listings array
```

> Note: The ALB health checks hit `/health` at the **root** of each service, not `/api/*/health`. That's why we added `app.get('/health', ...)` to each service's index.js.

---

## SECTION 10: Frontend Deployment

SSH into the **frontend EC2** and run:

```bash
cd /home/ubuntu/AgriConnect
bash scripts/frontend-install.sh
```

The script will prompt:
```
Enter the Backend ALB DNS or IP (e.g. http://agriconnect-alb-xxxx.us-east-1.elb.amazonaws.com): 
```

Enter your full ALB DNS with `http://` prefix.

**What the script does:**
1. Installs Node.js 20.x and Nginx
2. Builds the React application
3. Configures Nginx to:
   - Serve the React SPA from `/home/ubuntu/AgriConnect/frontend/dist`
   - Proxy all `/api/*` requests to the ALB
4. Starts and enables Nginx

### Verify Frontend

```bash
# Check nginx is running
sudo systemctl status nginx

# Test the health of nginx
curl http://localhost/

# Get the frontend public IP
curl http://169.254.169.254/latest/meta-data/public-ipv4
```

Open `http://<FRONTEND_PUBLIC_IP>` in your browser — you should see the AgriConnect login page.

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
[ ] All 5 /health endpoints return {"status":"ok"}
[ ] ALB target groups show Healthy targets
[ ] Frontend loads at http://<FRONTEND_PUBLIC_IP>

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
AWS_REGION=us-east-1 bash scripts/backend-update.sh
```

### Update Frontend
```bash
# SSH into frontend EC2
cd /home/ubuntu/AgriConnect
BACKEND_URL=http://<ALB-DNS> bash scripts/frontend-update.sh
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
  --region us-east-1 \
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
