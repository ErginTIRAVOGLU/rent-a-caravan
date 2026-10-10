import type { BookingRequestStatus } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";

// E-posta olayları mock'lanır: akış asla gerçek SMTP'ye gitmez; ayrıca
// "e-posta düşürse bile kayıt kalır" testi için fırlatma enjekte edilir.
vi.mock("../src/lib/email/events", () => ({
  sendBookingRequested: vi.fn(),
  sendBookingStatusChanged: vi.fn(),
}));

import {
  sendBookingRequested,
  sendBookingStatusChanged,
} from "../src/lib/email/events";
import { prisma } from "../src/lib/prisma";
import {
  approveBookingCore,
  cancelBookingCore,
  createBookingCore,
  rejectBookingCore,
} from "../src/server/bookings/service";
import type { SessionUser } from "../src/server/users/service";
import { makeListing, makeUser, resetDb } from "./helpers/db";

// Rezervasyon akışı — Review Focus: sunucu otoriter fiyat/durum, yetki matrisi,
// mükerrer talep, PARALEL ONAY YARIŞI (advisory lock + kilit sonrasi okuma).

beforeEach(() => {
  vi.clearAllMocks();
});

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

/** YYYY-MM-DD → UTC gece yarısı Date (@db.Date kolonuyla birebir). */
function utcDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

type Seed = {
  owner: { id: string; name: string; email: string };
  renter: { id: string; name: string; email: string };
  listing: { id: string };
  booking: { id: string };
};

/** Sahip + kiracı + ACTIVE ilan + varsayılan PENDING talep ([2030-06-10, 2030-06-14)). */
async function seedBooking(): Promise<Seed> {
  const owner = await prisma.user.create({ data: makeUser() });
  const renter = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({ data: makeListing(owner.id) });
  const booking = await prisma.bookingRequest.create({
    data: {
      listingId: listing.id,
      renterId: renter.id,
      startDate: utcDate("2030-06-10"),
      endDate: utcDate("2030-06-14"),
      guests: 2,
      totalPrice: 6000,
    },
  });
  return { owner, renter, listing, booking };
}

/** Aynı ilanda ek talep kurmak için (durum/tarih seçilebilir). */
async function createRequest(
  s: Seed,
  startDate: string,
  endDate: string,
  status: BookingRequestStatus = "PENDING",
  renterId?: string,
) {
  return prisma.bookingRequest.create({
    data: {
      listingId: s.listing.id,
      renterId: renterId ?? s.renter.id,
      startDate: utcDate(startDate),
      endDate: utcDate(endDate),
      guests: 2,
      totalPrice: 6000,
      status,
    },
  });
}

// ---------------------------------------------------------------------------
// createBookingCore
// ---------------------------------------------------------------------------

it("create: sunucu fiyatını yazar — payload'daki totalPrice:1 yok sayılır", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const renter = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, { nightlyPrice: 1500 }),
  });

  // İstemci sahtekârlığı: 4 gece × 1500 = 6000 yerine 1 gönderiyor.
  const result = await createBookingCore(session(renter), {
    listingId: listing.id,
    startDate: "2030-06-10",
    endDate: "2030-06-14",
    guests: 2,
    totalPrice: 1,
  });

  expect(result.ok).toBe(true);
  const saved = await prisma.bookingRequest.findFirstOrThrow({
    where: { listingId: listing.id },
  });
  expect(Number(saved.totalPrice)).toBe(6000); // sunucu otoriter: 4 × 1500
  expect(Number(saved.totalPrice)).not.toBe(1);
});

it("create: status/renterId payload alanları yok sayılır, status her zaman PENDING", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const renter = await prisma.user.create({ data: makeUser() });
  const intruder = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({ data: makeListing(owner.id) });

  const result = await createBookingCore(session(renter), {
    listingId: listing.id,
    startDate: "2030-06-10",
    endDate: "2030-06-14",
    guests: 2,
    status: "APPROVED", // istemciden gelen durum okunmaz
    renterId: intruder.id, // yabancı kimlik okunmaz
    ownerId: intruder.id,
  });

  expect(result.ok).toBe(true);
  const saved = await prisma.bookingRequest.findFirstOrThrow({
    where: { listingId: listing.id },
  });
  expect(saved.status).toBe("PENDING");
  expect(saved.renterId).toBe(renter.id);
});

