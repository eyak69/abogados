FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Vite server
CMD ["npm", "run", "dev", "--", "--host"]
