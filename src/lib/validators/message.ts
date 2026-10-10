import { z } from "zod";

// Mesaj gönderim şeması — 1..2000 karakter.
export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Mesaj en az 1 karakter olmalıdır.")
    .max(2000, "Mesaj en fazla 2000 karakter olabilir."),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;