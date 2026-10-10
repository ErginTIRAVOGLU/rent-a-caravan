import { compare } from "bcryptjs";
import { expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { seed } from "../prisma/seed";
import { makeListing, makeUser, resetDb } from "./helpers/db";

it("seed: 4 kullanıcı (1 admin), 2 ACTIVE + 1 PENDING ilan oluşturur", async () => {
  await resetDb();
  await seed();

  expect(await prisma.user.count()).toBe(4);
  expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(1);
  expect(await prisma.listing.count({ where: { status: "ACTIVE" } })).toBe(2);
  expect(await prisma.listing.count({ where: { status: "PENDING" } })).toBe(1);
});

it("seed kullanıcıları demo1234 ile giriş yapabilir (hashlenmiş)", async () => {
  await resetDb();
  await seed();

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@karavan.test" },
  });
  expect(admin.passwordHash).toBeTruthy();
  expect(admin.passwordHash).not.toBe("demo1234");
  expect(await compare("demo1234", admin.passwordHash ?? "")).toBe(true);
  expect(await compare("yanlis-sifre", admin.passwordHash ?? "")).toBe(false);
});

it("makeUser/makeListing varsayılan fabrika değerleriyle kayıt oluşturur", async () => {
  await resetDb();

  const user = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({ data: makeListing(user.id) });

  expect(user.role).toBe("USER");
  expect(listing.nightlyPrice.toNumber()).toBe(1500);
  expect(listing.capacity).toBe(4);
  expect(listing.vehicleType).toBe("PANELVAN");
  expect(listing.status).toBe("ACTIVE");
});
