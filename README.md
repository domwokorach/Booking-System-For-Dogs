# Dog Appointment Booking System

A secure appointment booking application built with **Node.js, NestJS, Prisma ORM, PostgreSQL, and Docker**.

Users can create an account, sign in, choose a service, select an available appointment date and time, confirm a booking, reschedule or cancel appointments, and receive email notifications.

For production, deploy the Vite frontend and NestJS backend as separate Vercel
projects using the checklist in [`VERCEL_DEPLOYMENT.md`](./VERCEL_DEPLOYMENT.md).

## Technology Stack

- Node.js
- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- Docker
- Docker Compose
- JWT Authentication
- Argon2 password hashing
- SMTP email notifications
- Optional AWS S3
- Optional Google Cloud Storage

## Architecture

```text
Frontend
   ↓
NestJS API
   ↓
Prisma ORM
   ↓
PostgreSQL
```

PostgreSQL is the system of record for customers, bookings, services,
payments, and reviews. Prisma is the database access layer used by NestJS; it
is not a database. The frontend never connects to PostgreSQL directly.

```text
NestJS ──→ Prisma ──→ PostgreSQL
   │
   ├─────→ Stripe (card processing)
   │
   └─────→ AWS S3 / Google Cloud Storage (uploaded files)
```

Only Stripe identifiers and payment state are stored in PostgreSQL. Card
numbers, CVCs, and other sensitive card details remain with Stripe.

Docker can run both the API and database:

```text
Docker Compose
├── NestJS API
└── PostgreSQL Database
```

## Main Features

### Authentication

- Register / Sign Up
- Sign In / Login
- Logout
- Forgot Password
- Reset Password
- JWT access and refresh tokens

### User Account

Users can:

- View profile
- Edit profile
- View bookings
- Change password
- Delete account

Stored user data includes:

- ID
- First name
- Surname
- Address
- Email
- Mobile number
- Password hash

### Appointment Booking

Users can:

- Choose a service
- Choose a date
- View available time slots
- Choose a time
- Confirm an appointment
- View bookings
- Reschedule a booking
- Cancel a booking

Booking statuses:

```text
PENDING
CONFIRMED
RESCHEDULED
CANCELLED
```

## Booking Flow

```text
User Login
    ↓
Choose Service
    ↓
Choose Date
    ↓
Load Available Slots
    ↓
Choose Time
    ↓
Confirm Appointment
    ↓
NestJS API
    ↓
Check Slot Availability
    ↓
Prisma
    ↓
PostgreSQL
    ↓
Booking Confirmed
    ↓
Send Confirmation Email
    ↓
Show Booking in My Account
```

The frontend must never write directly to PostgreSQL.

```text
Frontend JavaScript
        ↓
NestJS Controller
        ↓
Booking Service
        ↓
Prisma
        ↓
PostgreSQL
```

## Project Structure

```text
dog-booking/
├── .env
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── prisma.config.ts
├── README.md
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── prisma/
    ├── auth/
    ├── users/
    ├── services/
    ├── slots/
    ├── bookings/
    └── notifications/
```

## Environment Variables

Create a `.env` file in the project root.

> Never commit real passwords, API keys, app passwords, or cloud credentials to GitHub.

Example:

```env
NODE_ENV=development
PORT=3000

POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=booking_db
POSTGRES_USER=booking_user
POSTGRES_PASSWORD=CHANGE_ME

DATABASE_URL="postgresql://booking_user:CHANGE_ME@db:5432/booking_db?schema=public"

JWT_ACCESS_SECRET=GENERATE_A_LONG_RANDOM_SECRET
JWT_REFRESH_SECRET=GENERATE_ANOTHER_LONG_RANDOM_SECRET
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:3001

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=YOUR_APP_PASSWORD
EMAIL_FROM=your-email@example.com

AWS_REGION=eu-west-2
AWS_S3_BUCKET=dog-booking-uploads
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

GCP_PROJECT_ID=
GCP_BUCKET=dog-booking-uploads
GOOGLE_APPLICATION_CREDENTIALS=
```

If NestJS runs outside Docker, change the Prisma host from `db` to `localhost`.

## `.gitignore`

```gitignore
.env
.env.*
!.env.example
node_modules/
dist/
*.log
credentials/
secrets/
```

## Database Models

Main PostgreSQL records:

```text
User
Service
Appointment (the persisted booking)
Payment
Review
```

### User

```text
id
customerReference
firstName
surname
address
email
mobileNumber
passwordHash
createdAt
updatedAt
```

### Service

```text
id
name
description
durationMinutes
pricePence
active
```

### Appointment / Booking

```text
id
userId
serviceId
dateTime
durationMinutes
status
notes
confirmedAt
cancelledAt
createdAt
updatedAt
```

The API calls these records bookings, while the Prisma model is named
`Appointment`. This is one record rather than separate, duplicated booking and
appointment rows.

### Appointment slots

Available slots are derived from the configured business hours, service
duration, business timezone, and active appointments. Competing slot claims
are serialized in a PostgreSQL transaction and protected by a database overlap
constraint. This prevents a persisted `available` flag from becoming stale.

The slot API still returns the logical slot fields used by the frontend:

```text
id
serviceId
date
time
startAt
endAt
active
```

### Payment

```text
id
appointmentId
userId
serviceId
stripeCheckoutSessionId
stripePaymentIntentId
stripeInvoiceId
stripeRefundId
amountPence
currency
status
paidAt
refundRequestedAt
refundedAt
refundFailedAt
```

