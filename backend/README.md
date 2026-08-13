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
- `reviews/` validates and publishes feedback from customers with completed appointments.
- `realtime/` publishes authenticated appointment updates over Socket.IO.
- `weather/` caches OpenWeather conditions, controls heat-related booking
  availability, and sends deduplicated unsafe/safe-again customer alerts.
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
POST /api/appointments/:id/delete-request
POST /api/appointments/delete/confirm
GET  /api/reviews
POST /api/reviews
GET  /api/weather
GET  /api/weather/refresh
POST /api/users/me/delete-request
```

Appointment deletion requests generate a random approval token and email the
administrator a frontend review link. PostgreSQL stores only the token hash;
approval is single-use and expires after 30 minutes. An appointment with a
pending, paid, or refund-related payment cannot be hard-deleted because its
financial record must be retained; use the cancellation/refund workflow.

`GET /api/reviews` is public. `POST /api/reviews` requires a valid customer
access token and accepts one review per owned appointment after its scheduled
duration has elapsed. Customer names and IDs are taken from the authenticated
database records, not from client-supplied identity fields.

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

Generate separate random access and refresh secrets (these are strings, not
numbers):

```bash
openssl rand -base64 48
openssl rand -base64 48
```

Copy the first output to `JWT_ACCESS_SECRET` and the second output to
`JWT_REFRESH_SECRET`. Never commit either value.

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dog_booking?schema=public"
PORT=3000
CLIENT_ORIGIN="http://localhost:5173"
FRONTEND_URL="http://localhost:5173"
BUSINESS_TIME_ZONE="Europe/London"
JWT_ACCESS_SECRET="paste-the-first-generated-value-here"
JWT_REFRESH_SECRET="paste-the-second-generated-value-here"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
```

Start PostgreSQL, apply development migrations, and start NestJS:

```bash
pnpm --dir backend run db:start
pnpm --dir backend run prisma:migrate
pnpm --dir backend run start:dev
```

In a second terminal, start Vite from the repository root with `pnpm run dev`.

The API is available at `http://localhost:3000`. Confirm it is ready with:

```bash
curl http://localhost:3000/health
```

The Vite frontend runs on `http://localhost:5173`. In development, `/api`
requests are proxied to port 3000, while Socket.IO connects directly to port
3000.

## Stripe Checkout

Checkout prices are loaded from the `Service.pricePence` column by NestJS. The
frontend never supplies an amount and never receives or stores card details.
Add Stripe test credentials to `backend/.env`:

```env
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_CURRENCY="gbp"
FRONTEND_URL="http://localhost:5173"
```

The optional Vite-side publishable key belongs in the repository root's
ignored `.env.local` file:

```env
VITE_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

Hosted Checkout redirects to the server-created Checkout Session URL and returns
successful payments to `/payment-success`, so Stripe.js and the publishable key
are not required for the payment flow. The
publishable key is configured for future client-side Stripe.js features only;
the secret key must remain in `backend/.env`.

In Stripe test mode, use test card data only. A basic successful Checkout test
uses card number `4242 4242 4242 4242`, any future expiry date, any three-digit
CVC, and any valid postcode. Never enter a real card while using test keys.

### Stripe receipts and paid invoices

Pawside supplies the registered customer email to Checkout and enables
`invoice_creation` for each one-time payment. The generated invoice carries the
Pawside appointment, payment, and user IDs as Stripe metadata. After a
signature-verified successful Checkout webhook, the backend stores the
Checkout Session's invoice ID in `Payment.stripeInvoiceId`.

Stripe email delivery also requires this one-time Dashboard configuration for
each mode used by the application (test and live settings are separate):

1. Open **Settings → Business → Customer emails** in Stripe.
2. Under **Email customers about**, enable **Successful payments**.
3. Enable refund emails as well if Stripe should notify customers about
   completed refunds.

With **Successful payments** enabled, Stripe emails the customer an invoice
summary after successful payment with links to the paid-invoice PDF and invoice
receipt. One-time Checkout invoice creation is priced separately by Stripe.

For local webhook delivery, run the Stripe CLI in a separate terminal and copy
the displayed `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET`. Include
both Checkout and refund lifecycle events:

```bash
stripe listen \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,payment_intent.succeeded,refund.created,refund.updated,refund.failed \
  --forward-to http://localhost:3000/api/payments/webhook
