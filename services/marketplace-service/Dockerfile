FROM node:20-alpine

WORKDIR /app

COPY shared/ ./shared/
COPY services/marketplace-service/package*.json ./services/marketplace-service/

WORKDIR /app/services/marketplace-service
RUN npm ci --omit=dev

COPY services/marketplace-service/ ./

EXPOSE 3002
CMD ["node", "index.js"]
