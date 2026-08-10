import { Injectable } from "@nestjs/common";

import {
  resolveBookingRecipient,
  sendAccountDeletionRequestEmails,
  sendBookingCancellationEmail,
  sendBookingConfirmationEmail,
  sendBookingUpdateEmail,
  sendDeletionRequestEmail,
  sendPasswordResetEmail,
} from "../services/email.service.js";

export type BookingEmailData = {
  to: string;
  firstName: string;
  appointmentDateTime: Date;
  status: string;
  bookingId?: string;
  service?: string | null;
};

export type AccountDeletionRequestEmailData = {
  to: string;
  firstName: string;
  requestId: string;
  confirmationUrl: string;
  cancellationUrl: string;
  adminRecipient?: string;
};

@Injectable()
export class EmailService {
  resolveBookingRecipient(defaultRecipient: string): string {
    return resolveBookingRecipient(defaultRecipient);
  }

  sendBookingConfirmation(data: BookingEmailData): Promise<boolean> {
    return sendBookingConfirmationEmail(data);
  }

  sendBookingUpdate(data: BookingEmailData): Promise<boolean> {
    return sendBookingUpdateEmail(data);
  }

  sendBookingCancellation(data: BookingEmailData): Promise<boolean> {
    return sendBookingCancellationEmail(data);
  }

  sendDeletionRequest(data: BookingEmailData): Promise<boolean> {
    return sendDeletionRequestEmail(data);
  }

  sendPasswordReset(data: {
    to: string;
    firstName: string;
    resetUrl: string;
  }): Promise<boolean> {
    return sendPasswordResetEmail(data);
  }

  sendAccountDeletionRequest(
    data: AccountDeletionRequestEmailData,
  ): Promise<boolean> {
    return sendAccountDeletionRequestEmails(data);
  }
}
