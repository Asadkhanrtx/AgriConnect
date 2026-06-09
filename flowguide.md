# AgriConnect — System Flow Guide

## What is AgriConnect?

AgriConnect is an Indian farm-to-market platform that connects farmers directly with buyers and wholesalers, cutting out middlemen. Farmers list their produce with price and quantity. Buyers either purchase directly at the listed price or place a competitive bid. Once an order is placed, the farmer ships it, the buyer confirms delivery, and payment is released.

On top of the marketplace, the platform runs an automated weather monitoring system. Every 6 hours, it checks live weather conditions across 10 farmer locations in India and sends targeted alerts — both as emails and as in-app notifications — to the farmers in those areas.

---

## Services at a Glance

| Service | Port | What it does |
|---|---|---|
| auth-service | 3001 | Register, login, JWT token, `/api/auth/me` |
| marketplace-service | 3002 | Produce listings, bids — create/read/update/delete |
| order-service | 3003 | Place orders, update delivery status, confirm delivery |
| media-service | 3004 | Upload produce images and delivery proofs to S3 |
| notification-service | 3005 | Bell icon API + SQS worker that processes all events |

All five run on a single backend EC2 (`agriconnect-dev-backend`) as separate Node.js processes.

---

## Cloud Services Used

| AWS Service | Purpose |
|---|---|
| CloudFront | Global CDN — entry point for all user traffic |
| WAF v2 | Firewall — blocks SQLi, XSS, brute force at the edge |
| ALB | Routes incoming requests to the right backend service |
| EC2 | Hosts all 5 backend services + Nginx/React frontend |
| RDS (MySQL) | Primary database — all application data |
| Secrets Manager | Stores all credentials — DB, JWT, SMTP, S3 |
| S3 | Stores produce images and delivery proof photos |
| SNS | Pub/sub messaging — broadcasts events and weather alerts |
| SQS | Message queue — decouples event processing from services |
| Lambda | Serverless function — runs weather check logic |
| EventBridge Scheduler | Triggers Lambda every 6 hours |
| IAM | EC2 instance profile + Lambda/scheduler execution roles |

---

## Full Request Flow — From User to Response

### Step 1 — CloudFront (Edge, us-east-1)

Every single request from a user hits CloudFront first. CloudFront is a global CDN with edge locations worldwide. When a user in India opens the app, their request goes to the nearest AWS edge point of presence (Mumbai PoP) — not directly to your server in ap-south-1.

**Why CloudFront is configured in us-east-1:**
CloudFront itself is a global service, but AWS requires the WAF Web ACL that protects CloudFront to be created in `us-east-1`. This is an AWS hard requirement — WAF rules for CloudFront scopes only exist in us-east-1. Your actual app traffic still flows to Mumbai; the us-east-1 requirement is only for the control plane (WAF configuration), not the data path.

**What CloudFront does on each request:**

- Terminates the HTTPS/TLS connection at the edge (your users always get HTTPS even though CloudFront talks HTTP to your ALB)
- Checks its cache for `/assets/*` paths — Vite produces content-hashed filenames like `index-Bx8kP2.js` so these are cached for 1 year; cache hit means the request never reaches your servers
- For `/api/*` and `/*` (SPA routes), caching is disabled — requests always pass through to the origin
- Adds a custom header `X-Forwarded-By: CloudFront` to every request forwarded to the ALB, so your backend knows the request came through CloudFront and not directly

---

### Step 2 — WAF v2 (attached to CloudFront)

The request does not reach your ALB until WAF has inspected it. WAF is attached directly to the CloudFront distribution and runs at the edge before forwarding.

**Four rules run in priority order:**

1. **AWSManagedRulesCommonRuleSet (priority 1)** — AWS-maintained ruleset that blocks SQL injection, cross-site scripting, local file inclusion, and path traversal attempts. If a request body contains `' OR 1=1 --` or a `<script>` tag in a field, it is blocked here before it ever touches your application code.

2. **AWSManagedRulesKnownBadInputsRuleSet (priority 2)** — Blocks known exploit signatures including Log4Shell (`${jndi:ldap://...}`), Spring4Shell, and other CVE-pattern payloads.

