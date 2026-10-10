import { z } from "zod";

// Rezervasyon (konaklama) giriş şeması — tek doğrulama kaynağı.
// Tarihler YYYY-MM-DD string taşınır; z.iso.date gerçek takvim geçerliliğini
// de doğrular (ör. 2026-13-40, 2026-02-30 reddedilir).

const isoDateField = (message: string) => z.iso.date(message);

export const staySchema = z.object({
  startDate: isoDateField("Başlangıç tarihi YYYY-AA-GG biçiminde olmalıdır."),
  endDate: isoDateField("Bitiş tarihi YYYY-AA-GG biçiminde olmalıdır."),
  guests: z
    .int("Konaklama kişi sayısı tam sayı olmalıdır.")
    .min(1, "En az 1 kişi olmalıdır.")
    .max(16, "En fazla 16 kişi olabilir."),
  message: z
    .string()
    .trim()
    .max(2000, "Mesaj en fazla 2000 karakter olabilir.")
    .optional(),
});

export type StayInput = z.infer<typeof staySchema>;
