# Booking System for Dogs

<<<<<<< HEAD
Quick-start guide for the dog booking app. The frontend lets customers browse availability and manage appointments, while the backend exposes an Express API backed by Prisma and PostgreSQL.
=======
A modern booking experience for dog owners to explore services, choose a date and time, and manage appointments for grooming, training, daycare, and boarding.
>>>>>>> 0255165 (Commit)

## Overview

This repository contains a full-stack booking app with:

<<<<<<< HEAD
- A Vite + React frontend in `src/`
- An Express + Prisma backend in `backend/`
- Docker configuration for PostgreSQL and the backend API

For the fuller project documentation, see `README.md`.

## Features

- User sign-up and login
- Appointment booking and status tracking
- Appointment rescheduling and cancellation
- File upload support through cloud storage providers
- Realtime connection setup with Socket.IO

## Tech Stack

- Frontend: React, Vite
- Styling: Tailwind CSS, shadcn/ui
- Backend: Node.js, Express, TypeScript
- ORM: Prisma
- Database: PostgreSQL
- Containers: Docker Compose

## Prerequisites

- Node.js 20 or newer
- npm
- Docker Desktop

## Quick Start

Install frontend dependencies from the repository root:

```bash
npm install
```

Create the backend environment file:

```bash
cd backend
cp .env.example .env
```

Start PostgreSQL and the backend with Docker:

```bash
cd backend
docker compose up --build
```

In a separate terminal, start the frontend from the repository root:

```bash
npm run dev
```

Default local URLs:

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:4000>
- Health check: <http://localhost:4000/health>

## Local Development

Run the backend without Docker after PostgreSQL is available:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

## Environment Variables

Backend environment variables live in `backend/.env`.

Important values:

- `DATABASE_URL`
- `PORT`
- `CLIENT_ORIGIN`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `STORAGE_PROVIDER`

Optional cloud storage settings:

- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `GCP_PROJECT_ID`
- `GCP_BUCKET`
- `GCP_KEY_FILE`

## Scripts

Repository root:

- `npm run dev` - start the frontend dev server
- `npm run build` - build the frontend

Backend:

- `npm run dev` - start the backend in watch mode
- `npm run build` - compile the backend
- `npm run start` - run the compiled backend
- `npm run prisma:generate` - generate the Prisma client
- `npm run prisma:migrate` - apply development migrations
- `npm run db:start` - start PostgreSQL with Docker Compose
- `npm run db:stop` - stop Docker Compose services
=======
- A React + Vite frontend for the customer experience
- An Express + Prisma backend for appointment and user management
- PostgreSQL and Docker support for local development

## Features

- Browse dog care services such as grooming, training, daycare, and boarding
- Select a date and time for an appointment
- Create, update, reschedule, and cancel bookings
- Manage appointment status and booking feedback in the UI
- Send booking-related emails through the backend service layer

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind-style UI components
- Backend: Express, TypeScript, Prisma, PostgreSQL
- Authentication: JWT-based auth flow
- Storage: S3 or GCS-compatible object storage support
- Local services: Docker Compose
>>>>>>> 0255165 (Commit)

## Project Structure

```text
.
<<<<<<< HEAD
├── backend/        # Express API, Prisma schema, Docker setup
├── src/            # Frontend application
├── tests/          # Frontend utility tests
├── README.md       # Full project documentation
└── READEME.md      # Quick-start guide
=======
├── src/                  # Frontend application
├── backend/              # Express + Prisma API
│   ├── src/              # Backend source files
│   ├── prisma/           # Prisma schema and migrations
│   ├── docker-compose.yml
│   └── .env.example
├── tests/                # Project tests
└── README.md
>>>>>>> 0255165 (Commit)
```

## Notes

<<<<<<< HEAD
- The Docker Compose file is in `backend/docker-compose.yml`, not `project/`.
- The backend listens on port `4000` by default.
- Do not commit `backend/.env`.

=======
- Node.js 20+
- pnpm
- Docker Desktop

## Environment Setup

Create the backend environment file from the example:

```bash
cp backend/.env.example backend/.env
```

Update the values in [backend/.env](backend/.env) for:

- DATABASE_URL
- JWT_SECRET
- CLIENT_ORIGIN
- SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / EMAIL_FROM
- Storage credentials if you plan to use cloud uploads

## Quick Start

1. Install dependencies from the repository root:

```bash
pnpm install
```

1. Start PostgreSQL with Docker:

```bash
pnpm --dir backend run db:start
```

1. Run Prisma migrations:

```bash
pnpm --dir backend run prisma:migrate
```

1. Start the backend API:

```bash
pnpm --dir backend run dev
```

1. Start the frontend in a second terminal:

```bash
pnpm dev
```

The frontend should be available at <http://localhost:5173> and the API at <http://localhost:4000>.

## Backend Commands

Useful commands from the backend workspace:

```bash
pnpm --dir backend run dev
pnpm --dir backend run build
pnpm --dir backend run prisma:migrate
pnpm --dir backend run prisma:studio
pnpm --dir backend run db:start
pnpm --dir backend run db:stop
```

## Database and Prisma

To generate the Prisma client after schema changes:

```bash
pnpm --dir backend run prisma:generate
```

To apply migrations during development:

```bash
pnpm --dir backend run prisma:migrate
```

## Notes

- Keep [backend/.env](backend/.env) out of version control.
- Do not expose secrets, database credentials, or API keys in commits or screenshots.
- If you add significant features, document them here so the README stays current.

## Contributing

1. Create a feature branch.
2. Make focused commits with clear messages.
3. Open a pull request for review.
>>>>>>> 0255165 (Commit)
