import { env } from "../config/env.js";

const resendApiKey = env.RESEND_API_KEY?.trim();
const SERVICE_LABELS: Record<string, string> = {
  grooming: "Grooming",
  training: "Training",
  daycare: "Daycare",
  boarding: "Boarding",
};

async function sendMailSafely(mail: { from: string; to: string; subject: string; text: string; html?: string }) {
  if (!resendApiKey) {
    console.warn("RESEND_API_KEY is not configured. Skipping email send.");
    return false;
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
        ...(mail.html ? { html: mail.html } : {}),
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Resend API error ${response.status}: ${errorData}`);
    }
    return true;
  } catch (error) {
    console.error("Email delivery failed.", error);
    return false;
  }
}

type BookingEmailData = {
  to: string;
  firstName: string;
  appointmentDateTime: Date;
  status: string;
  bookingId?: string;
  service?: string | null;
  amountPence?: number;
  currency?: string;
  paymentStatus?: string;
};

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: env.BUSINESS_TIME_ZONE,
  }).format(value);
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: env.BUSINESS_TIME_ZONE,
  }).format(value);
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: env.BUSINESS_TIME_ZONE,
  }).format(value);
}

function formatService(service: string | null | undefined): string {
  if (!service) {
    return "Not specified";
  }

  return SERVICE_LABELS[service] ?? service;
}

function formatPayment(data: BookingEmailData): string {
  if (data.amountPence === undefined || !data.currency) {
    return "";
  }

  const amount = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: data.currency.toUpperCase(),
  }).format(data.amountPence / 100);
  return `\nPayment: ${amount}\nPayment status: ${data.paymentStatus ?? "PAID"}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function resolveBookingRecipient(defaultRecipient: string): string {
  return env.BOOKING_EMAIL_TO.trim() || defaultRecipient;
}

function resolveBookingRecipients(userRecipient: string): string[] {
  return [...new Set([userRecipient, env.BOOKING_EMAIL_TO.trim()].filter(Boolean))];
}

export async function sendBookingConfirmationEmail(data: BookingEmailData) {
  const results = await Promise.all(
    resolveBookingRecipients(data.to).map((recipient) =>
      sendMailSafely({
        from: env.EMAIL_FROM,
        to: recipient,
        subject: "Booking confirmed",
        text: `Hi ${data.firstName},\n\nYour appointment has been confirmed.\n\nBooking ID: ${data.bookingId ?? "Not available"}\nSelected service: ${formatService(data.service)}\nAppointment date: ${formatDate(data.appointmentDateTime)}\nAppointment time: ${formatTime(data.appointmentDateTime)}${formatPayment(data)}\nBooking status: ${data.status}\n\nWe look forward to seeing you.`,
      }),
    ),
  );
  // The registered customer is always first; optional administrator copies do
  // not determine whether customer delivery succeeded.
  return results[0] ?? false;
}

export async function sendBookingUpdateEmail(data: BookingEmailData) {
  return sendMailSafely({
    from: env.EMAIL_FROM,
    to: data.to,
    subject: "Booking updated",
    text: `Hi ${data.firstName}, your booking was updated to ${formatDateTime(data.appointmentDateTime)}. Status: ${data.status}.`,
  });
}

export async function sendBookingCancellationEmail(data: BookingEmailData) {
  const results = await Promise.all(
    resolveBookingRecipients(data.to).map((recipient) =>
      sendMailSafely({
        from: env.EMAIL_FROM,
        to: recipient,
        subject: "Booking cancelled",
        text: `Hi ${data.firstName},\n\nYour booking has been cancelled.\n\nBooking ID: ${data.bookingId ?? "Not available"}\nSelected service: ${formatService(data.service)}\nAppointment date: ${formatDate(data.appointmentDateTime)}\nAppointment time: ${formatTime(data.appointmentDateTime)}\nBooking status: ${data.status}.`,
      }),
    ),
  );
  return results.every(Boolean);
}

export async function sendDeletionRequestEmail(
  data: BookingEmailData & { approvalUrl: string },
) {
  const safeApprovalUrl = escapeHtml(data.approvalUrl);
  const safeBookingId = escapeHtml(data.bookingId ?? "Not available");
  const safeService = escapeHtml(formatService(data.service));

  return sendMailSafely({
    from: env.EMAIL_FROM,
    to: resolveBookingRecipient(data.to),
    subject: "Deletion approval requested",
    text: `A deletion request has been submitted for an appointment and needs administrator approval.\n\nBooking ID: ${data.bookingId ?? "Not available"}\nCustomer: ${data.firstName}\nSelected service: ${formatService(data.service)}\nAppointment date: ${formatDate(data.appointmentDateTime)}\nAppointment time: ${formatTime(data.appointmentDateTime)}\nBooking status: ${data.status}.\n\nApprove deletion: ${data.approvalUrl}\n\nThis single-use link expires in 30 minutes.`,
    html: `<p>An appointment deletion request needs administrator approval.</p><p><strong>Booking ID:</strong> ${safeBookingId}</p><p><strong>Selected service:</strong> ${safeService}</p><p><a href="${safeApprovalUrl}" style="display:inline-block;padding:12px 18px;background:#b91c1c;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Review deletion request</a></p><p>This single-use link expires in 30 minutes.</p>`,
  });
}

type PasswordResetEmailData = {
  to: string;
  firstName: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail(data: PasswordResetEmailData) {
  return sendMailSafely({
    from: env.EMAIL_FROM,
    to: data.to,
    subject: "Reset your password",
    text: `Hello ${data.firstName},\n\nA password reset was requested for your account.\n\nReset link: ${data.resetUrl}\n\nIf you did not request this, you can ignore this email.`,
  });
}

type AccountDeletionRequestEmailData = {
  to: string;
  firstName: string;
  requestId: string;
  confirmationUrl: string;
  cancellationUrl: string;
  adminRecipient?: string;
};

export async function sendAccountDeletionRequestEmails(data: AccountDeletionRequestEmailData) {
  const safeFirstName = escapeHtml(data.firstName);
  const safeConfirmationUrl = escapeHtml(data.confirmationUrl);
  const safeCancellationUrl = escapeHtml(data.cancellationUrl);
  const safeRequestId = escapeHtml(data.requestId);
  const safeUserEmail = escapeHtml(data.to);
  const recipient = data.adminRecipient?.trim() || data.to;

  return sendMailSafely({
    from: env.EMAIL_FROM,
    to: recipient,
    subject: "Account deletion approval requested",
    text: `Hello ${data.firstName},\n\nA user requested deletion of the Pawside account associated with ${data.to}.\n\nRequest ID: ${data.requestId}\nStatus: PENDING\n\nApprove deletion: ${data.confirmationUrl}\nReject request: ${data.cancellationUrl}\n\nBoth links expire in 30 minutes. The account remains active until approval is granted.`,
    html: `<p>Hello ${safeFirstName},</p><p>A user requested deletion of the Pawside account associated with ${safeUserEmail}.</p><p><strong>Request ID:</strong> ${safeRequestId}</p><p><strong>Status: PENDING</strong></p><p><a href="${safeConfirmationUrl}" style="display:inline-block;padding:12px 18px;background:#b91c1c;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Approve deletion</a></p><p><a href="${safeCancellationUrl}" style="display:inline-block;padding:12px 18px;background:#166534;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Reject request</a></p><p>Both links expire in 30 minutes. The account remains active until approval is granted.</p>`,
  });
}
