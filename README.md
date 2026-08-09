# Appointment Booking System

A secure appointment booking API built with **Node.js, NestJS, Prisma ORM, PostgreSQL, and Docker**.

The system allows users to register, sign in, select a service, choose an available appointment date and time, confirm a booking, reschedule appointments, cancel bookings, and receive email notifications.

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
- Email notifications
- Optional AWS S3 or Google Cloud Storage for uploaded files

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

Docker runs the application services:

```text
Docker Compose
├── NestJS API
└── PostgreSQL Database
```

## Features

### Authentication

- Register / Sign Up
- Sign In / Login
- Logout
- Forgot Password
- Reset Password
- JWT authentication
- Secure password hashing

### User Account

Users can:

- View their profile
- Edit their personal information
- View their bookings
- Change their password
- Delete their account

User information stored in PostgreSQL includes:

- ID
- First name
- Surname
- Address
- Email address
- Mobile number
- Password hash

## Appointment Booking

Users can:

- Select a service
- Choose a date
- View available time slots
- Choose an available time
- Confirm an appointment
- View existing bookings
- Change the appointment date
- Change the appointment time
- Reschedule an appointment
- Cancel an appointment

### Booking Status

Bookings can have the following statuses:

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
Display Booking in My Account
```

PostgreSQL is responsible for preventing duplicate bookings.

The frontend must never write booking information directly to PostgreSQL.

The correct flow is:

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
appointment-booking/
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
    │
    ├── generated/
    │   └── prisma/
    │
    ├── prisma/
    │   ├── prisma.module.ts
    │   └── prisma.service.ts
    │
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── jwt-auth.guard.ts
    │   └── dto/
    │       ├── register.dto.ts
    │       └── login.dto.ts
    │
    ├── users/
    │   ├── users.module.ts
    │   ├── users.controller.ts
    │   └── users.service.ts
    │
    ├── services/
    │   ├── services.module.ts
    │   ├── services.controller.ts
    │   └── services.service.ts
    │
    ├── slots/
    │   ├── slots.module.ts
    │   ├── slots.controller.ts
    │   └── slots.service.ts
    │
    ├── bookings/
    │   ├── bookings.module.ts
    │   ├── bookings.controller.ts
    │   ├── bookings.service.ts
    │   └── dto/
    │
    └── notifications/
        ├── notifications.module.ts
        └── notifications.service.ts
```

## Environment Variables

Create a `.env` file in the root directory.

Example:

```env
# Application
NODE_ENV=development
PORT=3000

# PostgreSQL
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=booking_db
POSTGRES_USER=booking_user
POSTGRES_PASSWORD=change_this_password

# Prisma
DATABASE_URL="postgresql://booking_user:change_this_password@db:5432/booking_db?schema=public"

# JWT
JWT_ACCESS_SECRET=replace_with_a_long_random_secret
JWT_REFRESH_SECRET=replace_with_another_long_random_secret

JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend
FRONTEND_URL=http://localhost:3001

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASSWORD=your_email_password
EMAIL_FROM=appointments@example.com

# Optional AWS S3
AWS_REGION=eu-west-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=

# Optional Google Cloud Storage
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_BUCKET=
GOOGLE_APPLICATION_CREDENTIALS=
```

Never commit the real `.env` file to GitHub.

Add it to `.gitignore`:

```gitignore
.env
node_modules/
dist/
```

## Database Models

The main PostgreSQL tables are:

```text
User
Service
AppointmentSlot
Booking
BookingEvent
Notification
```

### User

```text
id
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
active
```

### Appointment Slot

```text
id
serviceId
startAt
endAt
active
```

### Booking

```text
id
userId
serviceId
slotId
appointmentDate
status
createdAt
updatedAt
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
```

Example:

```http
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

## Confirm Appointment

The frontend sends:

```http
POST /api/bookings/confirm
```

Example request:

```json
{
  "serviceId": "service-uuid",
  "slotId": "slot-uuid"
}
```

The backend performs the following checks:

```text
1. Authenticate user
2. Check that the service exists
3. Check that the appointment slot exists
4. Check that the slot is active
5. Check that the slot belongs to the selected service
6. Check that the slot has not already been booked
7. Create the booking
8. Save it in PostgreSQL
9. Send the confirmation email
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

If another customer has already booked the slot:

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

The API should:

```text
Check new slot
↓
Verify availability
↓
Release old slot
↓
Assign new slot
↓
Update appointment date/time
↓
Save changes
↓
Send rescheduling email
```

## Cancel Appointment

```http
PATCH /api/bookings/:id/cancel
```

The booking becomes:

```text
status = CANCELLED
```

The appointment slot is released so another customer can book it.

A cancellation email should then be sent to the customer.

## Email Notifications

Send emails when:

- A booking is created
- A booking is confirmed
- A booking is rescheduled
- A booking is cancelled

Example confirmation:

```text
Subject: Appointment Confirmed

Hello John,

Your appointment has been confirmed.

Service: Consultation
Date: 10 August 2026
Time: 09:00

Booking Reference: XXXXX

Thank you.
```

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

The account page should provide:

```text
My Profile
My Bookings
Booking Calendar
Edit Profile
Change Password
Delete Account
Logout
```

For each booking:

```text
Service: Consultation
Date: 10 August 2026
Time: 09:00
Status: CONFIRMED

[ Change Date / Time ]
[ Cancel Booking ]
```

## Docker

Start the application with:

```bash
docker compose up --build
```

Run in the background:

```bash
docker compose up -d --build
```

Stop the application:

```bash
docker compose down
```

View running containers:

```bash
docker compose ps
```

View API logs:

```bash
docker compose logs -f api
```

## Prisma

Generate the Prisma client:

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

The application should:

- Hash passwords using Argon2.
- Never store plain-text passwords.
- Never return password hashes in API responses.
- Protect private endpoints using JWT authentication.
- Validate all incoming request data.
- Store JWT secrets in environment variables.
- Use unique email addresses.
- Prevent users from editing another user's bookings.
- Prevent duplicate appointment bookings.
- Use HTTPS in production.
- Use secure password-reset tokens.
- Keep `.env` files out of Git.
- Validate uploaded files before sending them to cloud storage.

## Cloud Storage

Do not use AWS S3 or Google Cloud Storage as the main database.

Store structured information in PostgreSQL:

```text
User information
Authentication data
Services
Appointments
Bookings
Booking status
```

Use AWS S3 or Google Cloud Storage for files such as:

```text
Profile photos
Images
PDF documents
Attachments
Uploaded files
```

The database can store the cloud object key or file URL.

## Development Workflow

Recommended implementation order:

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
15. Optional cloud file storage
```

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

This architecture provides a strong foundation for a secure, scalable appointment booking system.
