# Booking System for Dogs

A modern booking experience for dog owners to explore services, choose a date and time, and manage appointments for grooming, training, daycare, and boarding.

## Overview

This repository contains a full-stack booking application with:

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

- Frontend: React, TypeScript, Vite
- UI: Tailwind-style shadcn/ui components
- Backend: Node.js, Express, TypeScript
- ORM: Prisma
- Database: PostgreSQL
- Containers: Docker Compose

## Project Structure

```text
.
├── src/                       # Frontend application
├── backend/                   # Express + Prisma API
│   ├── src/                   # Backend source files
│   ├── prisma/                # Prisma schema and migrations
│   ├── docker-compose.yml
│   └── .env.example
├── tests/                     # Project tests
├── guidelines/                # Project guidance and conventions
├── package.json               # Root frontend scripts and dependencies
├── pnpm-workspace.yaml        # Workspace configuration
├── pnpm-lock.yaml             # Lockfile for workspace dependencies
├── vite.config.ts            # Vite configuration
├── postcss.config.mjs        # PostCSS configuration
├── index.html                 # HTML entry point
└── README.md                  # Main project documentation
```

### Root-Level Files

- package.json: defines the frontend build and dev scripts.
- pnpm-workspace.yaml: wires the root app and backend into a single pnpm workspace.
- vite.config.ts: configures the Vite development server and build pipeline.
- backend/: contains the API, Prisma schema, Docker setup, and environment example.
- tests/: contains automated test coverage for booking-related logic.

## Prerequisites

- Node.js 20+
- pnpm
- Docker Desktop

## Getting Started

[View on GitHub](https://github.com/domwokorach/Booking-System-For-Dogs/tree/master#getting-started)

1. Install dependencies from the repository root:

```bash
pnpm install
```

1. Create the backend environment file:

```bash
cp backend/.env.example backend/.env
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

Default local URLs:

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:4000>

## Environment Variables

Update values in [backend/.env](backend/.env), including:

- DATABASE_URL
- JWT_SECRET
- CLIENT_ORIGIN
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASS
- EMAIL_FROM
- STORAGE_PROVIDER

## Scripts

### Root

- pnpm dev
- pnpm build

### Backend

- pnpm --dir backend run dev
- pnpm --dir backend run build
- pnpm --dir backend run prisma:migrate
- pnpm --dir backend run prisma:generate
- pnpm --dir backend run db:start
- pnpm --dir backend run db:stop

## Development Notes

- Keep [backend/.env](backend/.env) out of version control.
- Do not expose secrets or credentials in commits.
- If you add major features, update this README to keep the documentation current.

## Contributing

1. Create a feature branch.
2. Make focused commits with clear messages.
3. Open a pull request for review.

## License

Add your license details here.
