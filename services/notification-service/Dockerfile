FROM node:20-alpine

WORKDIR /app

COPY shared/package*.json ./shared/
RUN cd shared && npm install --omit=dev

COPY shared/ ./shared/
COPY services/notification-service/package*.json ./services/notification-service/

WORKDIR /app/services/notification-service
RUN npm install --omit=dev

COPY services/notification-service/ ./

EXPOSE 3005
CMD ["node", "index.js"]
