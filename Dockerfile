# --- STAGE 1: Frontend Build ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# Pasamos variables de entorno necesarias para el build (si las hay)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- STAGE 2: Backend Build ---
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm install && npm install -g typescript@5.4.5
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# --- STAGE 3: Final Production Image ---
FROM node:20-alpine
WORKDIR /app

# Instalamos dependencias mínimas para ejecutar la app
RUN apk add --no-cache openssl

# Copiamos package.json y prisma ANTES de instalarlos para que el postinstall funcione
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma
WORKDIR /app/backend
RUN npm install --production && npm cache clean --force

# Copiamos archivos compilados
COPY --from=backend-builder /app/backend/dist ./dist
# Ya copiamos prisma arriba, pero nos aseguramos que esté en el lugar correcto si el builder generó algo extra
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=frontend-builder /app/frontend/dist ../frontend/dist

# Creamos directorios para persistencia (Regla 4)
RUN mkdir -p uploads logs

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=4000

# Exponemos el puerto del backend (que sirve el frontend)
EXPOSE 4000

# Comando de inicio: ejecuta migraciones y arranca el servidor
# Se usa sh para poder encadenar comandos
CMD npx prisma db push && npm start
