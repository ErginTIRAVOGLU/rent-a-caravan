"use server";

import { CredentialsSignin } from "next-auth";

import { signIn } from "../../lib/auth";
import {
  firstIssue,
  loginSchema,
} from "../../lib/validators/auth";
import { registerUser } from "./service";

export type LoginState = { error: string | null; field?: string };
export type RegisterState = {
  error: string | null;
  field?: string;
  done: boolean;
};

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
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeCallbackUrl(formDataValue(formData, "callbackUrl")),
    });
    return { error: null };
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      // Yanlış şifre, bilinmeyen e-posta ve banlı hesap aynı genel mesajda
      // birleşir (hesap varlığı sızdırılmaz).
      return { error: "E-posta veya şifre hatalı." };
    }
    throw error;
  }
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