```

Run `stripe login` first if `stripe whoami --format json` reports
`"authenticated": false`. Copy the fresh `whsec_...` printed by each
`stripe listen` session into `backend/.env`, then restart NestJS. Use
`stripe trigger checkout.session.completed` only to verify delivery and
signature handling; that generated fixture is not linked to a Pawside booking.
To verify the database transition, complete a real Pawside test Checkout with
`4242 4242 4242 4242` while the listener is running.

An authenticated customer starts or resumes Checkout with
`POST /api/payments/checkout/:bookingId`. Stripe redirects back to the frontend,
and a signature-verified webhook is the primary path that changes the payment
to `PAID` and the appointment to `CONFIRMED`. As an immediate recovery path,
the authenticated success page also retrieves its server-created Checkout
Session from Stripe and performs the same idempotent database transition. The
confirmation email is sent only after that database transaction succeeds.

Cancelling an appointment first changes it to `CANCELLATION_PENDING`, creates a
single-use approval token, and emails an administrator approval link. The
appointment continues to reserve its time slot while approval is pending.
Approval changes the appointment to `CANCELLED` and, for a captured payment,
creates one full Stripe refund using the stored PaymentIntent and a stable
idempotency key. The payment changes to `REFUND_PENDING`; only then is the slot
released. Only a signature-verified `refund.created`, `refund.updated`, or
`refund.failed` webhook can move the payment to `REFUNDED` or `REFUND_FAILED`.
Customer emails are sent when cancellation is requested, when the refund is
submitted, and when Stripe confirms its final state. Stripe advises that card
refunds typically appear within approximately 5–10 business days, depending on
the customer's bank.

This schema keeps appointment and payment state in normalized tables. Inspect
the latest payment for each appointment with:

```sql
SELECT
  a.id,
  a.status,
  p.status AS "paymentStatus",
  p."stripeCheckoutSessionId",
  p."stripeRefundId",
  p."refundRequestedAt",
  p."refundedAt",
  p."refundFailedAt"
FROM "Appointment" AS a
LEFT JOIN LATERAL (
  SELECT
    status,
    "stripeCheckoutSessionId",
    "stripeRefundId",
    "refundRequestedAt",
    "refundedAt",
    "refundFailedAt"
  FROM "Payment"
  WHERE "appointmentId" = a.id
  ORDER BY "createdAt" DESC
  LIMIT 1
) AS p ON TRUE
ORDER BY a."createdAt" DESC;
```

Apply the committed payment migrations before testing:

```bash
pnpm --dir backend run prisma:migrate
```

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
3000, applies production migrations, and then starts NestJS. Do not use
`localhost` as the database hostname from inside the backend container.

### Develop with Compose Watch

Compose Watch requires Docker Compose 2.22.0 or later. Check your installed
version, then start the backend and PostgreSQL from the `backend` directory:

```bash
docker compose version
docker compose up --watch
```

Changes under `src/` are synchronized into the running backend container and
compiled by TypeScript watch mode; Node then restarts the compiled NestJS
application. Using the TypeScript compiler here preserves the emitted decorator
metadata required by NestJS constructor injection. Changes to `package.json`,
`prisma/`, `tsconfig.json`, or the Dockerfile rebuild and replace the backend
container because they affect dependencies, generated Prisma Client code,
migrations, compilation, or the image itself. The `node_modules/` directory is
never synchronized from the host.

Compose Watch needs `stat`, `mkdir`, and `rmdir` in the image and write access
to each synchronization target. The Node Alpine image supplies those commands,
and this development container can write to `/app/src`.

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

The Prisma CLI reads `DATABASE_URL`, the schema path, and the migrations path
from `backend/prisma.config.ts`.

Docker and Render use the same sequence. The server listens on `0.0.0.0` and
the configured `PORT`, which remains 3000 locally but can be supplied by the
hosting platform.

Vercel detects `src/main.ts` directly and deploys the NestJS application as one
Function. Use a PostgreSQL transaction-pooler URL because each scaled Function
instance can own database connections. See `../VERCEL_DEPLOYMENT.md` for the
two-project deployment checklist.

For realtime appointment updates, send both HTTP and Socket.IO traffic to the
same backend origin:

```env
VITE_API_URL="https://your-backend.example.com"
VITE_SOCKET_URL="https://your-backend.example.com"
VITE_BUSINESS_TIME_ZONE="Europe/London"
```

When Vercel scales the backend to multiple Function instances, in-memory events
cannot cross instance boundaries. Add a shared broker such as Redis before
depending on Socket.IO delivery across instances.
