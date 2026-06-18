#!/bin/bash
# Run this script ONCE after terraform apply to finish EKS setup.
# It installs the AWS Load Balancer Controller and deploys the app via Helm.
set -e

CLUSTER_NAME="agriconnect-dev-eks"
REGION="ap-south-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "========================================================"
echo "  AgriConnect EKS Bootstrap"
echo "  Cluster : $CLUSTER_NAME"
echo "  Region  : $REGION"
echo "  Account : $ACCOUNT_ID"
echo "========================================================"

# ── 1. Configure kubectl ──────────────────────────────────────────────────────
echo ""
echo "[1/5] Configuring kubectl..."
aws eks update-kubeconfig --name "$CLUSTER_NAME" --region "$REGION"
kubectl get nodes
echo "  kubectl configured."

# ── 2. Install AWS Load Balancer Controller ───────────────────────────────────
echo ""
echo "[2/5] Installing AWS Load Balancer Controller..."

LB_ROLE_ARN=$(aws iam list-roles --query "Roles[?RoleName=='agriconnect-dev-eks-lb-controller-role'].Arn" --output text)
echo "  LB Controller role ARN: $LB_ROLE_ARN"

helm repo add eks https://aws.github.io/eks-charts --force-update
helm repo update

helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  --namespace kube-system \
  --set clusterName="$CLUSTER_NAME" \
  --set serviceAccount.create=true \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set "serviceAccount.annotations.eks\.amazonaws\.com/role-arn=$LB_ROLE_ARN" \
  --wait --timeout 5m

echo "  AWS Load Balancer Controller installed."

# ── 3. Get IRSA role for services ─────────────────────────────────────────────
echo ""
echo "[3/5] Getting service IRSA role ARN..."
SERVICES_ROLE_ARN=$(aws iam list-roles --query "Roles[?RoleName=='agriconnect-dev-eks-services-role'].Arn" --output text)
echo "  Services IRSA role ARN: $SERVICES_ROLE_ARN"

# ── 4. Deploy app with Helm ───────────────────────────────────────────────────
echo ""
echo "[4/5] Deploying AgriConnect services via Helm..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="$SCRIPT_DIR/../helm/agriconnect"

helm upgrade --install agriconnect "$CHART_DIR" \
  --namespace default \
  --set "global.irsaRoleArn=$SERVICES_ROLE_ARN" \
  --wait --timeout 10m

echo "  Helm deployment complete."

# ── 5. Get ALB DNS ────────────────────────────────────────────────────────────
echo ""
echo "[5/5] Fetching ALB DNS name..."
echo "  Waiting for Ingress ALB to be provisioned (up to 3 min)..."

for i in $(seq 1 18); do
  ALB_DNS=$(kubectl get ingress agriconnect-ingress -n default \
    -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
  if [ -n "$ALB_DNS" ]; then
    break
  fi
  echo "  Waiting... ($((i*10))s)"
  sleep 10
done

echo ""
echo "========================================================"
echo "  Bootstrap Complete!"
echo ""
echo "  ALB DNS : $ALB_DNS"
echo ""
echo "  NEXT STEP: Update CloudFront origin to point to:"
echo "  $ALB_DNS"
echo ""
echo "  Test the API:"
echo "  curl http://$ALB_DNS/api/auth/health"
echo "========================================================"