3. **RateLimitLogin (priority 3)** — Watches specifically for requests to `/api/auth/login`. If a single IP makes more than 100 login requests in a 5-minute window, all further login attempts from that IP are blocked for that window. This directly prevents brute force attacks and credential stuffing.

4. **GlobalRateLimit (priority 4)** — If any single IP makes more than 2000 total requests in 5 minutes regardless of path, it is blocked. This is the DDoS flood protection layer.

If a request passes all four rules, WAF allows it through and CloudFront forwards it to the ALB origin.

---

### Step 3 — ALB (Application Load Balancer)

The ALB (`agriconnect-dev-alb`) sits inside the VPC spanning both availability zones. It receives the HTTP request from CloudFront and routes it to the correct backend service based on the URL path, using listener rules evaluated top to bottom.

**Routing rules in order:**

```
/api/auth/*          → Target Group: auth-service       → EC2 port 3001
/api/marketplace/*   → Target Group: marketplace-service → EC2 port 3002
/api/orders/*        → Target Group: order-service       → EC2 port 3003
/api/media/*         → Target Group: media-service       → EC2 port 3004
/api/notifications/* → Target Group: notification-service → EC2 port 3005
/* (default)         → Target Group: frontend            → EC2 port 80 (Nginx)
```

The ALB has registered health check endpoints (`/health`) for each service. If a service crashes and fails health checks, the ALB stops sending traffic to it automatically.

---

### Step 4 — Backend Services on EC2

Each of the five services is a Node.js + Express process. They all share a common pattern:

1. On startup, call `getDatabaseConnection()` which reads the secret `agriconnect/dev/database` from AWS Secrets Manager, gets the RDS host/credentials, and establishes a Sequelize connection pool (max 5 connections per service process)
2. The connection is cached — Secrets Manager is only called once at startup, not on every request
3. All models (User, Farmer, Buyer, ProduceListing, Order, Bid, Notification) are registered on the shared Sequelize instance

**auth-service (:3001)**
Handles registration and login. On login, it queries RDS for the user, verifies bcrypt password, generates a signed JWT using the secret fetched from `agriconnect/dev/jwt`. That JWT is returned to the frontend and sent as `Authorization: Bearer <token>` on all subsequent requests.

**marketplace-service (:3002)**
Manages produce listings and bids. When a buyer places a bid, the service writes it to RDS and publishes a `NEW_BID` event to SNS `AgriConnect-Events`. When a farmer accepts a bid, it publishes a `BID_ACCEPTED` event. These events flow through to the notification pipeline described below.

**order-service (:3003)**
When a buyer creates an order, it writes to RDS and publishes a `NEW_ORDER` event to SNS `AgriConnect-Events`. When the farmer updates delivery status to `IN_TRANSIT` or `DELIVERED`, it publishes `ORDER_STATUS`. When the buyer confirms delivery, it publishes `PAYMENT_RELEASED`. All these events are processed by the SQS worker.

**media-service (:3004)**
Accepts multipart image uploads, streams them directly to S3 (`agriconnect-produce-images` for produce photos, `agriconnect-delivery-proofs` for proof of delivery). Returns a public S3 URL which is stored in RDS with the listing record.

**notification-service (:3005)**
Two responsibilities running in the same process:
- Exposes REST endpoints (`/api/notifications/list`, `/api/notifications/unread-count`, `/api/notifications/read-all`) used by the frontend bell icon
- Starts the SQS worker (long-polling loop) that processes all platform events

---

### Step 5 — RDS MySQL (Database Layer)

RDS runs MySQL in the private subnet of `ap-south-1a`, unreachable from the internet. Only EC2 instances in the VPC with the correct security group can connect to it on port 3306.

**Core tables:**
- `Users` — base auth record (email, hashed password, role: FARMER/BUYER/ADMIN)
- `Farmers` — extended farmer profile (farm_name, location, city, state, lat/lon)
- `Buyers` — extended buyer profile (company_name)
- `ProduceListings` — what a farmer is selling (product, quantity, price, unit, image_url)
- `Orders` — a buyer's confirmed purchase (links Buyer, Listing, quantity, total_amount, delivery_status, buyer_confirmed)
- `Bids` — a buyer's price offer on a listing (status: PENDING/ACCEPTED/REJECTED)
- `Notifications` — per-user bell icon entries (title, message, is_read, created_at)

