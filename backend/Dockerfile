FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --ignore-scripts

COPY . .
RUN DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dog_booking" npm run prisma:generate
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
