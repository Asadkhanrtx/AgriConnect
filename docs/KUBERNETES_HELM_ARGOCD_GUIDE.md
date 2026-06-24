# AgriConnect — Kubernetes, Helm & ArgoCD Complete Guide

> Every manifest file explained field by field. How Helm reads values, how ArgoCD syncs, how
> all the pieces connect from a Git push to running pods.

---

## Table of Contents

1. [The Big Picture — Three Layers](#1-the-big-picture--three-layers)
2. [The Repo That Holds Everything — agriconnect-helm](#2-the-repo-that-holds-everything--agriconnect-helm)
3. [What is Helm and How it Works](#3-what-is-helm-and-how-it-works)
4. [The Chart File — Chart.yaml](#4-the-chart-file--chartyaml)
5. [The Values File — values.yaml (The Control Panel)](#5-the-values-file--valuesyaml-the-control-panel)
6. [How Go Templates Work in Helm](#6-how-go-templates-work-in-helm)
7. [Namespace — namespace.yaml](#7-namespace--namespaceyaml)
8. [ServiceAccount — serviceaccount.yaml (IRSA Link)](#8-serviceaccount--serviceaccountyaml-irsa-link)
9. [ConfigMap — configmap.yaml (Shared Env Vars)](#9-configmap--configmapyaml-shared-env-vars)
10. [Deployment — auth/deployment.yaml (The Core)](#10-deployment--authdeploymentyaml-the-core)
11. [Service — auth/service.yaml (Internal DNS)](#11-service--authserviceyaml-internal-dns)
12. [HPA — auth/hpa.yaml (Auto-Scaling)](#12-hpa--authhpayaml-auto-scaling)
13. [Ingress — ingress.yaml (The Front Door)](#13-ingress--ingressyaml-the-front-door)
14. [NetworkPolicy — networkpolicy.yaml (Firewall)](#14-networkpolicy--networkpolicyyaml-firewall)
15. [PodDisruptionBudget — pdb.yaml (Zero Downtime)](#15-poddisruptionbudget--pdbyaml-zero-downtime)
16. [How All Templates Wire Together — Full Request Flow](#16-how-all-templates-wire-together--full-request-flow)
17. [ArgoCD Application Manifest — application.yaml](#17-argocd-application-manifest--applicationyaml)
18. [ArgoCD Sync Cycle — What Happens Every 3 Minutes](#18-argocd-sync-cycle--what-happens-every-3-minutes)
19. [The Three-Repo GitOps Model](#19-the-three-repo-gitops-model)
20. [Complete End-to-End Flow: Code Push → Pod Running](#20-complete-end-to-end-flow-code-push--pod-running)
21. [Useful kubectl Commands for This Project](#21-useful-kubectl-commands-for-this-project)

---

## 1. The Big Picture — Three Layers

The deployment of AgriConnect involves three distinct layers, each with its own tool:

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1: INFRASTRUCTURE (Terraform — stage-infra repo)             │
│  Creates: VPC, EKS cluster, RDS, S3, ALB, WAF, IAM, ECR           │
│  Run by: GitHub Actions pipeline → manual approval → terraform apply │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ creates EKS cluster
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 2: APPLICATION PACKAGING (Helm — stage-helm repo)            │
│  Describes: What containers to run, how many, with what config      │
│  Stored as: Chart + templates + values.yaml in Git                  │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ watched by
                                  ↓
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 3: GITOPS DEPLOYMENT (ArgoCD — runs inside EKS)              │
│  Watches: agriconnect-helm repo (dev branch)                        │
│  Does: Syncs Helm chart to Kubernetes every 3 minutes               │
│  Result: Pods, Services, Ingress running in the cluster             │
└─────────────────────────────────────────────────────────────────────┘
```

You never run `kubectl apply` directly. ArgoCD does it automatically when the Helm chart changes.

---

## 2. The Repo That Holds Everything — agriconnect-helm

```
stage-helm/
├── argocd/
│   ├── application.yaml          ← ArgoCD watches dev branch → production namespace
│   └── application-prod.yaml     ← ArgoCD watches prod branch → prod namespace
├── helm/
│   └── agriconnect/
│       ├── Chart.yaml            ← Helm chart metadata
│       ├── values.yaml           ← ALL configurable values (images, ports, replicas)
│       ├── values-dev.yaml       ← Dev overrides (fewer replicas, lower resources)
│       ├── values-prod.yaml      ← Prod overrides (more replicas, higher resources)
│       └── templates/
│           ├── namespace.yaml
│           ├── serviceaccount.yaml
│           ├── configmap.yaml
│           ├── ingress.yaml
│           ├── networkpolicy.yaml
│           ├── pdb.yaml
│           ├── auth/
│           │   ├── deployment.yaml
│           │   ├── service.yaml
│           │   └── hpa.yaml
│           ├── marketplace/
│           │   ├── deployment.yaml
│           │   ├── service.yaml
│           │   └── hpa.yaml
│           ├── order/
│           │   ├── deployment.yaml, service.yaml, hpa.yaml
│           ├── media/
│           │   ├── deployment.yaml, service.yaml, hpa.yaml
│           └── notification/
│               ├── deployment.yaml, service.yaml, hpa.yaml
└── override-values.yaml
```

The `templates/` folder contains YAML files with placeholders (Go template syntax). Helm replaces placeholders with actual values from `values.yaml` when rendering the chart. The result is plain Kubernetes YAML that gets applied to the cluster.

---

## 3. What is Helm and How it Works

Helm is a **package manager for Kubernetes**. Instead of writing the same Deployment YAML five times (once per service), you write it once as a template with placeholders:

```yaml
# Without Helm — you need 5 files with hardcoded values:
image: 893431614084.dkr.ecr.ap-south-1.amazonaws.com/agriconnect-auth:b93b5a1
replicas: 2
port: 3001

# With Helm — one template handles all 5 services:
image: {{ .Values.services.auth.image }}:{{ .Values.services.auth.tag }}
replicas: {{ .Values.services.auth.replicas }}
port: {{ .Values.services.auth.port }}
```

**How Helm renders a chart:**

```
values.yaml         templates/auth/deployment.yaml
     │                           │
     │  .Values.services.auth    │  {{ .Values.services.auth.image }}
     └──────────────────────────►│
                                 ↓
              Helm renders final Kubernetes YAML:
              image: 893431614084.dkr.ecr.../agriconnect-auth:b93b5a1
                                 ↓
              kubectl apply (done by ArgoCD)
                                 ↓
              Pod running in EKS
```

**Key Helm concepts:**
- **Chart** — the package (Chart.yaml + templates/ + values.yaml)
- **Release** — one deployed instance of a chart (named `agriconnect`)
- **Values** — the configuration injected into templates
- **Template** — a YAML file with Go template placeholders

---

## 4. The Chart File — Chart.yaml

```yaml
# helm/agriconnect/Chart.yaml
apiVersion: v2
name: agriconnect
description: AgriConnect microservices — all 5 backend services
type: application
version: 0.1.0
appVersion: "1.0.0"
```

| Field | Purpose |
|---|---|
| `apiVersion: v2` | Helm 3 chart format (v2). Always v2 for Helm 3. |
| `name: agriconnect` | The chart name. Used in Helm commands: `helm upgrade agriconnect ./helm/agriconnect` |
| `description` | Human-readable description |
| `type: application` | Deploys actual workloads. Contrast with `library` charts that only define helpers. |
| `version: 0.1.0` | Chart version — version of the packaging, not the application |
| `appVersion: "1.0.0"` | Application version — informational only, the actual image tag comes from values.yaml |

---

## 5. The Values File — values.yaml (The Control Panel)

`values.yaml` is the single control panel for the entire deployment. Every configurable value lives here.

```yaml
# helm/agriconnect/values.yaml

global:
  namespace: production                    # All resources go into this namespace
  region: ap-south-1                       # AWS region passed to pods as env var
  dbSecretName: "agriconnect/dev/database" # Secret name pods use to fetch DB creds
  eventsTopicArn: "arn:aws:sns:ap-south-1:893431614084:AgriConnect-Events"
  notificationsQueueUrl: "https://sqs.ap-south-1.amazonaws.com/893431614084/..."
  irsaRoleArn: "arn:aws:iam::893431614084:role/agriconnect-dev-eks-services-role"
  ecrRegistry: "893431614084.dkr.ecr.ap-south-1.amazonaws.com"

services:
  auth:
    image: "893431614084.dkr.ecr.ap-south-1.amazonaws.com/agriconnect-auth"
    tag: b93b5a1         # ← CI pipeline updates THIS field after every build
    port: 3001
    replicas: 2

  marketplace:
    image: "893431614084.dkr.ecr.ap-south-1.amazonaws.com/agriconnect-marketplace"
    tag: b93b5a1
    port: 3002
    replicas: 2

  order:
    image: "...agriconnect-order"
    tag: b93b5a1
    port: 3003
    replicas: 2

  media:
    image: "...agriconnect-media"
    tag: b93b5a1
    port: 3004
    replicas: 2

  notification:
    image: "...agriconnect-notification"
    tag: b93b5a1
    port: 3005
    replicas: 2

resources:
  requests:
    cpu: 100m      # Scheduler guarantee: 100 millicores (0.1 vCPU)
    memory: 256Mi  # Scheduler guarantee: 256 Mebibytes
  limits:
    cpu: 500m      # Hard cap: 500 millicores — throttled if exceeded
    memory: 512Mi  # Hard cap: OOM-killed if exceeded

ingress:
  enabled: true
  subnets: "subnet-0040277cc421e9e2c,subnet-0fa1eda6281d6e7b7"  # Public subnets for ALB
  host: ""

networkPolicy:
  enabled: true
```

**`values-dev.yaml` — Dev environment overrides:**

```yaml
# Overrides only what differs in dev — everything else inherits from values.yaml
global:
  namespace: dev
  dbSecretName: "agriconnect/dev/database"

services:
  auth:
    replicas: 1      # ← dev runs 1 replica per service (saves cost)
  marketplace:
    replicas: 1
  order:
    replicas: 1
  media:
    replicas: 1
  notification:
    replicas: 1

resources:
  requests:
    cpu: 50m        # ← half the resources in dev
    memory: 128Mi
  limits:
    cpu: 250m
    memory: 256Mi
```

**How multiple values files work:**
When ArgoCD renders the prod chart, it merges `values.yaml` + `values-prod.yaml`. Keys in the overlay file take precedence. Keys not in the overlay file fall back to `values.yaml`. This is deep merge — `services.auth.tag` in values-prod.yaml overrides only the tag, not the image.

**The most critical field: `tag`**

Every time the CI pipeline successfully builds an image, it runs:
```bash
# CI pipeline — update-helm-values job
git clone https://github.com/AgriConnect-Platform/agriconnect-helm.git
# Update ALL service tags to the new git SHA
sed -i "s/tag: .*/tag: ${GITHUB_SHA::7}/" helm/agriconnect/values.yaml
git commit -m "ci: update image tags to ${GITHUB_SHA::7}"
git push origin dev
```

ArgoCD detects this commit → renders the chart → Kubernetes rolls out new pods. This is the entire deployment mechanism — updating one field in `values.yaml`.

---

## 6. How Go Templates Work in Helm

Helm templates use Go's `text/template` syntax. Understanding this is key to reading any template file.

### Basic substitution: `{{ .Values.path.to.value }}`

```yaml
# Template:
replicas: {{ .Values.services.auth.replicas }}

# values.yaml:
services:
  auth:
    replicas: 2

# Rendered output:
replicas: 2
```

The dot (`.`) is the current context. `.Values` is the entire values.yaml tree. You navigate it with dots.

### Quoting strings: `{{ .Values.x | quote }}`

```yaml
# Template:
AWS_REGION: {{ .Values.global.region | quote }}

# Renders to:
AWS_REGION: "ap-south-1"
```

The `| quote` pipe wraps the value in double quotes. Without it, a string like `ap-south-1` would render unquoted — valid YAML for simple strings, but required for strings with special characters.

### Conditionals: `{{- if .Values.x }}`

```yaml
# Template:
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
...
{{- end }}
```

The entire Ingress resource only appears if `ingress.enabled: true` in values.yaml. If you set `ingress.enabled: false`, Helm renders nothing — not even an empty file. The `{{-` (dash) strips leading whitespace/newlines for clean output.

### Nested optional check: `{{- if ((.Values.networkPolicy).enabled) }}`

```yaml
{{- if ((.Values.networkPolicy).enabled) }}
```

Double parentheses handle the case where `networkPolicy` itself might not exist in values.yaml. Without double parentheses, if `networkPolicy` is undefined, Helm would error with "nil pointer". The double wrap safely returns `nil` (falsy) instead of crashing.

### Template inheritance

All templates in `templates/` are processed by the same Helm context. They all share the same `.Values` tree. A value defined in `values.yaml` is accessible from any template file.

---

## 7. Namespace — namespace.yaml

```yaml
# templates/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: {{ .Values.global.namespace }}
```

**What a Namespace does:**

A Kubernetes Namespace is a virtual cluster boundary. Resources inside one namespace are isolated from resources in another. The AgriConnect app runs in the `production` namespace.

```
Cluster
├── kube-system        (ArgoCD, ALB controller, CoreDNS, metrics-server)
├── argocd             (ArgoCD itself)
├── production         (AgriConnect services ← your app lives here)
└── dev                (dev/staging environment)
```

**Why this is in Helm:**

When the chart is first deployed, the namespace must exist before any other resources can be created in it. ArgoCD's `syncOptions: CreateNamespace=true` actually handles creation automatically, but having the Namespace in the chart makes it explicit and ensures it appears in ArgoCD's UI.

**Rendered output:**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
```

---

## 8. ServiceAccount — serviceaccount.yaml (IRSA Link)

```yaml
# templates/serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: agriconnect-services
  namespace: {{ .Values.global.namespace }}
  annotations:
    eks.amazonaws.com/role-arn: {{ .Values.global.irsaRoleArn | quote }}
```

**Rendered output:**
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: agriconnect-services
  namespace: production
  annotations:
    eks.amazonaws.com/role-arn: "arn:aws:iam::893431614084:role/agriconnect-dev-eks-services-role"
```

**What a ServiceAccount is:**

Every pod in Kubernetes runs under a ServiceAccount — an identity within the cluster. By default, pods use the `default` ServiceAccount which has no AWS permissions. By creating a custom `agriconnect-services` ServiceAccount and annotating it with an IAM role ARN, pods using this ServiceAccount can make authenticated AWS API calls.

**How the IRSA annotation works:**

```
Pod starts with serviceAccountName: agriconnect-services
        ↓
EKS injects a short-lived JWT token at:
/var/run/secrets/eks.amazonaws.com/serviceaccount/token
        ↓
AWS SDK in the pod reads this token automatically
        ↓
SDK calls STS: AssumeRoleWithWebIdentity(
  WebIdentityToken: <the JWT>,
  RoleArn: "arn:aws:iam::893431614084:role/agriconnect-dev-eks-services-role"
)
        ↓
STS returns temporary credentials (AccessKeyId, SecretAccessKey, SessionToken)
Valid for 1 hour, auto-refreshed
        ↓
Pod makes AWS calls (Secrets Manager, S3, SQS, SNS) using these temp credentials
No static keys ever stored anywhere
```

The annotation `eks.amazonaws.com/role-arn` is read by the EKS OIDC webhook. Without this annotation, the JWT token is mounted but no role is assumed — the pod gets no AWS access.

**How Deployment uses it:**

```yaml
# deployment.yaml
spec:
  serviceAccountName: agriconnect-services   ← links to this ServiceAccount
```

Every pod from every Deployment uses this one ServiceAccount, which gives them all the same IAM role and permissions.

---

## 9. ConfigMap — configmap.yaml (Shared Env Vars)

```yaml
# templates/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agriconnect-config
  namespace: {{ .Values.global.namespace }}
data:
  NODE_ENV: "production"
  AWS_REGION: {{ .Values.global.region | quote }}
  DB_SECRET_NAME: {{ .Values.global.dbSecretName | quote }}
  EVENTS_TOPIC_ARN: {{ .Values.global.eventsTopicArn | quote }}
  NOTIFICATIONS_QUEUE_URL: {{ .Values.global.notificationsQueueUrl | quote }}
```

**Rendered output:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agriconnect-config
  namespace: production
data:
  NODE_ENV: "production"
  AWS_REGION: "ap-south-1"
  DB_SECRET_NAME: "agriconnect/dev/database"
  EVENTS_TOPIC_ARN: "arn:aws:sns:ap-south-1:893431614084:AgriConnect-Events"
  NOTIFICATIONS_QUEUE_URL: "https://sqs.ap-south-1.amazonaws.com/893431614084/..."
```

**What a ConfigMap is:**

A ConfigMap stores non-secret configuration as key-value pairs. It is NOT encrypted — never put passwords here. It's for environment variables that are not sensitive: region, feature flags, service URLs, topic ARNs.

**How Deployment uses it:**

```yaml
# deployment.yaml
envFrom:
  - configMapRef:
      name: agriconnect-config
```

`envFrom` loads ALL keys from the ConfigMap as environment variables in the pod:
- `process.env.NODE_ENV` → `"production"`
- `process.env.AWS_REGION` → `"ap-south-1"`
- `process.env.DB_SECRET_NAME` → `"agriconnect/dev/database"`
- `process.env.EVENTS_TOPIC_ARN` → `"arn:aws:sns:..."`
- `process.env.NOTIFICATIONS_QUEUE_URL` → `"https://sqs..."`

The Node.js code reads these at startup:
```javascript
const region = process.env.AWS_REGION;              // "ap-south-1"
const secretName = process.env.DB_SECRET_NAME;      // "agriconnect/dev/database"
```

**Why ConfigMap instead of hardcoding:**

If you hardcode `process.env.AWS_REGION || 'ap-south-1'` in the code, changing the region requires rebuilding and redeploying the Docker image. With ConfigMap, you change `values.yaml`, push to git, and ArgoCD updates the ConfigMap. The pods restart with the new value. No image rebuild needed.

---

## 10. Deployment — auth/deployment.yaml (The Core)

The Deployment is the most important Kubernetes resource. It tells Kubernetes: "Run N copies of this container, always keep them running, and replace them if they crash."

```yaml
# templates/auth/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  labels:
    app: auth-service
spec:
  replicas: {{ .Values.services.auth.replicas }}    # How many pod copies to run
  selector:
    matchLabels:
      app: auth-service                             # This Deployment manages pods with this label
  template:
    metadata:
      labels:
        app: auth-service                           # Label applied to every pod this creates
    spec:
      serviceAccountName: agriconnect-services      # IRSA: gives pods AWS IAM access
      containers:
        - name: auth-service
          image: {{ .Values.services.auth.image }}:{{ .Values.services.auth.tag }}
          imagePullPolicy: Always                   # Always pull from ECR, never use cached
          ports:
            - containerPort: 3001                   # Port the Node.js app listens on
              protocol: TCP
          envFrom:
            - configMapRef:
                name: agriconnect-config            # Load all ConfigMap keys as env vars
          env:
            - name: PORT
              value: "3001"                         # Override PORT specifically (not from ConfigMap)
          resources:
            requests:
              cpu: {{ .Values.resources.requests.cpu }}      # 100m
              memory: {{ .Values.resources.requests.memory }} # 256Mi
            limits:
              cpu: {{ .Values.resources.limits.cpu }}         # 500m
              memory: {{ .Values.resources.limits.memory }}   # 512Mi
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3001
            initialDelaySeconds: 30     # Wait 30s before first check (startup time)
            periodSeconds: 15           # Check every 15 seconds
            failureThreshold: 3         # Fail 3 times before restarting pod
          readinessProbe:
            httpGet:
              path: /ready
              port: 3001
            initialDelaySeconds: 15     # Wait 15s before checking readiness
            periodSeconds: 10
            failureThreshold: 3
      terminationGracePeriodSeconds: 30  # Pod gets 30s to finish in-flight requests before kill
```

**Rendered output (with values substituted):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  labels:
    app: auth-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      serviceAccountName: agriconnect-services
      containers:
        - name: auth-service
          image: 893431614084.dkr.ecr.ap-south-1.amazonaws.com/agriconnect-auth:b93b5a1
          imagePullPolicy: Always
          ports:
            - containerPort: 3001
          envFrom:
            - configMapRef:
                name: agriconnect-config
          env:
            - name: PORT
              value: "3001"
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 15
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 3001
            initialDelaySeconds: 15
            periodSeconds: 10
            failureThreshold: 3
      terminationGracePeriodSeconds: 30
```

### Field-by-Field Explanation

**`apiVersion: apps/v1`** — Deployments are in the `apps` API group. `v1` is stable.

**`kind: Deployment`** — Tells Kubernetes this is a Deployment (as opposed to a StatefulSet, DaemonSet, etc.).

**`spec.replicas: 2`** — Kubernetes ensures exactly 2 pods are always running. If one crashes, a replacement starts immediately. If the node dies, both pods reschedule on surviving nodes.

**`selector.matchLabels`** — The Deployment controller finds its pods using this label selector. This is how the Deployment "owns" pods — pods with `app: auth-service` belong to this Deployment.

**`template.metadata.labels`** — Every pod created by this Deployment gets these labels. Must match `selector.matchLabels`.

**`spec.serviceAccountName: agriconnect-services`** — Attaches the IRSA-annotated ServiceAccount to every pod. Without this, pods have no AWS credentials.

**`image: ECR_URL:TAG`** — The container image. The tag (`b93b5a1`) is the git SHA of the code — traceable directly back to a commit. Change the tag → rolling update starts automatically.

**`imagePullPolicy: Always`** — EKS always pulls the image from ECR before starting the container. Without this, Kubernetes might reuse a cached image even if the tag was re-pushed. Always ensures you get what's in ECR.

**`envFrom.configMapRef`** — Loads ALL keys from `agriconnect-config` ConfigMap as environment variables. The pod gets `NODE_ENV`, `AWS_REGION`, `DB_SECRET_NAME`, etc. without any of them being hardcoded in the image.

**`env.PORT`** — Individual env var, overrides or supplements what comes from ConfigMap. PORT is service-specific (auth is 3001, marketplace is 3002) so it's set directly, not via ConfigMap.

**`resources.requests`** — The GUARANTEED allocation. Kubernetes scheduler places the pod on a node that has at least 100m CPU and 256Mi memory free. Requests are the scheduling currency.

**`resources.limits`** — The HARD CAP. If the pod uses more than 500m CPU, it gets throttled (slowed). If it uses more than 512Mi memory, it gets OOM-killed and restarted.

**`livenessProbe`** — Is the pod alive? Kubernetes calls `GET http://pod-ip:3001/healthz` every 15 seconds. If it fails 3 times in a row, the pod is killed and restarted. This catches deadlocks where the Node.js process is running but not responding.

**`readinessProbe`** — Is the pod ready for traffic? Kubernetes calls `GET http://pod-ip:3001/ready` every 10 seconds. While this fails, the pod is removed from the Service's endpoints (no traffic routed to it). During rolling updates, new pods receive traffic only after `/ready` returns 200.

**`initialDelaySeconds`** — Grace period after container starts before first probe. Auth service needs ~15-30 seconds to connect to RDS and load secrets. Without this delay, Kubernetes would kill the pod for a failing healthcheck before it even finishes booting.

**`terminationGracePeriodSeconds: 30`** — When Kubernetes needs to stop a pod (rolling update, scale down, node drain), it sends SIGTERM to the process. The Node.js app has 30 seconds to finish in-flight HTTP requests before Kubernetes sends SIGKILL (force kill). 30 seconds is enough for any reasonable API request to complete.

### Rolling Update Behavior

When the image tag changes, Kubernetes performs a **rolling update**:

```
Before update:  [pod-a (old)] [pod-b (old)]
                        ↓
Kubernetes creates new pod:
                [pod-a (old)] [pod-b (old)] [pod-c (new, starting)]
                        ↓
pod-c passes readinessProbe (/ready returns 200)
                        ↓
Kubernetes terminates pod-a (SIGTERM → 30s grace → SIGKILL):
                [pod-b (old)] [pod-c (new)]
                        ↓
Kubernetes creates pod-d (new):
                [pod-b (old)] [pod-c (new)] [pod-d (new, starting)]
                        ↓
pod-d passes readinessProbe
                        ↓
Kubernetes terminates pod-b:
                [pod-c (new)] [pod-d (new)]
```

At no point does traffic go to zero. The PDB (`minAvailable: 1`) enforces this.

---

## 11. Service — auth/service.yaml (Internal DNS)

```yaml
# templates/auth/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  labels:
    app: auth-service
spec:
  type: ClusterIP
  selector:
    app: auth-service     # Routes to pods with this label
  ports:
    - port: 3001          # Port that OTHER pods use to reach this service
      targetPort: 3001    # Port on the pod container
      protocol: TCP
```

**What a Service does:**

Pods have dynamic IP addresses — they change every time a pod restarts. If `marketplace-service` had to call `auth-service` by pod IP, the connection would break every time auth-service was redeployed.

A Service provides a **stable virtual IP** (ClusterIP) that never changes, plus a **stable DNS name** that resolves to that IP. Other pods call `auth-service:3001` and Kubernetes routes it to a healthy pod.

```
Pod calls: http://auth-service:3001/api/auth/verify-token
                    ↓
Kubernetes DNS (CoreDNS) resolves "auth-service" → 10.100.45.23 (stable ClusterIP)
                    ↓
kube-proxy routes to a healthy pod: 10.0.11.45:3001 or 10.0.12.67:3001
(load balances across all ready pods)
```

**`type: ClusterIP`** — The default Service type. The virtual IP is only reachable from within the cluster. External traffic cannot reach it directly. External traffic comes in through the ALB Ingress → ALB → Service.

**`selector: app: auth-service`** — The Service routes traffic to any pod with the label `app: auth-service`. When the Deployment creates pods (they all get this label from `template.metadata.labels`), the Service automatically discovers them and starts routing to them.

**`port: 3001` vs `targetPort: 3001`** — `port` is what callers use. `targetPort` is the actual port on the pod. They can differ (e.g., you might expose port 80 but the container listens on 3001). Here they're the same.

**Internal DNS naming:**

The full DNS name of the auth-service is `auth-service.production.svc.cluster.local`. But within the same namespace, pods can use the short name `auth-service`. Across namespaces, they must use `auth-service.production.svc.cluster.local`.

**How the Ingress uses Services:**

The ALB Ingress Controller reads the Ingress resource, sees `/api/auth → service: auth-service, port: 3001`, and registers `auth-service`'s pods as ALB targets. Traffic flow:

```
ALB → auth-service (Service, ClusterIP) → auth-service pod(s)
```

---

## 12. HPA — auth/hpa.yaml (Auto-Scaling)

```yaml
# templates/auth/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: auth-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service           # This HPA controls the auth-service Deployment
  minReplicas: {{ .Values.services.auth.replicas }}   # 2 from values.yaml
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70   # Scale up if avg CPU > 70% across all pods
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80   # Scale up if avg memory > 80%
```

**How the HPA works:**

The `metrics-server` (installed in kube-system) collects CPU and memory metrics from every pod every 15 seconds. The HPA controller reads these metrics and computes the desired replica count:

```
desired replicas = ceil(current replicas × (current avg CPU / target CPU))

Example:
  current replicas = 2
  current avg CPU = 140m (140% of the 100m request)
  target utilization = 70% → target CPU = 70m
  
  desired = ceil(2 × (140/70)) = ceil(4) = 4 replicas
  
  → HPA scales Deployment to 4 replicas
```

**Why `minReplicas` comes from values.yaml:**

`minReplicas: {{ .Values.services.auth.replicas }}` means the HPA minimum matches whatever `replicas` is set in values.yaml. In production (values.yaml): `replicas: 2` → HPA minimum is 2. In dev (values-dev.yaml): `replicas: 1` → HPA minimum is 1. One values.yaml change controls both.

**Dual metric scaling:**

Both CPU (70%) and memory (80%) can independently trigger scaling. Whichever metric requires MORE replicas wins. This matters because:
- `auth-service` (JWT generation) is CPU-intensive
- `media-service` (image buffering) is memory-intensive

The HPA responds to whichever resource is the bottleneck for that specific service.

**`apiVersion: autoscaling/v2`** — The v2 API is stable since Kubernetes 1.23 and supports multiple metrics. The old v1 only supported CPU. Always use v2 for new deployments.

**Scale-down delay:**

Kubernetes waits 5 minutes after scale-up before considering scale-down. This prevents thrashing — if traffic spikes for 30 seconds and then drops, the HPA doesn't scale down immediately only to scale back up 2 minutes later.

---

## 13. Ingress — ingress.yaml (The Front Door)

```yaml
# templates/ingress.yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: agriconnect-ingress
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing          # ALB faces the internet
    alb.ingress.kubernetes.io/target-type: ip                  # Route to pod IPs (not node IPs)
    alb.ingress.kubernetes.io/subnets: {{ .Values.ingress.subnets }}  # Public subnets
    alb.ingress.kubernetes.io/healthcheck-path: /healthz
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: "30"
    alb.ingress.kubernetes.io/healthy-threshold-count: "2"
    alb.ingress.kubernetes.io/unhealthy-threshold-count: "3"
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}]'   # ALB listens on port 80
spec:
  ingressClassName: alb
  rules:
    - http:
        paths:
          - path: /api/auth
            pathType: Prefix
            backend:
              service:
                name: auth-service
                port:
                  number: {{ .Values.services.auth.port }}        # 3001

          - path: /api/marketplace
            pathType: Prefix
            backend:
              service:
                name: marketplace-service
                port:
                  number: {{ .Values.services.marketplace.port }} # 3002

          - path: /api/orders
            pathType: Prefix
            backend:
              service:
                name: order-service
                port:
                  number: {{ .Values.services.order.port }}       # 3003

          - path: /api/media
            pathType: Prefix
            backend:
              service:
                name: media-service
                port:
                  number: {{ .Values.services.media.port }}       # 3004

          - path: /api/notifications
            pathType: Prefix
            backend:
              service:
                name: notification-service
                port:
                  number: {{ .Values.services.notification.port }} # 3005
{{- end }}
```

**What an Ingress does:**

An Ingress is a set of routing rules. It says: "based on the URL path, route traffic to different backend services." The AWS Load Balancer Controller reads this Ingress resource and creates/configures a real AWS Application Load Balancer to implement these rules.

**Ingress Controller vs Ingress resource:**

```
Ingress resource (this YAML) = the routing rules you declare
ALB Ingress Controller (AWS LB Controller, runs in kube-system) = reads the rules, creates/configures real AWS ALB
```

Without the ALB Ingress Controller running in the cluster, this Ingress resource does nothing. The controller was installed during bootstrap.

**Annotation deep dive:**

| Annotation | Effect |
|---|---|
| `scheme: internet-facing` | ALB gets a public IP. Alternative: `internal` for private-only ALB |
| `target-type: ip` | ALB routes directly to pod IPs. Alternative: `instance` routes to EC2 node ports then to pods. `ip` is faster and requires fewer network hops |
| `subnets: subnet-xxx,subnet-yyy` | ALB is created spanning these two public subnets (different AZs for HA) |
| `healthcheck-path: /healthz` | ALB sends health checks to `/healthz` on each pod. Pods failing this check are removed from ALB target group |
| `healthcheck-interval-seconds: "30"` | ALB checks pod health every 30 seconds |
| `healthy-threshold-count: "2"` | Pod must pass health check 2 times to be considered healthy |
| `unhealthy-threshold-count: "3"` | Pod must fail health check 3 times to be removed from rotation |
| `listen-ports: '[{"HTTP": 80}]'` | ALB listens on port 80 (HTTP). CloudFront terminates HTTPS and sends HTTP to ALB |

**`pathType: Prefix`** — Any URL path that STARTS WITH the prefix matches. `/api/auth/login` matches `/api/auth`. `/api/marketplace/listings/123` matches `/api/marketplace`.

**The full path from browser to pod:**

```
Browser: POST https://agrimarket.com/api/media/upload/produce
         ↓
CloudFront: receives HTTPS, terminates TLS, forwards to ALB as HTTP
         ↓
ALB: receives HTTP GET /api/media/upload/produce
     Checks routing rules:
     /api/auth?        NO
     /api/marketplace? NO
     /api/orders?      NO
     /api/media?       YES → route to media-service:3004
         ↓
media-service Service (ClusterIP): receives request
         ↓
Pod: 10.0.11.45:3004 (the actual running container)
         ↓
Node.js Express: handles POST /api/media/upload/produce
```

---

## 14. NetworkPolicy — networkpolicy.yaml (Firewall)

```yaml
# templates/networkpolicy.yaml
{{- if ((.Values.networkPolicy).enabled) }}

# Policy 1: Deny ALL ingress by default
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: {{ .Values.global.namespace }}
spec:
  podSelector: {}        # {} = matches ALL pods in the namespace
  policyTypes:
    - Ingress
  # No ingress: rules → ALL incoming traffic to ALL pods is BLOCKED

---
# Policy 2: Allow pods in the same namespace to call each other
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-same-namespace
  namespace: {{ .Values.global.namespace }}
spec:
  podSelector: {}        # Applies to all pods
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector: {}  # {} = any pod in the same namespace

---
# Policy 3: Allow traffic from kube-system (ALB controller + CoreDNS health checks)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-kube-system
  namespace: {{ .Values.global.namespace }}
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system

---
# Policy 4: Allow all outbound traffic
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-all-egress
  namespace: {{ .Values.global.namespace }}
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - {}   # {} = allow all egress destinations and ports

{{- end }}
```

**How NetworkPolicy works:**

By default in Kubernetes, ALL pods can connect to ALL other pods — even across namespaces. NetworkPolicy is an opt-in firewall. Once a NetworkPolicy selects a pod, ONLY traffic explicitly allowed by NetworkPolicy rules can reach it.

**The four policies work together as layers:**

```
Policy 1 (default-deny-ingress):  Block everything incoming
        +
Policy 2 (allow-same-namespace):  Unblock: pods in same namespace can call each other
        +
Policy 3 (allow-from-kube-system): Unblock: kube-system pods can call production pods
        +
Policy 4 (allow-all-egress):      Allow everything outgoing

Net result:
  - production pods can call each other ✅
  - kube-system (ALB controller, CoreDNS) can call production pods ✅
  - argocd namespace CANNOT call production pods ✅
  - production pods can call AWS APIs (Secrets Manager, S3, etc.) ✅
  - internet cannot directly reach production pods ✅
```

**`podSelector: {}`** — An empty selector matches ALL pods in the namespace. This is different from `podSelector: null` (which would match no pods).

**Why Policy 3 is needed:**

The AWS ALB Ingress Controller runs in `kube-system`. When it creates the ALB, it registers pods as targets. The ALB itself sends health check requests directly to pod IPs. Without Policy 3, these health checks would be blocked — the ALB would think all pods are unhealthy and refuse all traffic.

**Why Policy 4 (allow-all-egress) is needed:**

Pods must make OUTBOUND connections to:
- AWS Secrets Manager: `https://secretsmanager.ap-south-1.amazonaws.com` (port 443)
- AWS SQS: `https://sqs.ap-south-1.amazonaws.com` (port 443)
- AWS SNS: `https://sns.ap-south-1.amazonaws.com` (port 443)
- AWS S3: `https://s3.ap-south-1.amazonaws.com` (port 443)
- RDS: `10.0.11.x:3306` (port 3306, private subnet)

If egress was restricted, every AWS SDK call would fail silently. Allowing all egress keeps configuration simple while the important security is on INGRESS (who can reach your pods).

**The `{{- if ((.Values.networkPolicy).enabled) }}` guard:**

```yaml
networkPolicy:
  enabled: true    # Change to false to disable all NetworkPolicies (useful for debugging)
```

Setting `enabled: false` removes all four NetworkPolicies from the cluster. ArgoCD detects the change (prune mode) and deletes the NetworkPolicy objects. Pods immediately become reachable from anywhere. Useful for testing connectivity issues.

---

## 15. PodDisruptionBudget — pdb.yaml (Zero Downtime)

```yaml
# templates/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: auth-service-pdb
spec:
  minAvailable: 1         # At MINIMUM 1 pod must be running at all times
  selector:
    matchLabels:
      app: auth-service   # Applies to pods with this label (auth-service pods)
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: marketplace-service-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: marketplace-service
# ... same for order, media, notification
```

**What a PodDisruptionBudget does:**

A PDB is a CONTRACT with Kubernetes operations. It says: "When you voluntarily disrupt pods (draining a node, rolling update, Cluster Autoscaler removing a node), you MUST ensure at least 1 pod of this service remains available."

**`minAvailable: 1`** — With 2 replicas, Kubernetes can voluntarily terminate at most 1 pod at a time. The other must be running.

**What counts as a "voluntary disruption":**
- `kubectl drain node` (node maintenance)
- Rolling update triggered by image tag change
- Cluster Autoscaler terminating an underutilized node
- ArgoCD sync that changes pod configuration

**What a PDB does NOT protect against:**
- Node hardware failure (involuntary disruption)
- OOM kill (process exceeds memory limit)
- Liveness probe failure leading to restart

**Without a PDB:**
```
Cluster Autoscaler wants to remove node-2 (underutilized)
  node-2 has: auth-pod-a, marketplace-pod-a
  Cluster Autoscaler drains node-2 — evicts BOTH pods simultaneously
  auth-service = 0 running pods for 30-60 seconds while new pods start on node-1
  → users see 502 Bad Gateway errors
```

**With PDB (`minAvailable: 1`):**
```
Cluster Autoscaler wants to remove node-2
  node-2 has: auth-pod-a, marketplace-pod-a
  Cluster Autoscaler checks PDB: "can I evict auth-pod-a?" 
  PDB says: minAvailable=1, currently running=2, after eviction=1 → OK
  Cluster Autoscaler evicts auth-pod-a (pod moves to node-1)
  auth-pod-b still running → no service interruption
  After auth-pod-a is running on node-1, CA proceeds with marketplace-pod-a
  → zero downtime throughout
```

---

## 16. How All Templates Wire Together — Full Request Flow

Here is how every Kubernetes resource connects to every other for a single API call:

```
Browser
  │
  │  POST https://agrimarket.com/api/auth/login
  │
  ↓
CloudFront (CDN + WAF)
  │
  │  Strips TLS, forwards HTTP to ALB
  │
  ↓
AWS Application Load Balancer
  │
  │  ALB was created by ALB Ingress Controller reading the Ingress resource
  │  ALB checks: path /api/auth/* → backend: auth-service:3001
  │
  ↓
Service (auth-service, ClusterIP)
  │
  │  kube-proxy routes to one of the auth-service pods
  │  Load balances across all pods with label app: auth-service
  │
  ↓
Pod (auth-service, one of 2 replicas)
  │
  │  Pod runs with:
  │    serviceAccountName: agriconnect-services (IRSA → AWS credentials)
  │    envFrom: configmap agriconnect-config (NODE_ENV, AWS_REGION, etc.)
  │    resources: requests 100m/256Mi, limits 500m/512Mi
  │    NetworkPolicy: allows this traffic (from kube-system ALB controller)
  │
  ↓
Node.js Express app
  │  /api/auth/login handler runs
  │  Calls getSecret('agriconnect/dev/database') → Secrets Manager (via IRSA)
  │  Connects to RDS (in private subnet, allowed by security group)
  │  Returns JWT token
  │
  ↓
Response travels back up the same path
```

**The label system is the glue:**

Everything in Kubernetes is connected by labels:
- Deployment creates pods with `app: auth-service`
- Service selects pods with `app: auth-service`  
- HPA targets Deployment `auth-service`
- PDB selects pods with `app: auth-service`
- NetworkPolicy selects all pods in namespace (empty selector)

Change the label in the Deployment and the Service would stop routing to those pods (they wouldn't match the selector anymore). Labels must be consistent.

---

## 17. ArgoCD Application Manifest — application.yaml

```yaml
# argocd/application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: agriconnect         # Name of this ArgoCD Application (shows in ArgoCD UI)
  namespace: argocd         # This resource lives in the argocd namespace
spec:
  project: default          # ArgoCD project (access control grouping)

  source:
    repoURL: https://github.com/agriconnect-platform/agriconnect-helm.git
    targetRevision: dev     # Watch the dev branch
    path: helm/agriconnect  # Helm chart is at this path in the repo
    helm:
      valueFiles:
        - values.yaml       # Which values file to use when rendering

  destination:
    server: https://kubernetes.default.svc   # Deploy to this cluster (same cluster ArgoCD runs in)
    namespace: production                     # Deploy to this namespace

  syncPolicy:
    automated:
      prune: true      # Delete resources that are in the cluster but NOT in Git
      selfHeal: true   # Revert manual cluster changes back to what Git says
    syncOptions:
      - CreateNamespace=true    # Create the namespace if it doesn't exist
      - ServerSideApply=true    # Use server-side apply (handles large resources better)
```

**`kind: Application`** — This is an ArgoCD Custom Resource Definition (CRD). ArgoCD installs this CRD when it's installed in the cluster. Without ArgoCD, Kubernetes would not understand `kind: Application`.

**`targetRevision: dev`** — ArgoCD watches the `dev` branch. Every commit to `dev` is a potential sync trigger. It doesn't matter what other branches exist — ArgoCD only cares about `dev`.

**`path: helm/agriconnect`** — Within the repo, the Helm chart is at this subdirectory. ArgoCD runs Helm to render this chart using the specified values file.

**`destination.server: https://kubernetes.default.svc`** — This means "the same cluster ArgoCD is running in." ArgoCD can manage multiple clusters — for this project, it only manages itself (the dev EKS cluster).

**`automated.prune: true`** — If you delete a Service from the Helm chart and push to Git, ArgoCD will delete the corresponding Service from the cluster. Without prune, deleted resources would remain as orphans forever, wasting resources and potentially causing confusion.

**`automated.selfHeal: true`** — If someone runs `kubectl scale deployment auth-service --replicas=1` directly, ArgoCD detects the drift (cluster has 1, Git says 2) and automatically scales back to 2. This enforces "Git is the source of truth." Manual cluster changes are automatically reverted.

**`CreateNamespace=true`** — ArgoCD creates the `production` namespace if it doesn't exist, before applying any resources. Without this, applying a resource to a non-existent namespace would fail.

**`ServerSideApply=true`** — Uses Kubernetes server-side apply instead of client-side apply. This handles merge conflicts better when multiple controllers (ArgoCD, Helm, HPA) all manage parts of the same resource.

**The production ArgoCD Application:**

```yaml
# argocd/application-prod.yaml
spec:
  source:
    targetRevision: prod      # Watch the prod branch instead
    helm:
      valueFiles:
        - values-prod.yaml    # Use prod values (more replicas, higher resources)
  destination:
    namespace: prod           # Deploy to prod namespace instead of production
```

This is identical to `application.yaml` but watches `prod` branch and uses `values-prod.yaml`. The CI prod pipeline writes new image tags to the `prod` branch → ArgoCD picks it up → deploys to `prod` namespace.

---

## 18. ArgoCD Sync Cycle — What Happens Every 3 Minutes

ArgoCD runs a continuous reconciliation loop:

```
Every 3 minutes:
│
├── 1. FETCH: ArgoCD pulls the agriconnect-helm repo (dev branch)
│           git fetch https://github.com/.../agriconnect-helm.git dev
│
├── 2. RENDER: ArgoCD runs Helm to render all templates
│           helm template agriconnect ./helm/agriconnect \
│             --namespace production \
│             -f values.yaml
│           → Produces: 17+ YAML documents (Deployments, Services, etc.)
│
├── 3. COMPARE: ArgoCD compares rendered YAML with what's in Kubernetes
│           "Desired state" (from Git) vs "Actual state" (from kubectl get)
│
│           Changed?    → Schedule sync
│           Unchanged?  → Nothing to do, sleep until next cycle
│
└── 4. SYNC (if changed):
            ArgoCD applies each resource:
            kubectl apply -f namespace.yaml
            kubectl apply -f serviceaccount.yaml
            kubectl apply -f configmap.yaml
            kubectl apply -f ingress.yaml
            kubectl apply -f auth/deployment.yaml  ← if tag changed, rolling update starts
            kubectl apply -f auth/service.yaml
            kubectl apply -f auth/hpa.yaml
            ... (all 17+ resources)
            
            If prune is enabled: delete any resource that exists in cluster but not in Git
```

**What "Synced" means in the ArgoCD UI:**

| Status | Meaning |
|---|---|
| `Synced` | Cluster state exactly matches Git state |
| `OutOfSync` | Something differs (new commit in Git, or manual cluster change) |
| `Syncing` | ArgoCD is applying changes right now |
| `Degraded` | A resource is unhealthy (pod crash, failed deploy) |
| `Progressing` | Resources are being created/updated |

**How a deploy looks from ArgoCD's perspective:**

```
t=0:00  CI pipeline pushes to dev branch: values.yaml tag changed to abc1234
t=0:03  ArgoCD poll cycle: detects new commit
t=0:03  ArgoCD renders Helm chart with new values
t=0:03  Compare: auth/deployment.yaml image tag differs (old: b93b5a1, new: abc1234)
t=0:04  ArgoCD applies new Deployment → Kubernetes starts rolling update
t=0:04  New pod (abc1234 image) starts pulling from ECR
t=0:35  New pod passes readinessProbe (/ready returns 200)
t=0:35  Old pod receives SIGTERM → 30s grace period → terminates
t=0:65  Repeat for second pod
t=1:35  Rolling update complete — both pods running abc1234
t=1:35  ArgoCD status: Synced
```

Total time from git push to both pods updated: ~2-3 minutes.

---

## 19. The Three-Repo GitOps Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│  agriconnect-app (stage-app)                                            │
│  ├── Source code: Node.js services, React frontend                      │
│  ├── Dockerfiles: builds container images                               │
│  └── .github/workflows/: CI pipeline                                    │
│                                                                          │
│  When dev branch changes → CI pipeline:                                 │
│  1. Scan (SonarCloud, Snyk, Trivy)                                      │
│  2. Build Docker images                                                  │
│  3. Push to ECR (tagged with git SHA)                                   │
│  4. Update values.yaml in agriconnect-helm (tag: b93b5a1 → abc1234)    │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ pushes new image tag
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  agriconnect-helm (stage-helm)                                          │
│  ├── Helm chart: templates + values.yaml                                │
│  ├── ArgoCD Applications: application.yaml, application-prod.yaml       │
│  └── The ONLY source of truth for what runs in Kubernetes               │
│                                                                          │
│  dev branch  → ArgoCD watches → deploys to production namespace         │
│  prod branch → ArgoCD watches → deploys to prod namespace               │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ ArgoCD syncs
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  agriconnect-infra (stage-infra)                                        │
│  ├── Terraform: VPC, EKS, RDS, S3, ECR, CloudFront, WAF                │
│  ├── Lambda: FarmBot, BuyerBot, weather-alert-processor                 │
│  └── .github/workflows/: Terraform plan+apply pipeline                  │
│                                                                          │
│  Provides: EKS cluster (where K8s runs) + ECR (where images go)        │
└─────────────────────────────────────────────────────────────────────────┘
```

**Why three repos?**

| Concern | Repo | Access |
|---|---|---|
| Application code | agriconnect-app | All developers |
| Kubernetes config | agriconnect-helm | DevOps / senior devs |
| Infrastructure | agriconnect-infra | DevOps only |

Separating these means:
- A frontend developer can push to `agriconnect-app` without ever touching Terraform
- Infrastructure changes (new VPC, EKS upgrade) don't happen when someone fixes a bug
- The Helm repo is the single source of truth for "what is running in production" — one place to look

---

## 20. Complete End-to-End Flow: Code Push → Pod Running

```
Developer pushes a bug fix to dev branch in agriconnect-app
│
├── GitHub Actions starts main.yml
│   ├── sast: SonarCloud scans source code for vulnerabilities
│   ├── snyk: Checks npm packages for known CVEs
│   ├── lint: ESLint checks code quality (--max-warnings 0)
│   └── (all above must pass before builds start)
│
├── 5 parallel CI jobs (ci-auth, ci-marketplace, ci-order, ci-media, ci-notification)
│   Each job:
│   ├── Build Docker image (multistage, non-root user)
│   ├── Trivy scan (CRITICAL CVEs → pipeline fails, image NOT pushed)
│   ├── Smoke test (run container, hit /healthz, must respond)
│   └── Push to ECR (tag = git SHA, e.g. abc1234)
│
├── update-helm-values job (waits for ALL 5 builds)
│   ├── Clone agriconnect-helm repo (dev branch)
│   ├── Update values.yaml: change all service tags to abc1234
│   └── git commit + push to agriconnect-helm dev branch
│
└── CD: ArgoCD (running in EKS, checks every 3 minutes)
    ├── Detects new commit in agriconnect-helm dev branch
    ├── Renders Helm chart (helm template with values.yaml)
    ├── Compares rendered YAML with live cluster state
    ├── Difference: 5 Deployments have new image tags
    ├── Applies all 5 Deployments (kubectl apply)
    └── Kubernetes performs rolling update for each service:
        ├── Start new pod (new image, pulls from ECR)
        ├── Wait for readinessProbe (/ready returns 200)
        ├── Remove old pod from Service (stops receiving traffic)
        ├── Graceful termination (30s, finishes in-flight requests)
        └── Start next pod
    
    Result: All 5 services running new code, zero downtime
```

**Total time from `git push` to pods updated:** approximately 8-12 minutes
- Security scans: ~2 min
- 5 parallel Docker builds: ~3 min
- ECR push + helm update: ~1 min
- ArgoCD poll (up to 3 min): ~3 min
- Rolling update: ~2 min

---

## 21. Useful kubectl Commands for This Project

```bash
# Get ArgoCD admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

# Watch all pods in production namespace
kubectl get pods -n production -w

# See the rendered Helm values ArgoCD is using
kubectl get application agriconnect -n argocd -o yaml

# Check if HPA is scaling
kubectl get hpa -n production

# See what resources a pod has
kubectl describe pod <pod-name> -n production

# Get logs from auth-service (last 100 lines)
kubectl logs -l app=auth-service -n production --tail=100

# Check NetworkPolicy
kubectl get networkpolicies -n production

# Check the ConfigMap values
kubectl get configmap agriconnect-config -n production -o yaml

# Force ArgoCD to sync immediately (without waiting 3 minutes)
kubectl -n argocd exec deployment/argocd-server -- argocd app sync agriconnect

# Check which image tag is running
kubectl get pods -n production -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].image}{"\n"}{end}'

# Scale a deployment manually (ArgoCD will revert this — for temporary testing only)
kubectl scale deployment auth-service --replicas=3 -n production

# See events (helpful for debugging pod failures)
kubectl get events -n production --sort-by='.lastTimestamp'

# Describe the Ingress (see ALB DNS)
kubectl describe ingress agriconnect-ingress -n production

# Check IRSA is working (should see AWS credentials in the token)
kubectl exec -it <pod-name> -n production -- \
  cat /var/run/secrets/eks.amazonaws.com/serviceaccount/token | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool
```

---

*All YAML in this guide is from the actual `stage-helm/helm/agriconnect/` directory.*
*The project uses: EKS 1.29, Helm 3, ArgoCD 2.x, Kubernetes networking.k8s.io/v1 (stable), autoscaling/v2 (stable).*
