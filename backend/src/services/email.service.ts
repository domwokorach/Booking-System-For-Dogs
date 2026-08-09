import { env } from "../config/env.js";

const resendApiKey = env.RESEND_API_KEY?.trim();

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
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(value);
}

export async function sendBookingConfirmationEmail(data: BookingEmailData) {
  await sendMailSafely({
    from: env.EMAIL_FROM,
    to: data.to,
    subject: "Booking confirmed",
    text: `Hi ${data.firstName}, your booking is confirmed for ${formatDate(data.appointmentDateTime)}. Status: ${data.status}.`,
  });
}

export async function sendBookingUpdateEmail(data: BookingEmailData) {
  await sendMailSafely({
    from: env.EMAIL_FROM,
    to: data.to,
    subject: "Booking updated",
    text: `Hi ${data.firstName}, your booking was updated to ${formatDate(data.appointmentDateTime)}. Status: ${data.status}.`,
  });
}

export async function sendBookingCancellationEmail(data: BookingEmailData) {
  await sendMailSafely({
    from: env.EMAIL_FROM,
    to: data.to,
    subject: "Booking cancelled",
    text: `Hi ${data.firstName}, your booking for ${formatDate(data.appointmentDateTime)} has been cancelled.`,
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
