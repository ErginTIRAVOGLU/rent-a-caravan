import { expect, it } from "vitest";

import { prisma } from "../../../src/lib/prisma";
import {
  pauseOwnListingCore,
  submitListingCore,
  updateListingCore,
} from "../../../src/server/listings/service";
import type { SessionUser } from "../../../src/server/users/service";
import { makeListing, makeUser, resetDb } from "../../helpers/db";

// Owner duraklatma + PAUSED düzenle/yeniden-gönderim + her geçişte history.
// pauseOwnListingCore: YALNIZ sahip, matris ACTIVE → PAUSED.

function session(user: { id: string; name: string; email: string }): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "USER",
    isBanned: false,
  };
}

it("owner kendi ACTIVE ilanını duraklatır (ACTIVE→PAUSED) + history satırı (actor=owner)", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, {
      status: "ACTIVE",
      photoUrls: ["https://cdn.karavan.test/ilan/1.jpg"],
    }),
  });

  const result = await pauseOwnListingCore(session(owner), listing.id);

  expect(result.ok).toBe(true);
  expect(
    (await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } }))
      .status,
  ).toBe("PAUSED");
  const history = await prisma.listingStatusHistory.findMany({
    where: { listingId: listing.id },
  });
  expect(history).toHaveLength(1);
  expect(history[0].fromStatus).toBe("ACTIVE");
  expect(history[0].toStatus).toBe("PAUSED");
  expect(history[0].actorId).toBe(owner.id);
});

it("owner başkasının ilanını duraklatamaz (yetkiniz yok), ilan ve history değişmez", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const intruder = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, { status: "ACTIVE" }),
  });

  const result = await pauseOwnListingCore(session(intruder), listing.id);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain("yetkiniz yok");
  }
  expect(
    (await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } }))
      .status,
  ).toBe("ACTIVE");
  expect(
    await prisma.listingStatusHistory.count({
      where: { listingId: listing.id },
    }),
  ).toBe(0);
});

it("owner pause yalnız ACTIVE ilanda çalışır (PENDING/DRAFT fail, mutation yok)", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  for (const status of ["PENDING", "DRAFT", "PAUSED"] as const) {
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { status, title: `İlan ${status}` }),
    });

    const result = await pauseOwnListingCore(session(owner), listing.id);

    expect(result.ok).toBe(false);
    expect(
      (await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } }))
        .status,
    ).toBe(status);
  }
});

it("PAUSED ilan sahibi tarafından düzenlenebilir + submit PENDING'e döndürür, her ikisi history'li", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, {
      status: "PAUSED",
      photoUrls: ["https://cdn.karavan.test/ilan/1.jpg"],
    }),
  });

  const updated = await updateListingCore(session(owner), listing.id, {
    title: "Duraklatılmışken güncellenen başlık",
  });
  expect(updated.ok).toBe(true);
  expect(
    (await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } }))
      .title,
  ).toBe("Duraklatılmışken güncellenen başlık");

  const submitted = await submitListingCore(session(owner), listing.id);
  expect(submitted.ok).toBe(true);
  expect(
    (await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } }))
      .status,
  ).toBe("PENDING");

  const history = await prisma.listingStatusHistory.findMany({
    where: { listingId: listing.id },
    orderBy: { createdAt: "asc" },
  });
  expect(history).toHaveLength(1);
  expect(history[0].fromStatus).toBe("PAUSED");
  expect(history[0].toStatus).toBe("PENDING");
  expect(history[0].actorId).toBe(owner.id);
});

it("pauseOwn geçersiz id'de Prisma'ya ulaşmadan fail döner", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });

  const result = await pauseOwnListingCore(session(owner), "bozuk-id");

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain("Geçersiz ilan kimliği");
  }
});
