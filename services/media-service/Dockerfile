FROM node:20-alpine

WORKDIR /app

COPY shared/ ./shared/
COPY services/media-service/package*.json ./services/media-service/

WORKDIR /app/services/media-service
RUN npm ci --omit=dev

COPY services/media-service/ ./

EXPOSE 3004
CMD ["node", "index.js"]