Sequelize handles all queries with a connection pool. Each service maintains its own pool of up to 5 connections to RDS.

---

### Step 6 — Secrets Manager

Every credential in the system is stored in AWS Secrets Manager. Nothing is hardcoded or in environment variables directly.

**The 5 secrets and what reads them:**

| Secret path | Contents | Read by |
|---|---|---|
| `agriconnect/dev/database` | host, port, database, username, password | All 5 services at startup |
| `agriconnect/dev/jwt` | jwt_secret, jwt_expiry | auth-service at startup |
| `agriconnect/dev/email` | host, port, user, pass, from | notification-service when sending email |
| `agriconnect/dev/s3` | produce_bucket, delivery_bucket, region | media-service at startup |
| `agriconnect/dev/aws` | access_key=USE_IAM_ROLE | Services use EC2 instance profile instead |

The EC2 instance has an IAM instance profile attached, so the AWS SDK automatically picks up temporary credentials from the instance metadata endpoint — no static keys needed.

---

## The Event Pipeline — SNS → SQS → Worker

This pipeline is the backbone of all real-time notifications in the platform. Every meaningful user action publishes an event, and the SQS worker processes it asynchronously.

### Why it is designed this way

If the order-service called the notification-service directly (HTTP), a slow notification delivery would make the buyer's order request hang. By publishing to SNS → SQS and returning immediately, the order creation responds in milliseconds. The notification arrives slightly later but the user experience is never blocked.

### The flow

```
Business Service (order/marketplace)
        │
        │ sns.publish({ type: 'NEW_ORDER', ...payload })
        ▼
SNS Topic: AgriConnect-Events
        │
        │ SNS subscription (SQS protocol)
        ▼
SQS Queue: AgriConnect-Notifications-Queue
        │
        │ long-poll every 20 seconds (up to 10 messages per batch)
        ▼
SQS Worker (running inside notification-service on EC2)
        │
        ├── writes Notification row to RDS  ← bell icon counter
        └── sends email via Nodemailer/SMTP ← farmer/buyer inbox
```

### Event types the worker handles

| Event type | Published by | What worker does |
|---|---|---|
| `NEW_ORDER` | order-service | Creates notification for farmer + sends order email to farmer |
| `NEW_BID` | marketplace-service | Creates notification for farmer + sends bid email to farmer |
| `ORDER_STATUS` | order-service | Creates notification for buyer (shipped / delivered) |
| `BID_ACCEPTED` | marketplace-service | Creates notification for buyer |
| `BID_REJECTED` | marketplace-service | Creates notification for buyer |
| `PAYMENT_RELEASED` | order-service | Creates notification for both farmer and buyer + sends payment email to farmer |
| `WEATHER_ALERT` | Lambda via SNS Events | Queries RDS for all farmers in the affected city, creates per-farmer notifications + sends weather alert email to each |

### How the SQS worker polls

The worker runs an infinite loop using `setImmediate` (non-blocking, never sleeps when there are messages):

1. Call `ReceiveMessage` with `WaitTimeSeconds: 20` — SQS holds the connection open for up to 20 seconds waiting for messages before returning empty. This is long-polling and dramatically reduces API call costs compared to short-polling
2. Process up to 10 messages in parallel
3. For each message: unwrap it (SNS wraps the payload in a `{Type: "Notification", Message: "..."}` envelope), parse the inner JSON, call the correct handler based on `event.type`
4. If processing succeeds, call `DeleteMessage` — message is permanently removed from the queue
5. If processing fails, do NOT delete — the message stays in the queue. SQS makes it invisible for 30 seconds (VisibilityTimeout) then re-delivers it to retry
6. After 3 failed delivery attempts (`maxReceiveCount: 3`), SQS automatically moves the message to the Dead Letter Queue

### Dead Letter Queue (DLQ)

