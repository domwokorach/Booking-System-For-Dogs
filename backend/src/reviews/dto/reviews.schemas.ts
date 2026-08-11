import { z } from "zod";

const uploadedAvatarPath = /^\/uploads\/[A-Za-z0-9/_-]+\.(?:jpe?g|png|webp)$/i;

export const createReviewSchema = z.object({
  appointmentId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(20).max(2000),
  petName: z.string().trim().min(1).max(80),
  petBreed: z.string().trim().min(1).max(80),
  avatarUrl: z
    .string()
    .trim()
    .max(2048)
    .refine(
      (value) => uploadedAvatarPath.test(value) || z.string().url().safeParse(value).success,
      "Upload a valid profile picture.",
    ),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
