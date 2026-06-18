FROM node:20-alpine

WORKDIR /app

COPY shared/package*.json ./shared/
RUN cd shared && npm install --omit=dev

COPY shared/ ./shared/
COPY services/auth-service/package*.json ./services/auth-service/

WORKDIR /app/services/auth-service
RUN npm install --omit=dev

COPY services/auth-service/ ./

EXPOSE 3001
CMD ["node", "index.js"]
