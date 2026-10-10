import { compare } from "bcryptjs";
import { expect, it } from "vitest";

import { prisma } from "../src/lib/prisma";
import {
  updateProfileCore,
  type SessionUser,
} from "../src/server/users/service";
import { makeUser, resetDb } from "./helpers/db";

// Profil güncelleme çekirdeği (Task 12). Sözleşmeler:
// - Hedef satır YALNIZ `user.id`'den gelir; payload'daki id/role yok sayılır
//   (Zod v4 strip — ledger Ruling-3).
// - Şifre değişimi eski şifre ile doğrulanır; düz metin asla DB'ye girmez.

/** DB satırından oturum kimliği (SessionUser) türetir. */
function toSession(user: {
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

it("kendi adını/telefonunu günceller", async () => {
  await resetDb();
  const created = await prisma.user.create({ data: makeUser() });

  const result = await updateProfileCore(toSession(created), {
    name: "Ayşe Yılmaz",
    phone: "0555 555 55 55",
  });

  expect(result.ok).toBe(true);
  const saved = await prisma.user.findUniqueOrThrow({
    where: { id: created.id },
  });
  expect(saved.name).toBe("Ayşe Yılmaz");
  expect(saved.phone).toBe("0555 555 55 55");
  // Şifre alanına dokunulmadı
  expect(saved.passwordHash).toBe(created.passwordHash);
});

it("yeni şifre hash'lenerek yazılır, düz metin DB'ye girmez", async () => {
  await resetDb();
  const created = await prisma.user.create({ data: makeUser() });
  const plainNewPassword = "yeni-guclu-sifre-9";

  const result = await updateProfileCore(toSession(created), {
    newPassword: plainNewPassword,
    currentPassword: "demo1234",
  });

  expect(result.ok).toBe(true);
  const saved = await prisma.user.findUniqueOrThrow({
    where: { id: created.id },
  });
  // Düz metin asla DB'ye girmez
  expect(saved.passwordHash).toBeTruthy();
  expect(saved.passwordHash).not.toBe(plainNewPassword);
  expect(saved.passwordHash).not.toContain(plainNewPassword);
  // bcrypt hash ($2ab... öneki) — yeni şifre doğrulanır, eskisi doğrulanmaz
  expect(saved.passwordHash?.startsWith("$2")).toBe(true);
  expect(await compare(plainNewPassword, saved.passwordHash ?? "")).toBe(true);
  expect(await compare("demo1234", saved.passwordHash ?? "")).toBe(false);
});

it("başkasının profilini değiştiremez (yok sayılır — id oturumdan gelir)", async () => {
  await resetDb();
  const me = await prisma.user.create({ data: makeUser({ name: "Ben" }) });
  const other = await prisma.user.create({
    data: makeUser({ name: "Başkası" }),
  });

  // Ruling-3: payload'daki id/role hedefi DEĞİŞTİRMEZ — hedef yalnız user.id.
  const result = await updateProfileCore(toSession(me), {
    name: "Kendi Adım",
    id: other.id,
    role: "ADMIN",
  });

  expect(result.ok).toBe(true);
  // Diğer kullanıcı satırı hiç değişmedi
  const otherAfter = await prisma.user.findUniqueOrThrow({
    where: { id: other.id },
  });
  expect(otherAfter.name).toBe("Başkası");
  expect(otherAfter.role).toBe("USER");
  // Oturum kullanıcısı kendi satırında güncellendi; rolü istemciden gelmez
  const meAfter = await prisma.user.findUniqueOrThrow({
    where: { id: me.id },
  });
  expect(meAfter.name).toBe("Kendi Adım");
  expect(meAfter.role).toBe("USER");
});

it("eski şifre yanlışsa fail döner, DB'de hash değişmez", async () => {
  await resetDb();
  const created = await prisma.user.create({ data: makeUser() });

  const result = await updateProfileCore(toSession(created), {
    newPassword: "yeni-guclu-sifre-9",
    currentPassword: "yanlis-sifre",
  });

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.field).toBe("currentPassword");
    expect(result.error).toBe("Mevcut şifreniz hatalı.");
  }
  const saved = await prisma.user.findUniqueOrThrow({
    where: { id: created.id },
  });
  expect(saved.passwordHash).toBe(created.passwordHash);
  expect(await compare("demo1234", saved.passwordHash ?? "")).toBe(true);
});

it("Google-hesapta (passwordHash null) şifre belirlenemez — koruma", async () => {
  await resetDb();
  const created = await prisma.user.create({
    data: makeUser({ passwordHash: null }),
  });

  const result = await updateProfileCore(toSession(created), {
    newPassword: "yeni-guclu-sifre-9",
    currentPassword: "herhangi-bir-sey",
  });

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.field).toBe("currentPassword");
  }
  // Hesap hâlâ şifresiz; ad güncelleme gibi diğer alanlar etkilenmez.
  const saved = await prisma.user.findUniqueOrThrow({
    where: { id: created.id },
  });
  expect(saved.passwordHash).toBeNull();
});

it("boş ad fail döner (alan bazlı Türkçe hata)", async () => {
  await resetDb();
  const created = await prisma.user.create({ data: makeUser() });

  const result = await updateProfileCore(toSession(created), { name: "   " });

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.field).toBe("name");
    expect(result.error).toBe("Ad en az 2 karakter olmalıdır.");
  }
});

it("çok uzun ad fail döner (alan bazlı Türkçe hata)", async () => {
  await resetDb();
  const created = await prisma.user.create({ data: makeUser() });

  const result = await updateProfileCore(toSession(created), {
    name: "a".repeat(200),
  });

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.field).toBe("name");
    expect(result.error).toBe("Ad en fazla 80 karakter olabilir.");
  }
});

it("hiç alan yoksa fail döner (en az bir alan kuralı)", async () => {
  await resetDb();
  const created = await prisma.user.create({ data: makeUser() });

  const result = await updateProfileCore(toSession(created), {});

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toBe(
      "Güncellenecek en az bir alan (ad, telefon veya şifre) girin.",
    );
  }
});
