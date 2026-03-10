FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./
COPY backend ./backend
COPY frontend ./frontend

RUN npm install
RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/backend/package.json ./backend/package.json

EXPOSE 3001

CMD ["npm", "-w", "backend", "start"]
