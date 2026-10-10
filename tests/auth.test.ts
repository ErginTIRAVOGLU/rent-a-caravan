import { compare } from "bcryptjs";
import { expect, it } from "vitest";

import { prisma } from "../src/lib/prisma";
import {
  linkGoogleUser,
  registerUser,
  verifyCredentials,
} from "../src/server/users/service";
import { makeUser, resetDb } from "./helpers/db";

it("geçerli e-posta + doğru şifre ile kullanıcı döner", async () => {
  await resetDb();
  const created = await prisma.user.create({ data: makeUser() });

  const user = await verifyCredentials(created.email, "demo1234");

  expect(user).not.toBeNull();
  expect(user?.id).toBe(created.id);
  expect(user?.name).toBe(created.name);
  expect(user?.email).toBe(created.email);
  expect(user?.role).toBe("USER");
  expect(user?.isBanned).toBe(false);
  // bcrypt karşılaştırma: fabrika hash düz metin değil
  expect(await compare("demo1234", created.passwordHash ?? "")).toBe(true);
});

it("yanlış şifre null döner", async () => {
  await resetDb();
  const created = await prisma.user.create({ data: makeUser() });

  expect(await verifyCredentials(created.email, "yanlis-sifre")).toBeNull();
});

it("isBanned=true kullanıcı null döner (giriş engeli)", async () => {
  await resetDb();
  const created = await prisma.user.create({
    data: makeUser({ isBanned: true }),
  });

  expect(await verifyCredentials(created.email, "demo1234")).toBeNull();
});

it("aynı e-posta ile ikinci kayıt fail döner, field=email", async () => {
  await resetDb();
  const input = {
    name: "Ayşe Yılmaz",
    email: "ayse@karavan.test",
    password: "guclu-sifre-1",
  };

  const first = await registerUser(input);
  expect(first.ok).toBe(true);

  const second = await registerUser(input);
  expect(second.ok).toBe(false);
  if (!second.ok) {
    expect(second.field).toBe("email");
    expect(second.error).toBe("Bu e-posta adresi zaten kayıtlı.");
  }
});

it("registerUser şifreyi hash'ler (DB'de düz metin yok)", async () => {
  await resetDb();
  const plainPassword = "guclu-sifre-1";

  const result = await registerUser({
    name: "Mehmet Demir",
    email: "mehmet@karavan.test",
    password: plainPassword,
  });
  expect(result.ok).toBe(true);

  const saved = await prisma.user.findUniqueOrThrow({
    where: { email: "mehmet@karavan.test" },
  });
  expect(saved.passwordHash).toBeTruthy();
  expect(saved.passwordHash).not.toBe(plainPassword);
  expect(saved.passwordHash).not.toContain(plainPassword);
  expect(await compare(plainPassword, saved.passwordHash ?? "")).toBe(true);
  // role asla istemciden okunmaz; servis DB default'unu (USER) kullanır
  expect(saved.role).toBe("USER");
});

it("linkGoogleUser: bilinmeyen e-posta ile yeni USER oluşturur (DB id döner)", async () => {
  await resetDb();

  const result = await linkGoogleUser({
    googleId: "google-123",
    email: "yeni-kullanici@karavan.test",
    name: "Yeni Kullanıcı",
    avatarUrl: null,
  });

  expect(result.ok).toBe(true);
  if (result.ok) {
    // SessionUser.id her zaman gerçek DB User.id (cuid) — T5/T6/T9 FK sözleşmesi
    expect(result.data.id).toMatch(/^c/);
    expect(result.data.role).toBe("USER");
  }
  const saved = await prisma.user.findUniqueOrThrow({
    where: { email: "yeni-kullanici@karavan.test" },
  });
  expect(saved.googleId).toBe("google-123");
});

it("linkGoogleUser: e-posta kayıtlıysa googleId bağlar (aynı DB id korunur)", async () => {
  await resetDb();
  const created = await prisma.user.create({ data: makeUser() });

  const result = await linkGoogleUser({
    googleId: "google-456",
    email: created.email,
    name: created.name,
    avatarUrl: null,
  });

  expect(result.ok).toBe(true);
  if (result.ok) {
    // account-linking: mevcut satırın id'si değişmez, yalnız googleId bağlanır
    expect(result.data.id).toBe(created.id);
  }
  const updated = await prisma.user.findUniqueOrThrow({
    where: { id: created.id },
  });
  expect(updated.googleId).toBe("google-456");
});

it("linkGoogleUser: banlı hesap fail döner (oturum kurulmaz)", async () => {
  await resetDb();
  const banned = await prisma.user.create({
    data: makeUser({ isBanned: true }),
  });

  const result = await linkGoogleUser({
    googleId: "google-789",
    email: banned.email,
    name: banned.name,
    avatarUrl: null,
  });

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toBe("Bu hesap askıya alınmış.");
  }
});