it("create: aynı kiracı aynı ilana ikinci PENDING talep oluşturamaz", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const renter = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({ data: makeListing(owner.id) });
  const input = {
    listingId: listing.id,
    startDate: "2030-06-10",
    endDate: "2030-06-14",
    guests: 2,
  };

  const first = await createBookingCore(session(renter), input);
  expect(first.ok).toBe(true);

  // Farklı tarihlerle bile aynı ilana ikinci BEKLEYEN talep yok
  const second = await createBookingCore(session(renter), {
    ...input,
    startDate: "2030-07-01",
    endDate: "2030-07-05",
  });

  expect(second.ok).toBe(false);
  if (!second.ok) {
    expect(second.error).toContain("zaten bekleyen");
  }
  expect(
    await prisma.bookingRequest.count({
      where: { listingId: listing.id, renterId: renter.id },
    }),
  ).toBe(1);
});

it("create: minRentalDays/kapasite ihlali fail döner (T4 kuralları)", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const renter = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, { minRentalDays: 3, capacity: 4 }),
  });

  const tooShort = await createBookingCore(session(renter), {
    listingId: listing.id,
    startDate: "2030-06-10",
    endDate: "2030-06-12", // 2 gece < 3 gece minimum
    guests: 2,
  });
  expect(tooShort.ok).toBe(false);
  if (!tooShort.ok) {
    expect(tooShort.error).toContain("En az 3 gece");
    expect(tooShort.field).toBe("endDate");
  }

  const tooMany = await createBookingCore(session(renter), {
    listingId: listing.id,
    startDate: "2030-06-10",
    endDate: "2030-06-14",
    guests: 5, // kapasite 4
  });
  expect(tooMany.ok).toBe(false);
  if (!tooMany.ok) {
    expect(tooMany.error).toContain("En fazla 4 kişi");
    expect(tooMany.field).toBe("guests");
  }

  expect(await prisma.bookingRequest.count()).toBe(0); // yazılmadı
});

it("create: başarılı olunca sendBookingRequested çağrılır (mock)", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const renter = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({ data: makeListing(owner.id) });

  const result = await createBookingCore(session(renter), {
    listingId: listing.id,
    startDate: "2030-06-10",
    endDate: "2030-06-14",
    guests: 2,
    message: "Merhaba, müsait misiniz?",
  });

  expect(result.ok).toBe(true);
  expect(sendBookingRequested).toHaveBeenCalledTimes(1);
  expect(sendBookingStatusChanged).not.toHaveBeenCalled();

  const [to, data] = vi.mocked(sendBookingRequested).mock.calls[0];
  expect(to).toBe(renter.email);
  expect(data.renterName).toBe(renter.name);
  expect(data.listingTitle).toBe(listing.title);
  // Tarihler UTC gece yarısı Date (@db.Date sözleşmesi, string DEĞİL)
  expect(data.startDate).toBeInstanceOf(Date);
  expect(data.endDate).toBeInstanceOf(Date);
  expect(data.startDate.toISOString()).toBe("2030-06-10T00:00:00.000Z");
  expect(data.endDate.toISOString()).toBe("2030-06-14T00:00:00.000Z");
});

it("create: kendi ilanına talep fail döner, kayıt oluşmaz", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({ data: makeListing(owner.id) });

  const result = await createBookingCore(session(owner), {
    listingId: listing.id,
    startDate: "2030-06-10",
    endDate: "2030-06-14",
    guests: 2,
  });

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain("Kendi ilanınıza");
  }
  expect(await prisma.bookingRequest.count()).toBe(0);
});

it("create: ACTIVE olmayan ilanla talep fail döner", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const renter = await prisma.user.create({ data: makeUser() });
  const draft = await prisma.listing.create({
    data: makeListing(owner.id, { status: "DRAFT" }),
  });

  const result = await createBookingCore(session(renter), {
    listingId: draft.id,
    startDate: "2030-06-10",
    endDate: "2030-06-14",
    guests: 2,
  });

  expect(result.ok).toBe(false);
  expect(await prisma.bookingRequest.count()).toBe(0);
});

