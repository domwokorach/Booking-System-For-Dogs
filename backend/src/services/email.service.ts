import { env } from "../config/env.js";

const resendApiKey = env.RESEND_API_KEY?.trim();
const SERVICE_LABELS: Record<string, string> = {
  grooming: "Grooming",
  training: "Training",
  daycare: "Daycare",
  boarding: "Boarding",
};

async function sendMailSafely(mail: { from: string; to: string; subject: string; text: string }) {
  if (!resendApiKey) {
    console.warn("RESEND_API_KEY is not configured. Skipping email send.");
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mail.from,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Resend API error ${response.status}: ${errorData}`);
    }
  } catch (error) {
    console.error("Email delivery failed.", error);
  }
}

type BookingEmailData = {
  to: string;
  firstName: string;
  appointmentDateTime: Date;
  status: string;
  bookingId?: string;
  service?: string | null;
};

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(value);
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
  }).format(value);
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
  }).format(value);
}

function formatService(service: string | null | undefined): string {
  if (!service) {
    return "Not specified";
  }

  return SERVICE_LABELS[service] ?? service;
}

export function resolveBookingRecipient(defaultRecipient: string): string {
  return env.BOOKING_EMAIL_TO.trim() || defaultRecipient;
}

export async function sendBookingConfirmationEmail(data: BookingEmailData) {
  await sendMailSafely({
    from: env.EMAIL_FROM,
    to: resolveBookingRecipient(data.to),
    subject: "Booking confirmed",
    text: `Hi ${data.firstName},\n\nYour appointment has been confirmed.\n\nBooking ID: ${data.bookingId ?? "Not available"}\nSelected service: ${formatService(data.service)}\nAppointment date: ${formatDate(data.appointmentDateTime)}\nAppointment time: ${formatTime(data.appointmentDateTime)}\nBooking status: ${data.status}\n\nWe look forward to seeing you.`,
  });
}

export async function sendBookingUpdateEmail(data: BookingEmailData) {
  await sendMailSafely({
    from: env.EMAIL_FROM,
    to: data.to,
    subject: "Booking updated",
    text: `Hi ${data.firstName}, your booking was updated to ${formatDateTime(data.appointmentDateTime)}. Status: ${data.status}.`,
  });
}

export async function sendBookingCancellationEmail(data: BookingEmailData) {
  await sendMailSafely({
    from: env.EMAIL_FROM,
    to: resolveBookingRecipient(data.to),
    subject: "Booking cancelled",
    text: `Hi ${data.firstName},\n\nYour booking has been cancelled.\n\nBooking ID: ${data.bookingId ?? "Not available"}\nSelected service: ${formatService(data.service)}\nAppointment date: ${formatDate(data.appointmentDateTime)}\nAppointment time: ${formatTime(data.appointmentDateTime)}\nBooking status: ${data.status}.`,
  });
}

export async function sendDeletionRequestEmail(data: BookingEmailData) {
  await sendMailSafely({
    from: env.EMAIL_FROM,
    to: resolveBookingRecipient(data.to),
    subject: "Deletion approval requested",
    text: `Hi ${data.firstName},\n\nA deletion request has been submitted for this booking and needs approval before the appointment can be removed.\n\nBooking ID: ${data.bookingId ?? "Not available"}\nSelected service: ${formatService(data.service)}\nAppointment date: ${formatDate(data.appointmentDateTime)}\nAppointment time: ${formatTime(data.appointmentDateTime)}\nBooking status: ${data.status}.\n\nPlease review and approve the deletion request before the appointment is removed.`,
  });
}

type PasswordResetEmailData = {
  to: string;
  firstName: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail(data: PasswordResetEmailData) {
  await sendMailSafely({
    from: env.EMAIL_FROM,
    to: data.to,
    subject: "Reset your password",
    text: `Hello ${data.firstName},\n\nA password reset was requested for your account.\n\nReset link: ${data.resetUrl}\n\nIf you did not request this, you can ignore this email.`,
  });
}

type AccountDeletionEmailData = {
  to: string;
  firstName: string;
  confirmationUrl: string;
};

export async function sendAccountDeletionEmail(data: AccountDeletionEmailData) {
  await sendMailSafely({
    from: env.EMAIL_FROM,
    to: data.to,
    subject: "Confirm account deletion",
    text: `Hello ${data.firstName},\n\nWe received a request to permanently delete your Pawside account and all associated appointments.\n\nConfirm account deletion: ${data.confirmationUrl}\n\nThis link expires in 30 minutes. Opening the link will not delete your account until you confirm on the page. If you did not request this, you can safely ignore this email.`,
  });
}
