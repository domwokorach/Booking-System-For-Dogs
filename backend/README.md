# Pawside backend

The backend is a NestJS HTTP and Socket.IO application backed by Prisma and
PostgreSQL. The browser never connects to PostgreSQL directly.

## Architecture

Every database-backed request follows the same path:

```text
Client / frontend
       |
       | HTTP request
       v
NestJS controller
       |
       v
Injectable NestJS service/provider
       |
       v
PrismaService / Prisma Client
       |
       | DATABASE_URL
       v
PostgreSQL (dog_booking)
       |
       v
Updated data returned to the frontend
```

Controllers define the public HTTP contract and handle request input. They
delegate application and authorization logic to injectable services. Services
use the injected `PrismaService` for CRUD operations and transactions; they do
not create their own database connections.

Appointment times are generated from the configured business timezone. Each
appointment stores a duration snapshot so later catalog edits do not change an
existing booking. Short, date-ordered advisory locks serialize competing slot
claims, while PostgreSQL's active-time exclusion constraint remains the final
guard against overlapping writes.

The main application modules live under `src/`:

- `auth/` handles registration, login, refresh tokens, logout, and password reset.
- `users/` handles profiles, passwords, and account-deletion requests.
- `bookings/` and `appointments/` handle booking lifecycle operations.
- `catalog/` and `slots/` expose services and available appointment times.
- `files/`, `storage/`, and `notifications/` handle uploads and email workflows.
- `realtime/` publishes authenticated appointment updates over Socket.IO.
- `prisma/` owns the injectable Prisma client and its application lifecycle.

Public API routes keep the `/api` paths used by the frontend. Health endpoints
remain outside that prefix:

```text
GET  /
GET  /health
POST /api/auth/register
POST /api/auth/login
POST /api/bookings/confirm
GET  /api/bookings/me
PATCH /api/bookings/:id/confirm
PATCH /api/bookings/:id/cancel
PATCH /api/bookings/:id/reschedule
GET  /api/bookings/:id/slots
GET  /api/appointments/mine
POST /api/appointments
PATCH /api/appointments/:id/confirm
PATCH /api/appointments/:id/cancel
PATCH /api/appointments/:id/reschedule
GET  /api/appointments/:id/slots
POST /api/users/me/delete-request
```

Socket.IO uses the same backend server and port. Clients authenticate with an
access token in `handshake.auth.token` and receive appointment events in their
user-specific room.

## Local development

Requirements:

- Node.js 22
- pnpm
- Docker with Docker Compose

From the repository root, install all workspace dependencies:

```bash
pnpm install
```

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

Use a long, private JWT secret in `backend/.env`. For a backend running on the
host, keep PostgreSQL at `localhost`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dog_booking?schema=public"
PORT=4000
CLIENT_ORIGIN="http://localhost:5173"
FRONTEND_URL="http://localhost:5173"
BUSINESS_TIME_ZONE="America/Los_Angeles"
JWT_SECRET="replace-with-at-least-32-random-characters"
```

Start PostgreSQL, apply development migrations, and start NestJS:

```bash
pnpm --dir backend run db:start
pnpm --dir backend run prisma:migrate
pnpm --dir backend run dev
```

The API is available at `http://localhost:4000`. Confirm it is ready with:

```bash
curl http://localhost:4000/health
```

The Vite frontend runs on `http://localhost:5173`. In development, `/api`
requests are proxied to port 4000, while Socket.IO connects directly to port
4000.

## Prisma commands

Run these from the repository root:

```bash
pnpm --dir backend run prisma:generate
pnpm --dir backend run prisma:migrate
pnpm --dir backend run prisma:studio
```

`DATABASE_URL` only identifies the PostgreSQL server and database. Booking and
account changes are persisted by Prisma calls such as `create`, `findMany`,
`update`, `delete`, and `$transaction` inside NestJS services.

## Run the complete backend with Docker

After creating `backend/.env`:

```bash
cd backend
docker compose up --build
```

Compose waits for PostgreSQL to pass its health check before starting the API.
The backend container uses the Compose hostname `postgres`, publishes port
4000, applies production migrations, and then starts NestJS. Do not use
`localhost` as the database hostname from inside the backend container.

Stop the containers without deleting database data:

```bash
docker compose down
```

The `db:reset` script removes the PostgreSQL volume and all local database data;
use it only when a full local reset is intended.

## Build and production startup

Verify the backend before deployment:

```bash
pnpm --dir backend run typecheck
pnpm --dir backend run build
```

Production startup consists of applying committed migrations and running the
compiled NestJS entry point:

```bash
pnpm --dir backend exec prisma migrate deploy --schema=prisma/schema.prisma
pnpm --dir backend run start
```

Docker and Render use the same sequence. The server listens on `0.0.0.0` and
the configured `PORT`, which remains 4000 locally but can be supplied by the
hosting platform.

`api/[...route].ts` is a cached NestJS adapter for HTTP-only serverless
deployments. Use a PostgreSQL transaction-pooler URL (or a conservative Prisma
`connection_limit`) there because every serverless isolate can own a database
connection pool.

For realtime appointment updates, send both HTTP and Socket.IO traffic to the
same long-running Docker or Render service:

```env
VITE_API_URL="https://your-backend.example.com"
VITE_SOCKET_URL="https://your-backend.example.com"
VITE_BUSINESS_TIME_ZONE="America/Los_Angeles"
```

Do not send HTTP mutations to the serverless function while Socket.IO clients
are connected to a different process; in-memory events cannot cross that
deployment boundary without a shared broker such as Redis.
