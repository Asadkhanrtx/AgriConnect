{{/*
Common deployment template
Usage: {{ include "agriconnect.deployment" (dict "name" "auth" "svc" .Values.services.auth "Values" .Values) }}
*/}}
{{- define "agriconnect.deployment" -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .name }}-service
  labels:
    app: {{ .name }}-service
spec:
  replicas: {{ .svc.replicas }}
  selector:
    matchLabels:
      app: {{ .name }}-service
  template:
    metadata:
      labels:
        app: {{ .name }}-service
    spec:
      serviceAccountName: agriconnect-services
      containers:
        - name: {{ .name }}-service
          image: {{ .svc.image }}:{{ .svc.tag }}
          imagePullPolicy: Always
          ports:
            - containerPort: {{ .svc.port }}
          env:
            - name: PORT
              value: {{ .svc.port | quote }}
            - name: AWS_REGION
              value: {{ .Values.global.region }}
            - name: DB_SECRET_NAME
              value: {{ .Values.global.dbSecretName }}
            - name: EVENTS_TOPIC_ARN
              value: {{ .Values.global.eventsTopicArn }}
            - name: NOTIFICATIONS_QUEUE_URL
              value: {{ .Values.global.notificationsQueueUrl }}
          resources:
            requests:
              cpu: {{ .Values.resources.requests.cpu }}
              memory: {{ .Values.resources.requests.memory }}
            limits:
              cpu: {{ .Values.resources.limits.cpu }}
              memory: {{ .Values.resources.limits.memory }}
          livenessProbe:
            httpGet:
              path: /health
              port: {{ .svc.port }}
            initialDelaySeconds: 30
            periodSeconds: 15
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health
              port: {{ .svc.port }}
            initialDelaySeconds: 15
            periodSeconds: 10
            failureThreshold: 3
      terminationGracePeriodSeconds: 30
{{- end }}

{{/*
Common service template
*/}}
{{- define "agriconnect.service" -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ .name }}-service
  labels:
    app: {{ .name }}-service
spec:
  type: ClusterIP
  selector:
    app: {{ .name }}-service
  ports:
    - port: {{ .port }}
      targetPort: {{ .port }}
      protocol: TCP
{{- end }}
