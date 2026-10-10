import { z } from "zod";

import { passwordField } from "./auth";

// Profil güncelleme şeması — SUNUCU doğrulamasının tek kaynağı (service bu
// şemayı parse eder). Form yalnız aynı kuralları aynalar (HTML attrs), şemayı
// import etmez. Tüm alanlar opsiyoneldir; "en az bir alan" ve şifre değişimi
// eş-kuraları nesne düzeyindeki refine'larda uygulanır.
// NOT: `id`/`role`/`email` BİLEREK şemada yok — Zod v4 object bilinmeyen
// anahtarları strip eder (ledger Ruling-3: hedef satır yalnız `user.id`'dir).

const nameField = z
  .string("Ad zorunludur.")
  .trim()
  .min(2, "Ad en az 2 karakter olmalıdır.")
  .max(80, "Ad en fazla 80 karakter olabilir.");

// Telefon opsiyonel; boş bırakılırsa temizlenir (null). Boş Dışı değerler
// rakam/tırnak/space ailesiyle sınırlı, 7-20 karakter.
const phoneField = z
  .string("Telefon numarası metin olmalıdır.")
  .trim()
  .max(20, "Telefon numarası en fazla 20 karakter olabilir.")
  .refine(
    (value) => value === "" || /^[0-9+() -]{7,20}$/.test(value),
    "Geçerli bir telefon numarası girin (ör. 0555 555 55 55).",
  );

const currentPasswordField = z
  // NOT: `.trim()` BİLEREK YOK — kayıt (auth.ts `passwordField`) ham girdiyi
  // hash'lediği için, trimlenmiş girdi `compare`'da hiçbir zaman eşleşmezdi
  // (kullanıcı şifre değiştiremez hale gelirdi). Kayıt ile simetri şart.
  .string("Mevcut şifre zorunludur.")
  .min(1, "Mevcut şifre zorunludur.")
  .optional();

export const updateProfileSchema = z
  .object({
    name: nameField.optional(),
    phone: phoneField.optional(),
    // Şifre değişimi eski şifreyi şart koşar (aşağıdaki eş-kurallar).
    newPassword: passwordField.optional(),
    currentPassword: currentPasswordField,
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.phone !== undefined ||
      data.newPassword !== undefined,
    {
      message:
        "Güncellenecek en az bir alan (ad, telefon veya şifre) girin.",
      path: [],
    },
  )
  .refine(
    (data) =>
      data.newPassword === undefined || data.currentPassword !== undefined,
    {
      message: "Şifre değiştirmek için mevcut şifrenizi girin.",
      path: ["currentPassword"],
    },
  )
  .refine(
    (data) =>
      data.currentPassword === undefined || data.newPassword !== undefined,
    {
      message: "Yeni şifre girin.",
      path: ["newPassword"],
    },
  );

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