it("create: çakışan APPROVED tarihlerle bile talep oluşur (kilitlenme ONAY aşamasında)", async () => {
  await resetDb();
  const s = await seedBooking();
  await createRequest(s, "2030-06-10", "2030-06-14", "APPROVED");
  const other = await prisma.user.create({ data: makeUser() });

  // Airbnb modeli: kiracı talep gönderebilir; takvim çakışmasını SAHİP
  // onaylarken yakalar (approveBookingCore findApprovedOverlap çağırır).
  const result = await createBookingCore(session(other), {
    listingId: s.listing.id,
    startDate: "2030-06-12",
    endDate: "2030-06-16",
    guests: 2,
  });

  expect(result.ok).toBe(true);
});

it("dakikada 5. sonrası fail", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const renter = await prisma.user.create({ data: makeUser() });
  // Her talep farklı ilana gider ki mükerrer-talep kuralı devreye girmesin:
  // sınır yalnızca HIZDAN düşmeli.
  const listings = [];
  for (let i = 0; i < 6; i++) {
    listings.push(await prisma.listing.create({ data: makeListing(owner.id) }));
  }
  const input = (listingId: string) => ({
    listingId,
    startDate: "2030-06-10",
    endDate: "2030-06-14",
    guests: 2,
  });

  for (const listing of listings.slice(0, 5)) {
    const result = await createBookingCore(session(renter), input(listing.id));
    expect(result.ok).toBe(true);
  }

  const blocked = await createBookingCore(session(renter), input(listings[5].id));

  expect(blocked.ok).toBe(false);
  if (!blocked.ok) {
    expect(blocked.error).toBe("Çok fazla istek gönderdiniz, biraz bekleyin");
  }
  expect(await prisma.bookingRequest.count()).toBe(5); // 6. yazılmadı
});

// ---------------------------------------------------------------------------
// approveBookingCore — KRİTİK YARIŞ
// ---------------------------------------------------------------------------

it("approve: paralel yarışta tek kazanan — Promise.all iki onay, DB'de tek APPROVED, diğeri hata", async () => {
  await resetDb();
  const s = await seedBooking();

  // İki AYRI oturum nesnesi, iki AYRI transaction (farklı havuz bağlantıları):
  // adaylar aynı anda kilit ister; kilidi tutan kazanır, diğeri kilit sonrası
  // taze okumada APPROVED görüp yazmadan geri döner.
  const [first, second] = await Promise.all([
    approveBookingCore(session(s.owner), s.booking.id),
    approveBookingCore(session(s.owner), s.booking.id),
  ]);

  const results = [first, second];
  const winners = results.filter((r) => r.ok);
  const losers = results.filter((r) => !r.ok);
  expect(winners.length).toBe(1);
  expect(losers.length).toBe(1);
  if (!losers[0].ok) {
    expect(losers[0].error).toContain("karara bağlanmış");
  }

  const approvedCount = await prisma.bookingRequest.count({
    where: { listingId: s.listing.id, status: "APPROVED" },
  });
  expect(approvedCount).toBe(1);
  expect(await prisma.bookingRequest.count({ where: { listingId: s.listing.id } })).toBe(1);
  const final = await prisma.bookingRequest.findUniqueOrThrow({
    where: { id: s.booking.id },
  });
  expect(final.status).toBe("APPROVED");
}, 15_000);

it("approve: ikinci kez onay (durum zaten APPROVED) fail döner — idempotency guard", async () => {
  await resetDb();
  const s = await seedBooking();

  const first = await approveBookingCore(session(s.owner), s.booking.id);
  expect(first.ok).toBe(true);

  const second = await approveBookingCore(session(s.owner), s.booking.id);
  expect(second.ok).toBe(false);
  if (!second.ok) {
    expect(second.error).toContain("karara bağlanmış");
  }
  // Tek satır, tek durum — mükerrer onay yazım yok
  expect(
    await prisma.bookingRequest.count({ where: { listingId: s.listing.id } }),
  ).toBe(1);
});

