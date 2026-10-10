"use server";

import { CredentialsSignin } from "next-auth";

import { requireUser, signIn } from "../../lib/auth";
import { fail, ok, type ActionResult } from "../../lib/result";
import { firstIssue } from "../../lib/result";
import { loginSchema } from "../../lib/validators/auth";
import { registerUser, updateProfileCore, EmailNotVerifiedError } from "./service";

export type LoginState = { error: string | null; field?: string; resendEmail?: string };
export type RegisterState = {
  error: string | null;
  field?: string;
  done: boolean;
};
export type ProfileState = {
  error: string | null;
  field?: string;
  done: boolean;
};
export type VerifyEmailResult = ActionResult<{ verified: boolean }>;

function formDataValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Yalnızca uygulama içi (göreli) yollar — açık yönlendirme (open redirect) engeli. */
function safeCallbackUrl(value: unknown): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
  ) {
    return value;
  }
  return "/";
}

/**
 * Giriş formu eylemi: Zod (Türkçe hatalar) → Auth.js credentials sign-in.
 * Başarıda `signIn()` redirect fırlatır ve hiç dönmez; geçersiz kimlikte
 * `CredentialsSignin` yakalanıp Türkçe mesajla döner.
 * E-posta doğrulanmamışsa özel hata + resend e-postası döner.
 */
export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formDataValue(formData, "email"),
    password: formDataValue(formData, "password"),
  });
  if (!parsed.success) {
    const issue = firstIssue(parsed.error);
    return { error: issue.message, field: issue.field };
  }

  try {
    // Başarıda `signIn` NEXT_REDIRECT fırlatır ve hiç dönmez.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeCallbackUrl(formDataValue(formData, "callbackUrl")),
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      // EmailNotVerifiedError cause olarak geliyor.
      if (error.cause instanceof EmailNotVerifiedError) {
        return {
          error: "E-postanız doğrulanmamış.",
          field: undefined,
          resendEmail: error.cause.email,
        };
      }
      // Yanlış şifre, bilinmeyen e-posta ve banlı hesap aynı genel mesajda
      // birleşir (hesap varlığı sızdırılmaz).
      return { error: "E-posta veya şifre hatalı." };
    }
    throw error;
  }
  // signIn başarıda asla dönmez (NEXT_REDIRECT fırlatır); ulaşılamaz ama
  // tip sözleşmesini (Promise<LoginState>) korumak için savunma fırlatırız.
  throw new Error("Beklenmedik durum: signIn dönüşü tamamlanamadı.");
}

/**
 * Kayıt formu eylemi: ince sarmalayıcı — Zod doğrulama, bcrypt hash ve tekil
 * e-posta kontrolü `registerUser` (service) içindedir.
 */
export async function registerAction(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const result = await registerUser({
    name: formDataValue(formData, "name"),
    email: formDataValue(formData, "email"),
    password: formDataValue(formData, "password"),
  });
  if (result.ok) {
    return { error: null, done: true };
  }
  return { error: result.error, field: result.field, done: false };
}

/**
 * Profil güncelleme eylemi: ince sarmalayıcı — oturum kapısı `requireUser()`
 * (hedef id yalnız oturumdan gelir), doğrulama/şifre hash'i `updateProfileCore`
 * (service) içindedir. Boş şifre alanları "değiştirilmedi" anlamına gelir.
 */
export async function updateProfileAction(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser();
  const result = await updateProfileCore(user, {
    name: formDataValue(formData, "name"),
    phone: formDataValue(formData, "phone"),
    newPassword: formDataValue(formData, "newPassword") || undefined,
    currentPassword: formDataValue(formData, "currentPassword") || undefined,
  });
  if (result.ok) {
    return { error: null, done: true };
  }
  return { error: result.error, field: result.field, done: false };
}

/**
 * E-posta doğrulama eylemi: token'ı doğrular, kullanıcının emailVerified alanını
 * günceller. Başarı/başarısızlık durumunu UI'ya döndürür.
 */
export async function verifyEmailAction(
  _prevState: VerifyEmailResult,
  formData: FormData,
): Promise<VerifyEmailResult> {
  const token = formData.get("token");
  if (typeof token !== "string" || token.length === 0) {
    return fail("Geçersiz doğrulama bağlantısı.");
  }

  const { verifyEmail } = await import("./service");
  const payload = await verifyEmail(token);
  if (!payload) {
    return fail("Doğrulama bağlantısı geçersiz veya süresi dolmuş.");
  }

  // Kullanıcıyı bul ve emailVerified'ı güncelle.
  const { prisma } = await import("../../lib/prisma");
  const user = await prisma.user.findUnique({ where: { email: payload.email } });
  if (!user) {
    return fail("Kullanıcı bulunamadı.");
  }

  if (user.emailVerified !== null) {
    // Zaten doğrulanmış → yine de başarı say (idempotent).
    return ok({ verified: true });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date() },
  });

  return ok({ verified: true });
}

/**
 * Doğrulama e-postasını yeniden gönderir.
 */
export async function resendVerifyEmailAction(
  _prevState: VerifyEmailResult,
  formData: FormData,
): Promise<VerifyEmailResult> {
  const email = formData.get("email");
  if (typeof email !== "string" || email.length === 0) {
    return fail("E-posta adresi gerekli.");
  }

  const { prisma } = await import("../../lib/prisma");
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    // Güvenlik: kullanıcı yoksa da başarılıymiş gibi davran (enumaration engeli).
    return ok({ verified: false });
  }

  if (user.emailVerified !== null) {
    return fail("E-posta zaten doğrulanmış.");
  }

  const { createVerifyToken } = await import("../../lib/auth/tokens");
  const { sendRegisterVerify } = await import("../../lib/email/events");
  const token = createVerifyToken(user.email);
  sendRegisterVerify(user.email, token);

  return ok({ verified: false });
}
