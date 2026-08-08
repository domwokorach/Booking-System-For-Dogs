import nodemailer from "nodemailer";
import type { SentMessageInfo } from "nodemailer";

import { env } from "../config/env.js";

const hasSmtpCredentials =
  Boolean(env.SMTP_HOST) && Boolean(env.SMTP_USER) && Boolean(env.SMTP_PASS);

const transporter = hasSmtpCredentials
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    })
  : nodemailer.createTransport({
      jsonTransport: true,
    });

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
  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: data.to,
    subject: "Booking confirmed",
    text: `Hi ${data.firstName}, your booking is confirmed for ${formatDate(data.appointmentDateTime)}. Status: ${data.status}.`,
  });
}

export async function sendBookingUpdateEmail(data: BookingEmailData) {
  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: data.to,
    subject: "Booking updated",
    text: `Hi ${data.firstName}, your booking was updated to ${formatDate(data.appointmentDateTime)}. Status: ${data.status}.`,
  });
}

export async function sendBookingCancellationEmail(data: BookingEmailData) {
  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: data.to,
    subject: "Booking cancelled",
    text: `Hi ${data.firstName}, your booking for ${formatDate(data.appointmentDateTime)} has been cancelled.`,
  });
}
