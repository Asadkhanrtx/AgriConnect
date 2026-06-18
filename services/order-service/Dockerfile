FROM node:20-alpine

WORKDIR /app

COPY shared/ ./shared/
COPY services/order-service/package*.json ./services/order-service/

WORKDIR /app/services/order-service
RUN npm install --omit=dev

COPY services/order-service/ ./

EXPOSE 3003
CMD ["node", "index.js"]
