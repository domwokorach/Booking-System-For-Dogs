# Booking System for Dogs

Short description:

Describe what the booking system does, who uses it, and the main flow in 2 to 3 sentences.

## Table of Contents

- Overview
- Features
- Tech Stack
- Project Structure
- Prerequisites
- Environment Variables
- Quick Start
- Docker Setup
- Local Development
- Database and Prisma
- API Endpoints
- Scripts
- Testing
- Security Notes
- Contributing
- License

## Overview

This repository contains:

- A frontend app where users can browse services and book appointments.
- A backend API powered by NestJS + Prisma + PostgreSQL.
- Docker configuration for local API and database setup.

## Features

- User registration and login.
- Account profile management.
- Service listing.
- Booking creation, confirmation, rescheduling, and cancellation.
- Calendar with available dates and time slots.

## Tech Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + NestJS
- ORM: Prisma
- Database: PostgreSQL
- Containers: Docker + Docker Compose

## Project Structure

```text
.
├── src/                         # Frontend app
├── project/                     # NestJS backend app
│   ├── src/
│   ├── prisma/
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── .env.example
├── tests/
├── README.md
└── READEME.md                   # Quick-start variant
```

## Prerequisites

- Node.js 20+
- npm (or pnpm)
- Docker Desktop

## Environment Variables

Backend environment is located in [project/.env](project/.env).

To create it from template:

```bash
cd project
cp .env.example .env
```

Review and set values for:

- DATABASE_URL
- POSTGRES_HOST
- POSTGRES_PORT
- POSTGRES_DB
- POSTGRES_USER
- POSTGRES_PASSWORD
- JWT_ACCESS_SECRET
- JWT_REFRESH_SECRET
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASSWORD
- EMAIL_FROM

## Quick Start

1. Install root dependencies:

```bash
npm install
```

1. Start backend services:

```bash
cd project
docker compose up --build
```

1. Start frontend (new terminal at repository root):

```bash
npm run dev
```

## Docker Setup

From [project](project):

```bash
docker compose up --build
```

API default URL:

- <http://localhost:3000/api>

## Local Development

Frontend:

```bash
npm run dev
```

Backend:

```bash
cd project
npm install
npm run start:dev
```

## Database and Prisma

From [project](project):

```bash
npx prisma generate
npx prisma migrate deploy
```

For schema changes during development:

```bash
npx prisma migrate dev
```

## API Endpoints

Authentication:

- POST /api/auth/register
- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/signin
- POST /api/auth/logout
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

Users:

- GET /api/users/account
- PATCH /api/users/account
- GET /api/users/account/bookings
- PATCH /api/users/account/change-password
- DELETE /api/users/account

Services:

- GET /api/services
- POST /api/services

Bookings:

- POST /api/bookings
- GET /api/bookings/me
- GET /api/bookings/:id
- PATCH /api/bookings/:id/confirm
- PATCH /api/bookings/:id
- PATCH /api/bookings/:id/reschedule
- PATCH /api/bookings/:id/change-date
- PATCH /api/bookings/:id/change-time
- PATCH /api/bookings/:id/cancel

Calendar:

- GET /api/calendar/available-dates
- GET /api/calendar/available-times

## Scripts

Root scripts:

- npm run dev
- npm run build
- npm test

Backend scripts in [project](project):

- npm run start:dev
- npm run build
- npm run prisma:generate
- npm run prisma:migrate
- npm run prisma:deploy

## Testing

Run test suite from repository root:

```bash
npm test
```

## Security Notes

- Never commit [project/.env](project/.env).
- Never expose DB passwords, JWT secrets, SMTP passwords, or cloud secret keys.
- Rotate credentials immediately if exposed.

## Contributing

1. Create a feature branch.
2. Commit with clear messages.
3. Open a pull request.

## License

Add your license details here.
