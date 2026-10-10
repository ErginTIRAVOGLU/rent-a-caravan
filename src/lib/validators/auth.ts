import { z } from "zod";

// Zod v4: tüm mesajlar Türkçe; e-posta formatı ve şifre >= 8 kuralı burada
// tek doğrulama kaynağı olarak tanımlanır (form + service + authorize aynı
// şemayı kullanır).

/** E-posta: kırp + küçük harfe çevir + format doğrula. */
export const emailField = z
  .string("E-posta adresi zorunludur.")
  .trim()
  .toLowerCase()
  .min(1, "E-posta adresi zorunludur.")
  .pipe(z.email("Geçerli bir e-posta adresi girin."));

/** Kayıt için şifre kuralı: en az 8 karakter. */
export const passwordField = z
  .string("Şifre zorunludur.")
  .min(8, "Şifre en az 8 karakter olmalıdır.");

export const loginSchema = z.object({
  email: emailField,
  // Girişte uzunluk sınırı koymuyoruz (yalnızca zorunlu); uzunluk kuralı
  // şifre belirleme (kayıt) içindir.
  password: z.string("Şifre zorunludur.").min(1, "Şifre zorunludur."),
});

export const registerSchema = z.object({
  name: z
    .string("Ad zorunludur.")
    .trim()
    .min(2, "Ad en az 2 karakter olmalıdır."),
  email: emailField,
  password: passwordField,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

export type FieldIssue = { message: string; field?: string };

/** İlk doğrulama hatasını (Türkçe mesaj + alan adı) çıkarır. */
export function firstIssue(error: z.ZodError): FieldIssue {
  const issue = error.issues[0];
  if (!issue) {
    return { message: "Geçersiz veri." };
  }
  const path = issue.path[0];
  return {
    message: issue.message,
    field: typeof path === "string" ? path : undefined,
  };
}
