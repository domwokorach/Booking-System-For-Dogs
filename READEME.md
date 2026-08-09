# Booking System for Dogs

Quick-start guide for the dog booking app. The frontend lets customers browse availability and manage appointments, while the backend exposes an Express API backed by Prisma and PostgreSQL.

## Overview

This repository contains:

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

## Project Structure

```text
.
├── backend/        # Express API, Prisma schema, Docker setup
├── src/            # Frontend application
├── tests/          # Frontend utility tests
├── README.md       # Full project documentation
└── READEME.md      # Quick-start guide
```

## Notes

- The Docker Compose file is in `backend/docker-compose.yml`, not `project/`.
- The backend listens on port `4000` by default.
- Do not commit `backend/.env`.
