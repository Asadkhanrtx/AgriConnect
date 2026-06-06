# AgriConnect - Project Context & Roadmap

## 1. Project Overview
**Name:** AgriConnect – Farm to Market Platform
**Purpose:** A marketplace connecting Farmers and Buyers (Wholesalers / Retailers). 
**Architecture:** Full-stack Microservices Architecture on AWS.

This document serves as a state-of-the-union for the project, detailing exactly what has been implemented so far, and outlining the exact roadmap for future AWS Cloud Service integrations.

---

## 2. What Has Been Done So Far (Current State)

The foundational architecture and MVP (Minimum Viable Product) codebase have been fully generated. The codebase uses a monorepo structure with independent deployment scripts.

### 2.1 Infrastructure & Deployment Setup
- **`setup.md`**: An extremely detailed step-by-step guide was generated for setting up the initial AWS environment (VPC, EC2 instances in public/private subnets, RDS MySQL, S3 Buckets, AWS Secrets Manager, IAM Roles, and ALB).
- **Deployment Scripts (`scripts/`)**: Automated bash scripts (`frontend-install.sh`, `backend-install.sh`) were created to handle Node.js, PM2, and Nginx installations directly on EC2 instances.

### 2.2 Shared Library (`shared/`)
- **Database**: Initialized Sequelize with 8 models (`User`, `Farmer`, `Buyer`, `ProduceListing`, `Bid`, `Order`, `Transaction`, `Notification`).
- **AWS Secrets Manager**: Implemented a dynamic utility (`utils/secrets.js`) to fetch database credentials, JWT secrets, and AWS configs securely at runtime.
- **Migrations & Seeders**: Scripts (`scripts/migrate.js`, `scripts/seed.js`) were created to automatically sync the DB and populate it with 20 Farmers, 20 Buyers, and 50 realistic Produce Listings.
- **Middleware**: A shared JWT authentication and Role-Based Access Control (RBAC) middleware (`middleware/auth.js`).

### 2.3 Microservices (`services/`)
Five independent Node.js/Express microservices were built:
1. **`auth-service` (Port 3001)**: Handles registration, login, and JWT token issuance.
2. **`marketplace-service` (Port 3002)**: Handles produce listings, search/filtering, and buyer bids.
3. **`order-service` (Port 3003)**: Handles order creation, transactions, inventory reduction, and delivery status tracking.
4. **`media-service` (Port 3004)**: Integrates `AWS SDK V3` with S3 to handle image uploads for produce and delivery proofs.
5. **`notification-service` (Port 3005)**: Currently simulates email notifications and stores alerts in the database.

### 2.4 Frontend Application (`frontend/`)
- **Tech Stack**: React, Vite, React-Router, Material UI.
- **Theme**: Professional Agriculture-inspired color palette (Primary: `#2E7D32`, Secondary: `#66BB6A`).
- **Dashboards**: Created distinct role-based experiences for `Farmers`, `Buyers`, and `Admins`. The Buyer view features beautiful media cards representing produce, and the Farmer view offers grid statistics and earning insights.
- **Integration**: Configured `vite.config.js` to proxy requests to the respective local microservice ports.

---

## 3. Future Cloud Service Integrations (Roadmap)

The current MVP uses EC2, RDS, S3, ALB, and Secrets Manager. As per the architectural roadmap, the following AWS services and third-party APIs need to be integrated next:

### 3.1 Advanced AWS Services
- **Amazon SNS & SQS**: Replace the synchronous/simulated notifications in the `notification-service`. Implement Pub/Sub messaging where the `order-service` publishes to an SNS topic, and the `notification-service` consumes via SQS to send emails/SMS reliably.
- **AWS Lambda & EventBridge**: Implement serverless cron jobs. For example, triggering daily sales report generation, or checking `harvest_date` on produce listings to auto-update statuses.
- **Amazon CloudWatch**: Integrate CloudWatch Logs agent into the EC2 instances/PM2 for centralized log aggregation. Set up CloudWatch Alarms for high CPU utilization or 5xx errors on the ALB.
- **AWS WAF (Web Application Firewall)**: Attach a WAF to the Application Load Balancer to protect the backend services from common web exploits (SQLi, XSS) and rate-limit abusive IP addresses.
- **Amazon CloudFront & Route53**: Attach CloudFront as a CDN in front of the Frontend EC2 instance (or migrate the React build to an S3 bucket served via CloudFront). Configure Route53 for custom domain DNS routing and ACM for SSL certificates.

### 3.2 Third-Party API Integrations
- **Weather API Integration**: Integrate a third-party Weather API (e.g., OpenWeatherMap). Display real-time weather alerts and forecasts on the `Farmer Dashboard` to help them plan harvests.
- **Payment Gateway**: Integrate Stripe or Razorpay into the `order-service` to replace the simulated transaction logic with real payment processing.

---
**Note to AI Assistant:** Please read this file to understand the current architecture before proposing or implementing changes. The system relies heavily on `agriconnect-shared` for DB models and Secrets, so ensure any new services utilize these shared utilities.
