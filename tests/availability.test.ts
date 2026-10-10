import type { BookingRequestStatus } from "@prisma/client";
import { expect, it } from "vitest";

import { findApprovedOverlap } from "../src/lib/availability";
import { prisma } from "../src/lib/prisma";
import { makeListing, makeUser, resetDb } from "./helpers/db";

// findApprovedOverlap — T8 arama filtresiyle BİREBİR aynı predicate:
//   status IN (APPROVED, COMPLETED) AND startDate < bitis AND endDate > baslangic
// Yarım-open aralıklar nedeniyle bitişik tarihler (çıkış = giriş) çakışmaz.

/** YYYY-MM-DD → UTC gece yarısı Date (@db.Date kolonuyla birebir). */
function utcDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

type Seed = {
  ownerId: string;
  listingId: string;
  renterId: string;
};

/** Sahipli ilan + kiracı; her test kendi çakışma kayıtlarını kendisi kurar. */
async function seed(): Promise<Seed> {
  const owner = await prisma.user.create({ data: makeUser() });
  const renter = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({ data: makeListing(owner.id) });
  return { ownerId: owner.id, listingId: listing.id, renterId: renter.id };
}

async function createRequest(
  s: Seed,
  startDate: string,
  endDate: string,
  status: BookingRequestStatus,
  listingId: string = s.listingId,
) {
  return prisma.bookingRequest.create({
    data: {
      listingId,
      renterId: s.renterId,
      startDate: utcDate(startDate),
      endDate: utcDate(endDate),
      guests: 2,
      totalPrice: 6000,
      status,
    },
  });
}

it("üst üste binen APPROVED aralıkta findApprovedOverlap kayıt döner", async () => {
  await resetDb();
  const s = await seed();
  const approved = await createRequest(s, "2030-06-10", "2030-06-14", "APPROVED");

  // Tam örtüşme
  await expect(
    findApprovedOverlap(prisma, s.listingId, "2030-06-10", "2030-06-14"),
  ).resolves.toEqual({ id: approved.id });
  // Sağdan kısmi örtüşme (yeni giriş, mevcut çıkıştan önce)
  await expect(
    findApprovedOverlap(prisma, s.listingId, "2030-06-12", "2030-06-16"),
  ).resolves.toEqual({ id: approved.id });
  // Soldan kısmi örtüşme (yeni çıkış, mevcut girişten sonra)
  await expect(
    findApprovedOverlap(prisma, s.listingId, "2030-06-06", "2030-06-11"),
  ).resolves.toEqual({ id: approved.id });
  // Date girdisi de kabul edilir (service DB'den okuduğu tarihleri geçirir)
  await expect(
    findApprovedOverlap(
      prisma,
      s.listingId,
      utcDate("2030-06-10"),
      utcDate("2030-06-14"),
    ),
  ).resolves.toEqual({ id: approved.id });
});

it("bitişik tarihler (çıkış=giriş) findApprovedOverlap null döner", async () => {
  await resetDb();
  const s = await seed();
  await createRequest(s, "2030-06-10", "2030-06-14", "APPROVED");

  // Yeni konaklama mevcut çıkıştan başlıyor (14 = 14)
  await expect(
    findApprovedOverlap(prisma, s.listingId, "2030-06-14", "2030-06-18"),
  ).resolves.toBeNull();
  // Yeni konaklama mevcut girişte bitiyor (10 = 10)
  await expect(
    findApprovedOverlap(prisma, s.listingId, "2030-06-06", "2030-06-10"),
  ).resolves.toBeNull();
});

it("PENDING/REJECTED/CANCELLED kayıtlar çakışma sayılmaz", async () => {
  await resetDb();
  const s = await seed();
  await createRequest(s, "2030-06-10", "2030-06-14", "PENDING");
  await createRequest(s, "2030-06-10", "2030-06-14", "REJECTED");
  await createRequest(s, "2030-06-10", "2030-06-14", "CANCELLED");

  await expect(
    findApprovedOverlap(prisma, s.listingId, "2030-06-12", "2030-06-16"),
  ).resolves.toBeNull();
});

it("COMPLETED kaydı da tarihleri bloklar (T8 predicate)", async () => {
  await resetDb();
  const s = await seed();
  const completed = await createRequest(
    s,
    "2030-06-10",
    "2030-06-14",
    "COMPLETED",
  );

  await expect(
    findApprovedOverlap(prisma, s.listingId, "2030-06-12", "2030-06-16"),
  ).resolves.toEqual({ id: completed.id });
});

it("farklı ilanın kaydı ve hariç tutulan kendi kaydı eşleşmez", async () => {
  await resetDb();
  const s = await seed();
  const other = await prisma.listing.create({
    data: makeListing(s.ownerId, { title: "Diğer İlan" }),
  });

  // Yalnız aranan ilanın kayıtları değerlendirilir
  await createRequest(s, "2030-06-10", "2030-06-14", "APPROVED", other.id);
  await expect(
    findApprovedOverlap(prisma, s.listingId, "2030-06-12", "2030-06-16"),
  ).resolves.toBeNull();

  // excludeId: kendi kaydı (ör. yeniden girilen onay) sayılmaz
  const own = await createRequest(s, "2030-06-10", "2030-06-14", "APPROVED");
  await expect(
    findApprovedOverlap(prisma, s.listingId, "2030-06-12", "2030-06-16", own.id),
  ).resolves.toBeNull();
  await expect(
    findApprovedOverlap(prisma, s.listingId, "2030-06-12", "2030-06-16"),
  ).resolves.toEqual({ id: own.id });
});
