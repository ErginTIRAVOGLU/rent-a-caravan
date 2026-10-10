import { expect, it } from "vitest";

import { prisma } from "../src/lib/prisma";
import {
  createListingCore,
  deleteListingCore,
  submitListingCore,
  updateListingCore,
} from "../src/server/listings/service";
import type { SessionUser } from "../src/server/users/service";
import { makeListing, makeUser, resetDb } from "./helpers/db";

/** DB'den oluşturulan kullanıcıyı service'in beklediği oturum kimliğine çevirir. */
function session(user: { id: string; name: string; email: string }): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "USER",
    isBanned: false,
  };
}

/** Geçerli tam ilan payload'ı (create/update için). */
function listingPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Orman Karavanı Bolu",
    description:
      "Bolu ormanlarında, dört mevsim kullanılabilen tam donanımlı karavan ilanı.",
    city: "Bolu",
    district: "Mudurnu",
    nightlyPrice: 1800,
    capacity: 4,
    vehicleType: "PANELVAN",
    transmission: "MANUAL",
    fuel: "DIESEL",
    licenseRequired: "B",
    minRentalDays: 3,
    amenities: ["HEATING", "FRIDGE"],
    photoUrls: ["https://cdn.karavan.test/ilan/ana.jpg"],
    ...overrides,
  };
}

it("createListingCore owner=user.id ve status=DRAFT yazar (payload'da status/ownerId gelse bile)", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const foreign = await prisma.user.create({ data: makeUser() });

  // İstemci sahtekârlığı: istemci ACTIVE + başkasının ownerId'si gönderiyor.
  const result = await createListingCore(
    session(owner),
    listingPayload({ status: "ACTIVE", ownerId: foreign.id }),
  );

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.data.ownerId).toBe(owner.id);
    expect(result.data.status).toBe("DRAFT");
    expect(result.data.id).toBeTruthy();
  }
  // DB'de de sunucu değerleri yazıldı
  const saved = await prisma.listing.findFirstOrThrow({
    where: { ownerId: owner.id },
  });
  expect(saved.ownerId).toBe(owner.id);
  expect(saved.status).toBe("DRAFT");
  // Yabancı kullanıcıda hiçbir ilan oluşmadı
  expect(
    await prisma.listing.count({ where: { ownerId: foreign.id } }),
  ).toBe(0);
});

it("başkasının ilanını update/delete eden kullanıcı fail alır (yetkiniz yok), ilan değişmez", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const intruder = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({ data: makeListing(owner.id) });

  const updateResult = await updateListingCore(
    session(intruder),
    listing.id,
    listingPayload({ title: "Ele geçirilen başlık" }),
  );
  expect(updateResult.ok).toBe(false);
  if (!updateResult.ok) {
    expect(updateResult.error).toContain("yetkiniz yok");
  }

  const deleteResult = await deleteListingCore(session(intruder), listing.id);
  expect(deleteResult.ok).toBe(false);
  if (!deleteResult.ok) {
    expect(deleteResult.error).toContain("yetkiniz yok");
  }

  // İlan hiç değişmedi
  const unchanged = await prisma.listing.findUniqueOrThrow({
    where: { id: listing.id },
  });
  expect(unchanged.title).toBe("Test İlanı");
  expect(unchanged.ownerId).toBe(owner.id);
});

it("kendi ilanını güncelleyebilir (status/ownerId yine istemciden gelmez)", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const foreign = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, { status: "DRAFT" }),
  });

  const result = await updateListingCore(session(owner), listing.id, {
    title: "Güncellenen Karavan Başlığı",
    nightlyPrice: 2200,
    status: "ACTIVE", // istemciden gelen status yok sayılır
    ownerId: foreign.id, // istemciden gelen ownerId yok sayılır
  });

  expect(result.ok).toBe(true);
  const saved = await prisma.listing.findUniqueOrThrow({
    where: { id: listing.id },
  });
  expect(saved.title).toBe("Güncellenen Karavan Başlığı");
  expect(Number(saved.nightlyPrice)).toBe(2200);
  expect(saved.status).toBe("DRAFT"); // durum yalnız sunucu tarafından belirlenir
  expect(saved.ownerId).toBe(owner.id); // sahiplik asla değişmez
});

it("kendi ilanını silebilir", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({ data: makeListing(owner.id) });

  const result = await deleteListingCore(session(owner), listing.id);

  expect(result.ok).toBe(true);
  expect(await prisma.listing.findUnique({ where: { id: listing.id } })).toBeNull();
});

it("delete: beklemede/onaylı/tamamlanmış rezervasyonu olan ilan silinemez (cascade koruması)", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const renter = await prisma.user.create({ data: makeUser() });

  // Her durum için ayrı ilan: PENDING, APPROVED, COMPLETED silmeyi engeller.
  for (const [index, status] of (
    ["PENDING", "APPROVED", "COMPLETED"] as const
  ).entries()) {
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { title: `Rezervasyonlu İlan ${index}` }),
    });
    await prisma.bookingRequest.create({
      data: {
        listingId: listing.id,
        renterId: renter.id,
        startDate: new Date(`2030-0${index + 6}-10T00:00:00.000Z`),
        endDate: new Date(`2030-0${index + 6}-14T00:00:00.000Z`),
        guests: 2,
        totalPrice: 6000,
        status,
      },
    });

    const result = await deleteListingCore(session(owner), listing.id);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("rezervasyon");
    }
    // İlan ve rezervasyon kaydı yerinde durur (mutation yok)
    expect(
      await prisma.listing.findUnique({ where: { id: listing.id } }),
    ).not.toBeNull();
    expect(
      await prisma.bookingRequest.count({ where: { listingId: listing.id } }),
    ).toBe(1);
  }
});