`AgriConnect-Notifications-DLQ` holds messages that failed processing 3 times. Messages stay there for 14 days. This prevents a bad message from retrying forever and blocking the queue. You can inspect the DLQ in the AWS console to debug what failed and why, then replay messages manually if needed.

---

## Weather Alert Pipeline — EventBridge → Lambda → SNS → SQS

This is a fully serverless, automated pipeline that runs independently of any user action.

### Step 1 — EventBridge Scheduler triggers Lambda

Amazon EventBridge Scheduler fires the `weather-alert-processor` Lambda function on a `rate(6 hours)` schedule. No EC2 is involved — this is entirely serverless. The scheduler has an IAM role that gives it permission to invoke the Lambda.

The `depends_on` in Terraform ensures the Lambda permission (which grants the scheduler invoke rights) is always created before the scheduler itself, preventing a race condition at deploy time.

### Step 2 — Lambda fetches live weather

The Lambda function (`weather-alert-processor`, Node.js 18) has a hardcoded list of 10 high-rainfall Indian farming locations:

```
Mawsynram, Cherrapunji, Shillong (Meghalaya)
Agumbe, Mangalore, Bangalore (Karnataka)
Kochi (Kerala), Gangtok (Sikkim)
Nashik, Pune (Maharashtra)
Amritsar, Ludhiana (Punjab)
```

For each location it makes an HTTPS call to the free Open-Meteo API:
```
https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...
  &current_weather=true
  &hourly=precipitation_probability
  &timezone=Asia/Kolkata
```

It reads:
- `current_weather.weathercode` — WMO weather code (0=clear, 51–67=rain, 95–99=thunderstorm, 45–48=fog)
- `hourly.precipitation_probability[current_hour]` — rain probability percentage

### Step 3 — Lambda decides alert severity

```
weathercode 95–99                    → STORM      (HIGH severity)
rain probability ≥ 80%               → HEAVY_RAIN (HIGH severity)
rain code + probability ≥ 70%        → RAIN       (MEDIUM severity)
weathercode 45–48                    → FOG        (LOW severity)
anything else                        → no alert, skip
```

If no alert condition is met for a city, the Lambda moves to the next city and nothing is published for that location.

### Step 4 — Lambda publishes to two SNS topics

For each city that has an alert condition, the Lambda publishes to two different SNS topics in the same call:

**Topic 1: AgriConnect-WeatherAlerts**
This is a plain-text broadcast SNS topic intended for direct email subscription (admin monitoring). The message is a pre-formatted plain text email with full weather details and farming advice. Anyone who subscribes their email to this SNS topic receives this email directly from SNS — no SQS involved.

**Topic 2: AgriConnect-Events**
This publishes a structured JSON payload:
```json
{
  "type": "WEATHER_ALERT",
  "alert_type": "HEAVY_RAIN",
  "severity": "HIGH",
  "city": "Mawsynram",
  "state": "Meghalaya",
  "message": "Heavy rain likely (85% probability)",
  "advice": "• Cover all stored produce...",
  "temperature": 18,
  "rain_probability": 85,
  "windspeed": 24,
  "timestamp": "2024-01-15T06:00:00.000Z"
}
```

This flows into the SQS pipeline described above.

### Step 5 — SQS worker handles WEATHER_ALERT

When the SQS worker picks up a `WEATHER_ALERT` event, the `handleWeatherAlert` function:

1. Queries RDS: `SELECT * FROM Farmers WHERE city = 'Mawsynram' AND latitude IS NOT NULL`, joining the User table to get email addresses
2. For each farmer found in that city, creates a `Notification` row in RDS — this immediately increments their bell icon count when they next poll `/api/notifications/unread-count`
3. For each farmer with a valid email, calls `sendEmail()` with a formatted HTML weather alert email showing the alert type, temperature, rain probability, wind speed, and specific farming advice (cover produce, delay harvest, secure equipment, etc.)

The result: every farmer registered in an affected city gets both an in-app notification (visible next time they open the dashboard) and a direct email in their inbox — all triggered automatically from a Lambda function running on a schedule, with no human intervention.

---

## Email Delivery

All emails go through Nodemailer using Gmail SMTP. The credentials are read from `agriconnect/dev/email` in Secrets Manager at send time (not cached, since emails are infrequent).

