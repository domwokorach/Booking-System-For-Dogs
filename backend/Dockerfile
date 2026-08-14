FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY backend/package.json ./backend/package.json
RUN pnpm install --no-frozen-lockfile --ignore-scripts --filter @booking-system/backend...

COPY backend ./backend
WORKDIR /app/backend
RUN DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dog_booking" pnpm run prisma:generate
RUN pnpm run build

EXPOSE 3000

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm run start"]