it("delete: yalnız reddedilmiş/iptal edilmiş talepleri olan ilan silinebilir", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const renter = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({ data: makeListing(owner.id) });
  for (const [index, status] of (
    ["REJECTED", "CANCELLED"] as const
  ).entries()) {
    await prisma.bookingRequest.create({
      data: {
        listingId: listing.id,
        renterId: renter.id,
        startDate: new Date(`2030-0${index + 6}-10T00:00:00.000Z`),
        endDate: new Date(`2030-0${index + 6}-14T00:00:00.000Z`),
        guests: 2,
        totalPrice: 6000,
        status,
      },
    });
  }

  const result = await deleteListingCore(session(owner), listing.id);

  expect(result.ok).toBe(true);
  expect(await prisma.listing.findUnique({ where: { id: listing.id } })).toBeNull();
});

it("submitListing DRAFT ilanı PENDING yapar; REJECTED ve PAUSED ilan tekrar gönderilebilir", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const draft = await prisma.listing.create({
    data: makeListing(owner.id, {
      status: "DRAFT",
      photoUrls: ["https://cdn.karavan.test/ilan/1.jpg"],
    }),
  });
  const rejected = await prisma.listing.create({
    data: makeListing(owner.id, {
      status: "REJECTED",
      rejectionReason: "Fotoğraf kalitesi düşük",
      photoUrls: ["https://cdn.karavan.test/ilan/2.jpg"],
    }),
  });
  // PAUSED → PENDING: duraklatılmış ilanın TEK çıkış yolu sahip submit'idir
  // (geniş inceleme düzeltmesi — e-posta kopyası bu akışa atıf yapar).
  const paused = await prisma.listing.create({
    data: makeListing(owner.id, {
      status: "PAUSED",
      photoUrls: ["https://cdn.karavan.test/ilan/3.jpg"],
    }),
  });

  const draftResult = await submitListingCore(session(owner), draft.id);
  expect(draftResult.ok).toBe(true);
  expect(
    (await prisma.listing.findUniqueOrThrow({ where: { id: draft.id } })).status,
  ).toBe("PENDING");

  const rejectedResult = await submitListingCore(session(owner), rejected.id);
  expect(rejectedResult.ok).toBe(true);
  const rejectedSaved = await prisma.listing.findUniqueOrThrow({
    where: { id: rejected.id },
  });
  expect(rejectedSaved.status).toBe("PENDING");
  expect(rejectedSaved.rejectionReason).toBeNull(); // eski gerekçe temizlenir

  const pausedResult = await submitListingCore(session(owner), paused.id);
  expect(pausedResult.ok).toBe(true);
  expect(
    (await prisma.listing.findUniqueOrThrow({ where: { id: paused.id } })).status,
  ).toBe("PENDING");
});

it("fotoğrafsız submit fail döner, ilan DRAFT kalır", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const draft = await prisma.listing.create({
    data: makeListing(owner.id, { status: "DRAFT", photoUrls: [] }),
  });

  const result = await submitListingCore(session(owner), draft.id);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain("fotoğraf");
  }
  expect(
    (await prisma.listing.findUniqueOrThrow({ where: { id: draft.id } })).status,
  ).toBe("DRAFT");
});

it("geçersiz ilan id'si (çöp/metin) Prisma'ya ulaşmadan fail döner", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });

  for (const badId of ["not-a-cuid", "", "DROP TABLE listings;--", "c"]) {
    const update = await updateListingCore(session(owner), badId, { title: "X" });
    expect(update.ok).toBe(false);
    if (!update.ok) expect(update.error).toContain("Geçersiz ilan kimliği");

    const del = await deleteListingCore(session(owner), badId);
    expect(del.ok).toBe(false);
    if (!del.ok) expect(del.error).toContain("Geçersiz ilan kimliği");

    const submit = await submitListingCore(session(owner), badId);
    expect(submit.ok).toBe(false);
    if (!submit.ok) expect(submit.error).toContain("Geçersiz ilan kimliği");
  }
});

it("submitListing yalnız DRAFT/REJECTED/PAUSED ilanı gönderir (ACTIVE yeniden gönderilemez)", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const active = await prisma.listing.create({
    data: makeListing(owner.id, {
      status: "ACTIVE",
      photoUrls: ["https://cdn.karavan.test/ilan/1.jpg"],
    }),
  });

  const result = await submitListingCore(session(owner), active.id);

  expect(result.ok).toBe(false);
  expect(
    (await prisma.listing.findUniqueOrThrow({ where: { id: active.id } })).status,
  ).toBe("ACTIVE");
});