### Review

```text
id
customerId
appointmentId
rating
comment
createdAt
```

## API Routes

### Authentication

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### User Account

```http
GET    /api/users/me
PATCH  /api/users/me
DELETE /api/users/me
```

### Services

```http
GET /api/services
```

### Appointment Slots

```http
GET /api/slots
GET /api/slots?serviceId=SERVICE_ID&date=2026-08-10
```

### Bookings

```http
POST  /api/bookings/confirm
GET   /api/bookings/me
GET   /api/bookings/:id
PATCH /api/bookings/:id/reschedule
PATCH /api/bookings/:id/cancel
```

### Appointment deletion approval

```http
POST /api/appointments/:id/delete-request
POST /api/appointments/delete/confirm
```

The authenticated request endpoint emails the administrator a single-use
approval link. Only a SHA-256 token hash is stored in PostgreSQL, and the link
expires after 30 minutes. Paid and refund-related bookings cannot be
hard-deleted because their payment records must be retained; cancel them
through the approval/refund workflow instead.

### Appointment cancellation approval

```http
PATCH /api/appointments/:id/cancel
POST  /api/appointments/cancel/confirm
```

The authenticated cancellation endpoint changes the booking to
`CANCELLATION_PENDING` and emails the administrator a secure, single-use
approval link. The booking continues to reserve its slot. Approval changes the
booking to `CANCELLED` and submits any eligible refund through Stripe.

## Confirm Appointment

Frontend request:

```http
POST /api/bookings/confirm
```

Example body:

```json
{
  "serviceId": "service-uuid",
  "slotId": "slot-uuid"
}
```

Backend checks:

```text
1. Authenticate user
2. Verify service exists
3. Verify appointment slot exists
4. Verify slot is active
5. Verify slot belongs to selected service
6. Verify slot is not already booked
7. Create booking
8. Save booking in PostgreSQL
9. Send confirmation email
```

Example success response:

```json
{
  "success": true,
  "bookingId": "booking-uuid",
  "status": "CONFIRMED",
  "appointmentDate": "2026-08-10",
  "appointmentTime": "09:00",
  "message": "Appointment confirmed successfully"
}
```

If the slot is already booked:

```json
{
  "statusCode": 409,
  "message": "Sorry, this appointment has already been booked."
}
```

## Reschedule Appointment

```http
PATCH /api/bookings/:id/reschedule
```

Example request:

```json
{
  "slotId": "new-slot-uuid"
}
```

## Cancel Appointment

```http
PATCH /api/bookings/:id/cancel
```

The booking first becomes:

```text
CANCELLATION_PENDING
```

The appointment remains active and continues to reserve its slot until the
administrator approves the cancellation. After approval, it becomes
`CANCELLED`, the slot is released, and any eligible refund is submitted through
Stripe. Card refunds typically appear within approximately 5–10 business days,
depending on the customer's bank.

## Email Notifications

Send email notifications when:

- Booking is created
- Booking is confirmed
- Booking is rescheduled
- Booking is cancelled

## Navigation

Before login:

```text
Home
Services
Book Appointment
Sign In
Register
```

After login:

```text
Home
Services
Book Appointment
My Bookings
Account
Logout
```

## Account Page

```text
My Profile
My Bookings
Booking Calendar
Edit Profile
Change Password
Delete Account
Logout
```

## Docker

Start:

```bash
docker compose up --build
```

Start in background:

```bash
docker compose up -d --build
```

Stop:

```bash
docker compose down
```

View containers:

```bash
docker compose ps
```

View API logs:

```bash
docker compose logs -f api
```

## Prisma

Generate Prisma Client:

```bash
npx prisma generate
```

Create a development migration:

```bash
npx prisma migrate dev --name init
```

Apply production migrations:

```bash
npx prisma migrate deploy
```

Open Prisma Studio:

```bash
npx prisma studio
```

## Security

- Hash passwords with Argon2.
- Never store plain-text passwords.
- Never return password hashes in API responses.
- Protect private endpoints with JWT authentication.
- Validate all request data.
- Keep JWT secrets in environment variables.
- Require unique email addresses.
- Prevent users from editing another user's bookings.
- Prevent duplicate appointment bookings.
- Use HTTPS in production.
- Use secure password-reset tokens.
- Keep `.env` out of Git.
- Rotate any credential that has been exposed.
- Validate uploaded files before cloud storage.

## Cloud Storage

Store structured application data in PostgreSQL:

```text
Users
Authentication data
Services
Appointments
Bookings
Booking status
```

Use AWS S3 or Google Cloud Storage for:

```text
Profile photos
Images
PDF documents
Attachments
Uploaded files
```

## Development Workflow

```text
1. Docker + PostgreSQL
2. Prisma schema
3. NestJS Prisma module
4. User registration
5. Login / JWT
6. Services
7. Appointment slots
8. Confirm booking
9. My Bookings
10. Reschedule booking
11. Cancel booking
12. Email notifications
13. Forgot / Reset Password
14. Account management
15. Optional cloud storage
```

## Git

Before committing, verify that `.env` is ignored:

```bash
git check-ignore -v .env
git status
```

Then commit:

```bash
git add .
git status
git commit -m "Add appointment booking system"
git push
```

Do not continue if `.env` appears under files that will be committed.

## Recommended Stack

```text
Docker
   ↓
Node.js / NestJS
   ↓
Prisma
   ↓
PostgreSQL
```

This architecture provides a strong foundation for a secure and scalable appointment booking system.
