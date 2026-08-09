import { env } from "../config/env.js";
const resendApiKey = env.RESEND_API_KEY?.trim();
const SERVICE_LABELS = {
    grooming: "Grooming",
    training: "Training",
    daycare: "Daycare",
    boarding: "Boarding",
};
async function sendMailSafely(mail) {
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
    }
    catch (error) {
        console.error("Email delivery failed.", error);
    }
}
function formatDateTime(value) {
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
        timeStyle: "short",
    }).format(value);
}
function formatDate(value) {
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
    }).format(value);
}
function formatTime(value) {
    return new Intl.DateTimeFormat("en-US", {
        timeStyle: "short",
    }).format(value);
}
function formatService(service) {
    if (!service) {
        return "Not specified";
    }
    return SERVICE_LABELS[service] ?? service;
}
function resolveBookingRecipient(defaultRecipient) {
    return env.BOOKING_EMAIL_TO.trim() || defaultRecipient;
}
export async function sendBookingConfirmationEmail(data) {
    await sendMailSafely({
        from: env.EMAIL_FROM,
        to: resolveBookingRecipient(data.to),
        subject: "Booking confirmed",
        text: `Hi ${data.firstName},\n\nYour appointment has been confirmed.\n\nBooking ID: ${data.bookingId ?? "Not available"}\nSelected service: ${formatService(data.service)}\nAppointment date: ${formatDate(data.appointmentDateTime)}\nAppointment time: ${formatTime(data.appointmentDateTime)}\nBooking status: ${data.status}\n\nWe look forward to seeing you.`,
    });
}
export async function sendBookingUpdateEmail(data) {
    await sendMailSafely({
        from: env.EMAIL_FROM,
        to: data.to,
        subject: "Booking updated",
        text: `Hi ${data.firstName}, your booking was updated to ${formatDateTime(data.appointmentDateTime)}. Status: ${data.status}.`,
    });
}
export async function sendBookingCancellationEmail(data) {
    await sendMailSafely({
        from: env.EMAIL_FROM,
        to: data.to,
        subject: "Booking cancelled",
        text: `Hi ${data.firstName}, your booking for ${formatDateTime(data.appointmentDateTime)} has been cancelled.`,
    });
}
export async function sendPasswordResetEmail(data) {
    await sendMailSafely({
        from: env.EMAIL_FROM,
        to: data.to,
        subject: "Reset your password",
        text: `Hello ${data.firstName},\n\nA password reset was requested for your account.\n\nReset link: ${data.resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    });
}
