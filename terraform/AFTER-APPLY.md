# After `terraform apply` — Manual Steps

Run these steps **in order** after `terraform apply` completes successfully.
Total time: ~20 minutes.

---

## Step 0 — Grab outputs (run these first)

```bash
cd terraform/

ALB_DNS=$(terraform output -raw alb_dns_name)
BASTION_IP=$(terraform output -raw bastion_public_ip)
BACKEND_IP=$(terraform output -raw backend_private_ip)
RDS_HOST=$(terraform output -raw rds_endpoint)

echo "ALB        : http://$ALB_DNS"
echo "Bastion    : $BASTION_IP"
echo "Backend    : $BACKEND_IP"
echo "RDS Host   : $RDS_HOST"
```

---

## Step 1 — Wait for EC2 UserData to finish (~8-12 min)

The backend EC2 runs `backend-install.sh` automatically on boot. It:
- Installs Node.js, PM2
- Clones the repo
- Waits for RDS
- Runs migrations + seed
- Starts all 5 PM2 services

**SSH in to monitor progress:**

```bash
# Connect to bastion first
ssh -i ~/.ssh/webserver-key-pair.pem ubuntu@$BASTION_IP

# From bastion, jump to backend
ssh ubuntu@$BACKEND_IP

# Watch the init log (it's still running if you see output scrolling)
tail -f /var/log/backend-init.log

# Once done, check PM2 status
pm2 status
```

**Expected PM2 output:**
```
┌────┬──────────────────────┬─────────┬──────┬───────────┬──────────┐
│ id │ name                 │ mode    │ ↺    │ status    │ cpu      │
├────┼──────────────────────┼─────────┼──────┼───────────┼──────────┤
│ 0  │ agriconnect-auth     │ fork    │ 0    │ online    │ 0%       │
│ 1  │ agriconnect-market   │ fork    │ 0    │ online    │ 0%       │
│ 2  │ agriconnect-order    │ fork    │ 0    │ online    │ 0%       │
│ 3  │ agriconnect-media    │ fork    │ 0    │ online    │ 0%       │
│ 4  │ agriconnect-notif    │ fork    │ 0    │ online    │ 0%       │
└────┴──────────────────────┴─────────┴──────┴───────────┴──────────┘
```

---

## Step 2 — Update Secrets Manager with the real RDS endpoint

The backend reads database credentials from Secrets Manager secret `agriconnect/dev/database`.
The RDS endpoint is only known after Terraform creates it, so update the secret now:

```bash
# Get the current secret value
aws secretsmanager get-secret-value \
  --secret-id "agriconnect/dev/database" \
  --region ap-south-1 \
  --query SecretString --output text

# Update with the real RDS host
aws secretsmanager put-secret-value \
  --secret-id "agriconnect/dev/database" \
  --region ap-south-1 \
  --secret-string "{
    \"host\": \"$RDS_HOST\",
    \"port\": 3306,
    \"database\": \"agriconnect\",
    \"username\": \"admin\",
    \"password\": \"Sixninesixtynine\"
  }"
```

**Then restart the backend services so they pick up the new secret:**

```bash
# SSH into backend (via bastion)
ssh -i ~/.ssh/webserver-key-pair.pem \
    -o "ProxyCommand ssh -i ~/.ssh/webserver-key-pair.pem -W %h:%p ubuntu@$BASTION_IP" \
    ubuntu@$BACKEND_IP

pm2 restart all
pm2 status
```

---

## Step 3 — Build and deploy the React frontend

The frontend EC2 has the repo cloned and Nginx running, but the React app needs
to be built with the ALB URL so API calls go to the right place.

```bash
# SSH into the frontend EC2 (it's public — direct SSH)
FRONTEND_IP=$(terraform output -raw frontend_public_ip 2>/dev/null || echo "check AWS console")
ssh -i ~/.ssh/webserver-key-pair.pem ubuntu@$FRONTEND_IP

# Inside the frontend EC2:
cd /home/ubuntu/AgriConnect/frontend

# Build with the real ALB URL
REACT_APP_API_URL="http://$ALB_DNS" npm run build

# Restart Nginx to serve the new build
sudo systemctl restart nginx

# Verify Nginx is serving
curl -s -o /dev/null -w "%{http_code}" http://localhost/
# Should return: 200
```

---

## Step 4 — Test ALB health checks

Wait ~2 minutes after PM2 is online, then check all target groups:

```bash
# Quick health check from your local machine
for port in auth:3001 marketplace:3002 orders:3003 media:3004 notifications:3005; do
  name=${port%:*}
  p=${port#*:}
  echo -n "$name (:$p) → "
  curl -s -o /dev/null -w "%{http_code}" http://$ALB_DNS/api/${name}/health 2>/dev/null || echo "unreachable"
done

# Test frontend
echo -n "frontend → "
curl -s -o /dev/null -w "%{http_code}" http://$ALB_DNS/
```

**Expected:** All return `200`. If any return `502`/`504`, check PM2 logs on the backend.

---

## Step 5 — Subscribe your email to SNS weather alerts

The `AgriConnect-WeatherAlerts` SNS topic sends weather alert emails.
Subscribe your admin email (or test email) so you can verify the Lambda works:

```bash
aws sns subscribe \
  --topic-arn $(terraform output -raw sns_weather_alerts_arn) \
  --protocol email \
  --notification-endpoint "your-email@example.com" \
  --region ap-south-1
```

Check your inbox and click **"Confirm subscription"**.

> Farmers subscribe themselves through the app UI when they enable notifications.

---

## Step 6 — Test the SNS → SQS pipeline

Manually publish a test event to verify the notification pipeline:

```bash
aws sns publish \
  --topic-arn $(terraform output -raw sns_events_arn) \
  --message '{"type":"NEW_ORDER","order_id":999,"farmer_user_id":1,"buyer_name":"Test Buyer","product_name":"Test Wheat","quantity":10,"amount":500}' \
  --message-attributes '{"eventType":{"DataType":"String","StringValue":"NEW_ORDER"}}' \
  --region ap-south-1
```

Then check SQS message count (should be 0 if notification-service consumed it):

```bash
aws sqs get-queue-attributes \
  --queue-url $(terraform output -raw sqs_notifications_url) \
  --attribute-names ApproximateNumberOfMessages \
  --region ap-south-1
```

Check notification-service logs on the backend:

```bash
# SSH into backend
pm2 logs agriconnect-notif --lines 20
```

---

## Step 7 — Test the Lambda weather alert

Manually invoke the Lambda to verify end-to-end:

```bash
aws lambda invoke \
  --function-name weather-alert-processor \
  --region ap-south-1 \
  /tmp/lambda-response.json

cat /tmp/lambda-response.json
```

---

## Step 8 — Open the application

```bash
echo "App URL: http://$ALB_DNS"
```

Open the URL in your browser. You should see the AgriConnect React frontend.

**Smoke test checklist:**
- [ ] Frontend loads (login page visible)
- [ ] Register a farmer account
- [ ] Register a buyer account
- [ ] Farmer creates a produce listing
- [ ] Buyer places a bid
- [ ] Farmer checks notification bell — should show new bid notification
- [ ] Upload a produce image — should save to S3
- [ ] Order flow: buyer confirms, farmer ships, buyer confirms delivery

---

## Step 9 — Update S3 bucket name in Secrets Manager (if needed)

The `agriconnect/dev/s3` secret should reference your actual bucket names:

```bash
aws secretsmanager put-secret-value \
  --secret-id "agriconnect/dev/s3" \
  --region ap-south-1 \
  --secret-string "{
    \"produce_images_bucket\": \"agriconnect-produce-images-978594443309\",
    \"delivery_proofs_bucket\": \"agriconnect-delivery-proofs-978594443309\",
    \"region\": \"ap-south-1\"
  }"
```

Then restart backend:

```bash
# SSH into backend
pm2 restart all
```

---

## Troubleshooting

### Backend services not starting
```bash
# SSH into backend, check the init log
tail -100 /var/log/backend-init.log

# Check PM2 error logs
pm2 logs --err --lines 50

# Manually restart a service
pm2 restart agriconnect-auth
```

### RDS connection refused
```bash
# Test from backend EC2
mysql -h $RDS_HOST -u admin -pSixninesixtynine -e "SELECT 1;"

# If it hangs, check Security Group — port 3306 must be open within VPC
# (it is, via AgriConnect-Common-SG — but verify in AWS Console)
```

### ALB returning 502 Bad Gateway
- PM2 services haven't started yet — wait and check `pm2 status`
- Service crashed — check `pm2 logs agriconnect-auth --lines 50`
- Wrong port — verify target group port matches PM2 service port

### Frontend shows blank page or API errors
- React was built without the ALB URL — re-run Step 3
- Check browser console for `CORS` or `net::ERR_CONNECTION_REFUSED` errors
- Verify `REACT_APP_API_URL` was set correctly during build: `grep -r "localhost" build/` (should find nothing)

### Notification bell empty
- Check that `/api/notifications/list` returns 200 (not 301/302)
- Verify `agriconnect-notif` PM2 process is online
- Check SQS DLQ for failed messages:
  ```bash
  aws sqs get-queue-attributes \
    --queue-url $(terraform output -raw sqs_dlq_url) \
    --attribute-names ApproximateNumberOfMessages \
    --region ap-south-1
  ```

---

## Quick reference — useful SSH commands

```bash
# Bastion
ssh -i ~/.ssh/webserver-key-pair.pem ubuntu@$BASTION_IP

# Backend (via bastion jump)
ssh -i ~/.ssh/webserver-key-pair.pem \
    -J ubuntu@$BASTION_IP \
    ubuntu@$BACKEND_IP

# Frontend (direct — public subnet)
ssh -i ~/.ssh/webserver-key-pair.pem ubuntu@$FRONTEND_IP

# One-liner from terraform output
$(terraform output -raw ssh_backend_via_bastion)
```

---

## Ongoing — update the backend after code changes

```bash
# SSH into backend, then:
cd /home/ubuntu/AgriConnect
bash scripts/backend-update.sh
```

This pulls latest code, reinstalls dependencies, re-runs migrations, and restarts PM2.
