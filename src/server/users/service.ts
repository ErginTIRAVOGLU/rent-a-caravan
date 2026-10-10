import { Prisma } from "@prisma/client";
import { compare, hash } from "bcryptjs";

import { prisma } from "../../lib/prisma";
import { fail, ok, type ActionResult } from "../../lib/result";
import {
  firstIssue,
  registerSchema,
  type RegisterInput,
} from "../../lib/validators/auth";

/**
 * Oturumdaki kimlik. Sözleşme (plan §Task 3):
 * `id` her zaman DB User.id'dir (cuid) — FK'lar buna bağlanır.
 * `role` asla istemciden okunmaz; yalnız DB/seed'den gelir.
 */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  isBanned: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toSessionUser(user: {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  isBanned: boolean;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isBanned: user.isBanned,
  };
}

function isDuplicateEmailError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * E-posta + şifre ile kimlik doğrulama (test edilen çekirdek).
 * Bilinmeyen e-posta, şifresiz (Google) hesap, banlı hesap veya yanlış
 * şifre → `null`.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });
  // Ban engeli: isBanned=true → giriş kapalı (şifre kontrolü bile yapılmaz).
  if (!user || !user.passwordHash || user.isBanned) {
    return null;
  }
  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    return null;
  }
  return toSessionUser(user);
}

/**
 * Yeni üye kaydı: Zod doğrulama → tekil e-posta kontrolü → bcrypt hash.
 * Düz metin şifre asla DB'ye yazılmaz; `role` her zaman USER'dır
 * (ADMIN yalnız seed'den/DB'den gelir).
 */
export async function registerUser(
  input: RegisterInput,
): Promise<ActionResult<SessionUser>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const issue = firstIssue(parsed.error);
    return fail(issue.message, issue.field);
  }

  const { name, email, password } = parsed.data; // e-posta şema içinde normalize edildi
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return fail("Bu e-posta adresi zaten kayıtlı.", "email");
    }
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hash(password, 10),
        role: "USER",
      },
    });
    return ok(toSessionUser(user));
  } catch (error) {
    // Yarış durumunda da aynı Türkçe/alan hatası (unique index P2002).
    if (isDuplicateEmailError(error)) {
      return fail("Bu e-posta adresi zaten kayıtlı.", "email");
    }
    throw error;
  }
}

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

/**
 * Google ile girişte profil DB'ye bağlanır: yoksa USER olarak oluşturur,
 * e-postası kayıtlıysa googleId'si bağlanır. Böylece `SessionUser.id`
 * her zaman gerçek DB kimliği olur (sonraki görevlerin FK'ları için).
 * Banlı hesap → fail (oturum kurulmaz).
 */
export async function linkGoogleUser(
  profile: GoogleProfile,
): Promise<ActionResult<SessionUser>> {
  const email = normalizeEmail(profile.email);
  if (!profile.googleId) {
    return fail("Google hesabının kimliği doğrulanamadı.");
  }
  if (!email) {
    return fail("Google hesabında geçerli bir e-posta bulunamadı.");
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.isBanned) {
        return fail("Bu hesap askıya alınmış.");
      }
      if (existing.googleId && existing.googleId !== profile.googleId) {
        return fail(
          "Bu e-posta adresi farklı bir Google hesabıyla ilişkili.",
        );
      }
      const user =
        existing.googleId === profile.googleId
          ? existing
          : await prisma.user.update({
              where: { id: existing.id },
              data: {
                googleId: profile.googleId,
                avatarUrl: existing.avatarUrl ?? profile.avatarUrl,
              },
            });
      return ok(toSessionUser(user));
    }

    const user = await prisma.user.create({
      data: {
        name: profile.name.trim() || email,
        email,
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl,
        role: "USER",
      },
    });
    return ok(toSessionUser(user));
  } catch (error) {
    // Yarış durumunda da aynı Türkçe/alan hatası (unique index P2002).
    // Ayrıştır: e-posta mı googleId mi çakıştı? googleId çakışması, kullanıcının
    // Google e-postası değişmiş demektir → o satırı güncelle (aksi halde kalıcı
    // giriş engeli olurdu). E-posta çakışması gerçek "zaten kayıtlı"dır.
    if (isDuplicateEmailError(error)) {
      const conflict = await prisma.user.findUnique({
        where: { googleId: profile.googleId },
      });
      if (conflict) {
        if (conflict.isBanned) {
          return fail("Bu hesap askıya alınmış.");
        }
        const updated = await prisma.user.update({
          where: { id: conflict.id },
          data: { email, name: profile.name.trim() || conflict.name, avatarUrl: profile.avatarUrl ?? conflict.avatarUrl },
        });
        return ok(toSessionUser(updated));
      }
      return fail("Bu e-posta adresi zaten kayıtlı.", "email");
    }
    throw error;
  }
}
