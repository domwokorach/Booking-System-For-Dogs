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
    }
    catch (error) {
        console.error("Email delivery failed.", error);
        return false;
    }
}
function formatDateTime(value) {
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: env.BUSINESS_TIME_ZONE,
    }).format(value);
}
function formatDate(value) {
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
        timeZone: env.BUSINESS_TIME_ZONE,
    }).format(value);
}
function formatTime(value) {
    return new Intl.DateTimeFormat("en-US", {
        timeStyle: "short",
        timeZone: env.BUSINESS_TIME_ZONE,
    }).format(value);
}
function formatService(service) {
    if (!service) {
        return "Not specified";
    }
    return SERVICE_LABELS[service] ?? service;
}
function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
export function resolveBookingRecipient(defaultRecipient) {
    return defaultRecipient;
}
function resolveBookingRecipients(userRecipient) {
    return [...new Set([userRecipient, env.BOOKING_EMAIL_TO.trim()].filter(Boolean))];
}
export async function sendBookingConfirmationEmail(data) {
    const results = await Promise.all(resolveBookingRecipients(data.to).map((recipient) => sendMailSafely({
        from: env.EMAIL_FROM,
        to: recipient,
        subject: "Booking confirmed",
        text: `Hi ${data.firstName},\n\nYour appointment has been confirmed.\n\nBooking ID: ${data.bookingId ?? "Not available"}\nSelected service: ${formatService(data.service)}\nAppointment date: ${formatDate(data.appointmentDateTime)}\nAppointment time: ${formatTime(data.appointmentDateTime)}\nBooking status: ${data.status}\n\nWe look forward to seeing you.`,
    })));
    return results.every(Boolean);
}
export async function sendBookingUpdateEmail(data) {
    return sendMailSafely({
        from: env.EMAIL_FROM,
        to: data.to,
        subject: "Booking updated",
        text: `Hi ${data.firstName}, your booking was updated to ${formatDateTime(data.appointmentDateTime)}. Status: ${data.status}.`,
    });
}
export async function sendBookingCancellationEmail(data) {
    const results = await Promise.all(resolveBookingRecipients(data.to).map((recipient) => sendMailSafely({
        from: env.EMAIL_FROM,
        to: recipient,
        subject: "Booking cancelled",
        text: `Hi ${data.firstName},\n\nYour booking has been cancelled.\n\nBooking ID: ${data.bookingId ?? "Not available"}\nSelected service: ${formatService(data.service)}\nAppointment date: ${formatDate(data.appointmentDateTime)}\nAppointment time: ${formatTime(data.appointmentDateTime)}\nBooking status: ${data.status}.`,
    })));
    return results.every(Boolean);
}
export async function sendDeletionRequestEmail(data) {
    return sendMailSafely({
        from: env.EMAIL_FROM,
        to: resolveBookingRecipient(data.to),
        subject: "Deletion approval requested",
        text: `Hi ${data.firstName},\n\nA deletion request has been submitted for this booking and needs approval before the appointment can be removed.\n\nBooking ID: ${data.bookingId ?? "Not available"}\nSelected service: ${formatService(data.service)}\nAppointment date: ${formatDate(data.appointmentDateTime)}\nAppointment time: ${formatTime(data.appointmentDateTime)}\nBooking status: ${data.status}.\n\nPlease review and approve the deletion request before the appointment is removed.`,
    });
}
export async function sendPasswordResetEmail(data) {
    return sendMailSafely({
        from: env.EMAIL_FROM,
        to: data.to,
        subject: "Reset your password",
        text: `Hello ${data.firstName},\n\nA password reset was requested for your account.\n\nReset link: ${data.resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    });
}
export async function sendAccountDeletionRequestEmails(data) {
    const safeFirstName = escapeHtml(data.firstName);
    const safeConfirmationUrl = escapeHtml(data.confirmationUrl);
    const safeCancellationUrl = escapeHtml(data.cancellationUrl);
    const userDelivery = sendMailSafely({
        from: env.EMAIL_FROM,
        to: data.to,
        subject: "Account deletion request received",
        text: `Hello ${data.firstName},\n\nWe received a request to permanently delete your Pawside account and all associated appointments. The request status is PENDING.\n\nConfirm deletion: ${data.confirmationUrl}\n\nCancel Delete Request: ${data.cancellationUrl}\n\nBoth links expire in 30 minutes. Your account remains active unless deletion is confirmed.`,
        html: `<p>Hello ${safeFirstName},</p><p>We received a request to permanently delete your Pawside account and all associated appointments.</p><p><strong>Status: PENDING</strong></p><p><a href="${safeConfirmationUrl}" style="display:inline-block;padding:12px 18px;background:#b91c1c;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Review deletion request</a></p><p><a href="${safeCancellationUrl}" style="display:inline-block;padding:12px 18px;background:#166534;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Cancel Delete Request</a></p><p>Both links expire in 30 minutes. Your account remains active unless deletion is confirmed.</p>`,
    });
    const emails = [userDelivery];
    if (data.adminRecipient) {
        emails.push(sendMailSafely({
            from: env.EMAIL_FROM,
            to: data.adminRecipient,
            subject: "Pawside account deletion request",
            text: `An account deletion request was submitted.\n\nRequest ID: ${data.requestId}\nUser: ${data.firstName}\nEmail: ${data.to}\nStatus: PENDING\n\nThe user has been sent confirmation and cancellation links.`,
        }));
    }
    const [deliveredToUser] = await Promise.all(emails);
    return deliveredToUser;
}