it("approve: bitişik tarihler ikinci onayı da başarılı", async () => {
  await resetDb();
  const s = await seedBooking();
  const neighbor = await prisma.user.create({ data: makeUser() });
  // Temel talep önce onaylanır: [10, 14) kesinleşmiş aralık…
  const base = await approveBookingCore(session(s.owner), s.booking.id);
  expect(base.ok).toBe(true);
  // …bitişik konaklama [14, 18) — çıkış=giriş ÇAKIŞMAZ, onay gerekir.
  const adjacent = await createRequest(
    s,
    "2030-06-14",
    "2030-06-18",
    "PENDING",
    neighbor.id,
  );

  const result = await approveBookingCore(session(s.owner), adjacent.id);

  expect(result.ok).toBe(true);
  const saved = await prisma.bookingRequest.findUniqueOrThrow({
    where: { id: adjacent.id },
  });
  expect(saved.status).toBe("APPROVED");
});

it("approve: çakışan tarihler reddedilir — fail, durum PENDING kalır", async () => {
  await resetDb();
  const s = await seedBooking();
  const other = await prisma.user.create({ data: makeUser() });
  // Temel talep önce onaylanır: [10, 14) kesinleşmiş aralık…
  const base = await approveBookingCore(session(s.owner), s.booking.id);
  expect(base.ok).toBe(true);
  // …üzerine binen talep [12, 16) çakışır ve ONAYLANAMAZ.
  const overlapping = await createRequest(
    s,
    "2030-06-12",
    "2030-06-16",
    "PENDING",
    other.id,
  );

  const result = await approveBookingCore(session(s.owner), overlapping.id);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain("artık dolu");
  }
  const saved = await prisma.bookingRequest.findUniqueOrThrow({
    where: { id: overlapping.id },
  });
  expect(saved.status).toBe("PENDING");
  expect(sendBookingStatusChanged).toHaveBeenCalledTimes(1); // yalnız temel onay
});

it("approve: sahip olmayan kullanıcı fail, durum değişmez", async () => {
  await resetDb();
  const s = await seedBooking();
  const intruder = await prisma.user.create({ data: makeUser() });

  const result = await approveBookingCore(session(intruder), s.booking.id);

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain("yetkiniz yok");
  }
  const saved = await prisma.bookingRequest.findUniqueOrThrow({
    where: { id: s.booking.id },
  });
  expect(saved.status).toBe("PENDING");
  expect(sendBookingStatusChanged).not.toHaveBeenCalled();
});

it("approve: email client hata fırlatsa da kayıt APPROVED kalır", async () => {
  await resetDb();
  const s = await seedBooking();
  vi.mocked(sendBookingStatusChanged).mockImplementationOnce(() => {
    throw new Error("SMTP kapalı");
  });

  const result = await approveBookingCore(session(s.owner), s.booking.id);

  expect(result.ok).toBe(true); // e-posta HATASI action'ı düşürmez
  const saved = await prisma.bookingRequest.findUniqueOrThrow({
    where: { id: s.booking.id },
  });
  expect(saved.status).toBe("APPROVED");
});

// ---------------------------------------------------------------------------
// rejectBookingCore
// ---------------------------------------------------------------------------

it("reject: gerekçe kaydedilir, REJECTED + mail", async () => {
  await resetDb();
  const s = await seedBooking();

  const result = await rejectBookingCore(
    session(s.owner),
    s.booking.id,
    "Tarihler bana uymuyor",
  );

  expect(result.ok).toBe(true);
  const saved = await prisma.bookingRequest.findUniqueOrThrow({
    where: { id: s.booking.id },
  });
  expect(saved.status).toBe("REJECTED");
  expect(saved.rejectionReason).toBe("Tarihler bana uymuyor");

  expect(sendBookingStatusChanged).toHaveBeenCalledTimes(1);
  const [to, data] = vi.mocked(sendBookingStatusChanged).mock.calls[0];
  expect(to).toBe(s.renter.email); // bildirim kiracıya gider
  expect(data.status).toBe("REJECTED");
  expect(data.reason).toBe("Tarihler bana uymuyor");
  expect(data.listingTitle).toBe("Test İlanı");
  expect(data.startDate).toBeInstanceOf(Date);
  expect(sendBookingRequested).not.toHaveBeenCalled();
});