`sendEmail()` is fire-and-forget — if it fails, it logs the error but does not throw. This means an SMTP failure never crashes the SQS worker or blocks a request. The notification DB row is already written (bell icon works) even if the email fails.

**Emails sent by the platform:**
- New order received → farmer
- New bid received → farmer
- Bid accepted/rejected → buyer
- Order shipped / delivered → buyer
- Payment released → farmer
- Weather alert → all farmers in affected city

---

## How the Bell Icon Works

The notification bell in the frontend header polls `/api/notifications/unread-count` every 30 seconds. This returns a count of `Notification` rows in RDS where `is_read = false` for the logged-in user.

The count only goes up when the SQS worker writes a new row to the Notifications table. It goes down when the user opens the notification popover and clicks a notification (calls `PUT /api/notifications/:id/read`) or clicks "mark all read" (`PUT /api/notifications/read-all`).

The source of every notification row is the SQS worker — whether the event came from an order, a bid, or a weather alert, all roads lead through the same `createNotification()` function in the worker.

---

## Complete End-to-End: Buyer Places an Order

```
1. Buyer clicks "Buy Now" in the React frontend
2. Frontend: POST /api/orders/create  { listing_id, quantity }
3. CloudFront receives HTTPS request, checks WAF (passes)
4. CloudFront → ALB (HTTP, X-Forwarded-By: CloudFront)
5. ALB routes /api/orders/* → order-service :3003
6. order-service validates JWT, checks BUYER role
7. order-service writes Order row to RDS MySQL
8. order-service publishes NEW_ORDER event to SNS AgriConnect-Events
9. order-service returns { order_id, total_amount } → 201 response
   ← Buyer sees order confirmation immediately

(Asynchronously, milliseconds to seconds later:)

10. SNS AgriConnect-Events delivers message to SQS AgriConnect-Notifications-Queue
11. SQS worker in notification-service picks up message (long-poll)
12. Worker parses event: type=NEW_ORDER, farmer_user_id=X, farmer_email=Y
13. Worker calls createNotification(farmer_user_id, "New Order Received!", "...")
    → RDS: INSERT INTO Notifications (user_id, title, message)
14. Worker calls sendEmail({ to: farmer_email, subject: "New Order...", html: ... })
    → Nodemailer → Gmail SMTP → farmer's inbox
15. Worker calls DeleteMessage → message removed from SQS
16. Next time farmer opens dashboard: unread-count API returns 1
17. Farmer opens bell popover: sees "Buyer ordered 50 kg of Tomatoes for ₹2,500"
```

---

## Complete End-to-End: Weather Alert Fires

```
1. EventBridge Scheduler fires at 06:00 IST (rate 6 hours)
2. Lambda weather-alert-processor is invoked
3. Lambda loops through 10 farmer locations
4. For Mawsynram: Open-Meteo returns weathercode=63, rainProb=85%
5. Lambda evaluates: rainProb >= 80 → HEAVY_RAIN, HIGH severity
6. Lambda publishes to SNS AgriConnect-WeatherAlerts:
   → Plain-text email goes directly to any admin email subscribers
7. Lambda publishes to SNS AgriConnect-Events:
   → JSON payload: { type: WEATHER_ALERT, city: Mawsynram, ... }
8. SNS delivers to SQS AgriConnect-Notifications-Queue
9. SQS worker picks up message
10. Worker queries RDS: SELECT farmers WHERE city='Mawsynram' AND latitude IS NOT NULL
11. Finds 2 farmers registered in Mawsynram
12. For each farmer:
    → INSERT INTO Notifications (title: "🌧️ Weather Alert: HEAVY_RAIN in Mawsynram")
    → sendEmail(farmer_email, subject: "Weather Alert for Mawsynram: HEAVY_RAIN", html: ...)
13. Worker deletes message from SQS
14. Both Mawsynram farmers see bell count +1 on next dashboard load
15. Lambda continues to next city — repeats for all 10 locations
16. Lambda returns { alertsPublished: 2 } and terminates
    (No EC2 running, no cost while idle — pure serverless)
```
