# Vercel deployment

Deploy this repository as two Vercel projects connected to the same GitHub
repository:

| Vercel project | Root directory | Framework |
| --- | --- | --- |
| Pawside frontend | `.` | Vite |
| Pawside backend | `backend` | NestJS |

The frontend lives at the repository root; it does not need to be moved into a
new `frontend/` directory. Vercel reads the root `vercel.json` for Vite SPA
fallback routing. The backend uses Vercel's zero-configuration NestJS detection
from `backend/src/main.ts`.

## 1. Create production PostgreSQL

Create a managed PostgreSQL database. When using Render Postgres with a backend
hosted on Vercel, copy Render's **External Database URL** into the Vercel
backend project's `DATABASE_URL`. Render's internal URL is only reachable from
Render services on its private network. Never use a `localhost` database URL
in Vercel, and never expose the database URL to the frontend.

The backend's Vercel build runs both Prisma Client generation and the committed
production migrations before compiling NestJS:

```bash
pnpm --dir backend run vercel-build
```

The backend's `prisma.config.ts` reads `DATABASE_URL` for migration commands.
`prisma generate` creates Prisma Client; `prisma migrate deploy` creates or
updates the PostgreSQL tables from `backend/prisma/migrations/`.

## 2. Deploy the backend

Import the GitHub repository into Vercel and set its Root Directory to
`backend`. Vercel detects `src/main.ts` and deploys the NestJS application as a
Function.

Configure these backend environment variables for Production (and suitable
Preview values if preview deployments should connect to external services):

```env
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require

FRONTEND_URL=https://YOUR-FRONTEND.vercel.app
# Optional explicit CORS origin; defaults to FRONTEND_URL.
CLIENT_ORIGIN=https://YOUR-FRONTEND.vercel.app
BUSINESS_TIME_ZONE=Europe/London

JWT_ACCESS_SECRET=GENERATE_A_LONG_RANDOM_SECRET
JWT_REFRESH_SECRET=GENERATE_A_DIFFERENT_LONG_RANDOM_SECRET
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

RESEND_API_KEY=re_...
EMAIL_FROM=Pawside <appointments@yourdomain.com>
BOOKING_EMAIL_TO=your-admin@example.com

STRIPE_SECRET_KEY=sk_live_or_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=gbp
```

Also configure the storage variables required by the selected `STORAGE_PROVIDER`.
Do not upload or commit a real `.env` file.

After deployment, verify:

```text
https://YOUR-BACKEND.vercel.app/health
```

## 3. Deploy the frontend

Import the same GitHub repository a second time. Keep the Root Directory as
`.` and select Vite.

Configure these build-time environment variables:

```env
VITE_API_URL=https://YOUR-BACKEND.vercel.app
VITE_SOCKET_URL=https://YOUR-BACKEND.vercel.app
VITE_BUSINESS_TIME_ZONE=Europe/London
```

The frontend already reads `VITE_API_URL`; no production API URL is hard-coded.
After the final frontend URL is known, set it as `FRONTEND_URL` on the backend,
then redeploy. `CLIENT_ORIGIN` can be omitted because it defaults to
`FRONTEND_URL`, or set explicitly to the same origin.

## 4. Configure Stripe

Create a production webhook endpoint in Stripe:

```text
https://YOUR-BACKEND.vercel.app/api/payments/webhook
```

Subscribe it to:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
payment_intent.succeeded
refund.created
refund.updated
refund.failed
```

Copy that endpoint's signing secret into the backend project's
`STRIPE_WEBHOOK_SECRET`, then redeploy. Test the full Checkout and refund flows
against the deployed webhook before changing from Stripe test keys to live keys.

## 5. Realtime behavior

Socket.IO clients use `VITE_SOCKET_URL` and reconnect automatically. Vercel
WebSocket connections are tied to one Function instance for their lifetime and
are still subject to Function duration limits. If the backend scales across
instances, add a shared Redis-compatible Socket.IO adapter so appointment
events can reach clients connected to other instances.
