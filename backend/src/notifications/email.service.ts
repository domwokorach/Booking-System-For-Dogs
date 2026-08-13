import { Injectable } from "@nestjs/common";

import {
  sendAccountDeletionRequestEmails,
  sendBookingCancellationEmail,
  sendBookingConfirmationEmail,
  sendBookingUpdateEmail,
  sendCancellationApprovalRequestEmail,
  sendDeletionRequestEmail,
  sendPasswordResetEmail,
  sendRefundConfirmationEmail,
  sendRefundFailureEmail,
  sendRefundRequestedEmail,
  sendHeatWarningEmail,
} from "../services/email.service.js";

export type BookingEmailData = {
  to: string;
  firstName: string;
  appointmentDateTime: Date;
  status: string;
  bookingId?: string;
  service?: string | null;
  amountPence?: number;
  currency?: string;
  paymentStatus?: string;
  refundId?: string;
  refundFailureReason?: string | null;
};

export type AccountDeletionRequestEmailData = {
  to: string;
  firstName: string;
  requestId: string;
  confirmationUrl: string;
  cancellationUrl: string;
  adminRecipient: string;
};

@Injectable()
export class EmailService {
  sendBookingConfirmation(data: BookingEmailData): Promise<boolean> {
    return sendBookingConfirmationEmail(data);
  }

  sendBookingUpdate(data: BookingEmailData): Promise<boolean> {
    return sendBookingUpdateEmail(data);
  }

  sendBookingCancellation(data: BookingEmailData): Promise<boolean> {
    return sendBookingCancellationEmail(data);
  }

  sendCancellationApprovalRequest(
    data: BookingEmailData & {
      approvalUrl: string;
      expiresAt: Date;
      adminRecipient: string;
    },
  ): Promise<{
    customerDelivered: boolean;
    administratorDelivered: boolean;
  }> {
    return sendCancellationApprovalRequestEmail(data);
  }

  sendRefundRequested(data: BookingEmailData): Promise<boolean> {
    return sendRefundRequestedEmail(data);
  }

  sendRefundConfirmation(data: BookingEmailData): Promise<boolean> {
    return sendRefundConfirmationEmail(data);
  }

  sendRefundFailure(data: BookingEmailData): Promise<boolean> {
    return sendRefundFailureEmail(data);
  }

  sendDeletionRequest(
    data: BookingEmailData & { approvalUrl: string; adminRecipient: string },
  ): Promise<boolean> {
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

  sendHeatWarning(data: {
    to: string;
    firstName: string;
    location: string;
    temperatureC: number;
  }): Promise<boolean> {
    return sendHeatWarningEmail(data);
  }
}
