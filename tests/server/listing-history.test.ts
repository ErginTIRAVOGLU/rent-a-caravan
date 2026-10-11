import { expect, it } from "vitest";

import { prisma } from "../../src/lib/prisma";
import {
  approveListingCore,
  pauseListingCore,
  rejectListingCore,
  unpauseListingCore,
} from "../../src/server/admin/service";
import { submitListingCore } from "../../src/server/listings/service";
import type { SessionUser } from "../../src/server/users/service";
import { makeListing, makeUser, resetDb } from "../helpers/db";

// HER durum geçişinde ListingStatusHistory satırı: admin
// approve/reject/pause/unpause + owner submit. actor = işlemi yapan user id,
// reason yalnız gerekçeli geçişte (reject).

function adminSession(user: {
  id: string;
  name: string;
  email: string;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "ADMIN",
    isBanned: false,
  };
}

function userSession(user: {
  id: string;
  name: string;
  email: string;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "USER",
    isBanned: false,
  };
}

it("admin approve (PENDING→ACTIVE) history yazar, actor=admin", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, { status: "PENDING" }),
  });

  const result = await approveListingCore(adminSession(admin), listing.id);

  expect(result.ok).toBe(true);
  const history = await prisma.listingStatusHistory.findMany({
    where: { listingId: listing.id },
  });
  expect(history).toHaveLength(1);
  expect(history[0].fromStatus).toBe("PENDING");
  expect(history[0].toStatus).toBe("ACTIVE");
  expect(history[0].actorId).toBe(admin.id);
  expect(history[0].reason).toBeNull();
});

it("admin reject (PENDING→REJECTED) history yazar, reason korunur", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, { status: "PENDING" }),
  });

  const result = await rejectListingCore(
    adminSession(admin),
    listing.id,
    "Fotoğraflar yetersiz.",
  );

  expect(result.ok).toBe(true);
  const history = await prisma.listingStatusHistory.findMany({
    where: { listingId: listing.id },
  });
  expect(history).toHaveLength(1);
  expect(history[0].fromStatus).toBe("PENDING");
  expect(history[0].toStatus).toBe("REJECTED");
  expect(history[0].actorId).toBe(admin.id);
  expect(history[0].reason).toBe("Fotoğraflar yetersiz.");
});

it("admin pause/unpause (ACTIVE→PAUSED→ACTIVE) iki history satırı yazar", async () => {
  await resetDb();
  const admin = await prisma.user.create({
    data: makeUser({ role: "ADMIN" }),
  });
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, { status: "ACTIVE" }),
  });

  expect((await pauseListingCore(adminSession(admin), listing.id)).ok).toBe(
    true,
  );
  expect((await unpauseListingCore(adminSession(admin), listing.id)).ok).toBe(
    true,
  );

  const history = await prisma.listingStatusHistory.findMany({
    where: { listingId: listing.id },
    orderBy: { createdAt: "asc" },
  });
  expect(history).toHaveLength(2);
  expect([history[0].fromStatus, history[0].toStatus]).toEqual([
    "ACTIVE",
    "PAUSED",
  ]);
  expect([history[1].fromStatus, history[1].toStatus]).toEqual([
    "PAUSED",
    "ACTIVE",
  ]);
  expect(history[0].actorId).toBe(admin.id);
});

it("owner submit (DRAFT→PENDING) history yazar, actor=owner", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, {
      status: "DRAFT",
      photoUrls: ["https://cdn.karavan.test/ilan/1.jpg"],
    }),
  });

  const result = await submitListingCore(userSession(owner), listing.id);

  expect(result.ok).toBe(true);
  const history = await prisma.listingStatusHistory.findMany({
    where: { listingId: listing.id },
  });
  expect(history).toHaveLength(1);
  expect(history[0].fromStatus).toBe("DRAFT");
  expect(history[0].toStatus).toBe("PENDING");
  expect(history[0].actorId).toBe(owner.id);
});

it("başarısız geçiş history yazmaz (ACTIVE submit fail)", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, {
      status: "ACTIVE",
      photoUrls: ["https://cdn.karavan.test/ilan/1.jpg"],
    }),
  });

  const result = await submitListingCore(userSession(owner), listing.id);

  expect(result.ok).toBe(false);
  expect(
    await prisma.listingStatusHistory.count({
      where: { listingId: listing.id },
    }),
  ).toBe(0);
});
