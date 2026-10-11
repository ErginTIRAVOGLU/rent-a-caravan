import { compare } from "bcryptjs";
import { expect, it } from "vitest";
import { prisma } from "../src/lib/prisma";
import { updateReportStatusCore } from "../src/server/reports/service";
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

it("seed şikayet id'leri cuid desenindedir — 'İncele' kapıdan geçer", async () => {
  await resetDb();
  await seed();

  const reports = await prisma.report.findMany();
  expect(reports.length).toBeGreaterThan(0);
  const CUID_RE = /^c[a-z0-9]{24}$/;
  for (const report of reports) {
    expect(report.id).toMatch(CUID_RE);
  }

  // Gerçek senaryo: seed'in OPEN şikayeti "İncele" (OPEN → REVIEWING)
  // geçişini kapıda "Geçersiz şikayet kimliği." yemeden yapar.
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@karavan.test" },
  });
  const open = reports.find((r) => r.status === "OPEN");
  expect(open).toBeTruthy();
  const result = await updateReportStatusCore(
    {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: "ADMIN",
      isBanned: false,
    },
    open!.id,
    "REVIEWING",
  );
  expect(result.ok).toBe(true);
});

it("desen dışı (eski seed biçimi) şikayet id'si kapıda reddedilir", async () => {
  await resetDb();
  await seed();

  // Eski satır biçimi DB'ye yazılabilir ama gate Prisma'ya ulaşmadan reddeder.
  const reporter = await prisma.user.findUniqueOrThrow({
    where: { email: "kiraci@karavan.test" },
  });
  const listing = await prisma.listing.findFirstOrThrow();
  await prisma.report.create({
    data: {
      id: "seed-report-1",
      reporterId: reporter.id,
      targetType: "LISTING",
      targetId: listing.id,
      reason: "Eski biçim id ile şikayet.",
    },
  });
  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@karavan.test" },
  });

  const result = await updateReportStatusCore(
    {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: "ADMIN",
      isBanned: false,
    },
    "seed-report-1",
    "REVIEWING",
  );

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain("Geçersiz şikayet kimliği");
  }
});
