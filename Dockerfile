# Imagen de producción de la API Kanban
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Primero dependencias (aprovecha la caché de capas de Docker)
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Luego el código
COPY src ./src
COPY public ./public

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
