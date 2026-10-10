import { compare } from "bcryptjs";
import { expect, it } from "vitest";

import { prisma } from "../src/lib/prisma";
import { registerUser, verifyCredentials } from "../src/server/users/service";
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
