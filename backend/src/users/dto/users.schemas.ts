import { z } from "zod";

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  surname: z.string().min(1).optional(),
  homeAddress: z.string().min(1).optional(),
  mobileNumber: z.string().min(1).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const deleteAccountSchema = z.object({
  currentPassword: z.string().min(1),
  confirmation: z.literal("DELETE"),
});

export const accountDeletionTokenSchema = z.object({
  token: z.string().min(1),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type AccountDeletionTokenInput = z.infer<
  typeof accountDeletionTokenSchema
>;