it("reject: gerekçesiz ret rejectionReason yazmaz; sahip olmayan fail", async () => {
  await resetDb();
  const s = await seedBooking();
  const intruder = await prisma.user.create({ data: makeUser() });

  const denied = await rejectBookingCore(session(intruder), s.booking.id);
  expect(denied.ok).toBe(false);
  if (!denied.ok) {
    expect(denied.error).toContain("yetkiniz yok");
  }
  expect(
    (await prisma.bookingRequest.findUniqueOrThrow({ where: { id: s.booking.id } }))
      .status,
  ).toBe("PENDING");

  const result = await rejectBookingCore(session(s.owner), s.booking.id);
  expect(result.ok).toBe(true);
  const saved = await prisma.bookingRequest.findUniqueOrThrow({
    where: { id: s.booking.id },
  });
  expect(saved.status).toBe("REJECTED");
  expect(saved.rejectionReason).toBeNull();
  const [, data] = vi.mocked(sendBookingStatusChanged).mock.calls[0];
  expect(data.reason).toBeUndefined();
});

// ---------------------------------------------------------------------------
// cancelBookingCore
// ---------------------------------------------------------------------------

it("cancel: kiracı yalnız PENDING/APPROVED iptal edebilir", async () => {
  await resetDb();
  const s = await seedBooking();
  const approved = await createRequest(s, "2030-07-01", "2030-07-05", "APPROVED");

  const pendingCancel = await cancelBookingCore(session(s.renter), s.booking.id);
  expect(pendingCancel.ok).toBe(true);
  expect(
    (await prisma.bookingRequest.findUniqueOrThrow({ where: { id: s.booking.id } }))
      .status,
  ).toBe("CANCELLED");

  const approvedCancel = await cancelBookingCore(session(s.renter), approved.id);
  expect(approvedCancel.ok).toBe(true);
  expect(
    (await prisma.bookingRequest.findUniqueOrThrow({ where: { id: approved.id } }))
      .status,
  ).toBe("CANCELLED");

  // İptal bir karar bildirimi e-postası tetiklemez (şablon yalnız ONAY/RET)
  expect(sendBookingStatusChanged).not.toHaveBeenCalled();
});

it("cancel: COMPLETED/REJECTED iptal edilemez; sahip olmayan fail", async () => {
  await resetDb();
  const s = await seedBooking();
  const completed = await createRequest(s, "2030-07-01", "2030-07-05", "COMPLETED");
  const rejected = await createRequest(s, "2030-07-10", "2030-07-14", "REJECTED");

  const done = await cancelBookingCore(session(s.renter), completed.id);
  expect(done.ok).toBe(false);
  if (!done.ok) {
    expect(done.error).toContain("iptal edilemez");
  }
  expect(
    (await prisma.bookingRequest.findUniqueOrThrow({ where: { id: completed.id } }))
      .status,
  ).toBe("COMPLETED");

  const rejectedCancel = await cancelBookingCore(session(s.renter), rejected.id);
  expect(rejectedCancel.ok).toBe(false);
  expect(
    (await prisma.bookingRequest.findUniqueOrThrow({ where: { id: rejected.id } }))
      .status,
  ).toBe("REJECTED");

  // İptal yalnız kiracının hakkı: ilan sahibi PENDING bile iptal edemez
  const ownerCancel = await cancelBookingCore(session(s.owner), s.booking.id);
  expect(ownerCancel.ok).toBe(false);
  if (!ownerCancel.ok) {
    expect(ownerCancel.error).toContain("yetkiniz yok");
  }
  expect(
    (await prisma.bookingRequest.findUniqueOrThrow({ where: { id: s.booking.id } }))
      .status,
  ).toBe("PENDING");
});
