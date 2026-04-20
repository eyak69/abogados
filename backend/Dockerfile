FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Expone el puerto del backend
EXPOSE 4000

# Iniciamos usando nodemon para desarrollo a través del package.json o directo
CMD ["npx", "nodemon", "--exec", "ts-node", "src/server.ts"]
