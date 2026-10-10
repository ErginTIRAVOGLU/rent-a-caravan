import type { BookingRequestStatus } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";

// E-posta olayları mock'lanır: cron akışı asla gerçek SMTP'ye gitmez; ayrıca
// "e-posta hatası çalıştırmayı düşürmez" testi için fırlatma enjekte edilir.
vi.mock("../src/lib/email/events", () => ({
  sendBookingRequested: vi.fn(),
  sendBookingStatusChanged: vi.fn(),
}));

import { GET } from "../src/app/api/cron/complete-bookings/route";
import { sendBookingStatusChanged } from "../src/lib/email/events";
import { prisma } from "../src/lib/prisma";
import { completeDueBookings } from "../src/server/bookings/service";
import { makeListing, makeUser, resetDb } from "./helpers/db";

// Günlük tamamlama cron'u (T11): APPROVED ∧ endDate < bugün(UTC) → COMPLETED,
// commit SONRASI kiracıya e-posta; cron route Bearer CRON_SECRET doğrulaması.

const CRON_URL = "http://localhost/api/cron/complete-bookings";

/** Sabit "şimdi": tarih semantiği deterministik (endDate @db.Date = UTC gece yarısı). */
const NOW = new Date("2026-06-01T10:30:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
});

/** YYYY-MM-DD → UTC gece yarısı Date (@db.Date kolonuyla birebir). */
function utcDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Sahip + kiracı + ACTIVE ilan + durumlu/tarihli talep. */
async function seedBooking(opts: {
  status: BookingRequestStatus;
  startDate: string;
  endDate: string;
}) {
  const owner = await prisma.user.create({ data: makeUser() });
  const renter = await prisma.user.create({ data: makeUser() });
  const listing = await prisma.listing.create({ data: makeListing(owner.id) });
  const booking = await prisma.bookingRequest.create({
    data: {
      listingId: listing.id,
      renterId: renter.id,
      startDate: utcDate(opts.startDate),
      endDate: utcDate(opts.endDate),
      guests: 2,
      totalPrice: 6000,
      status: opts.status,
    },
  });
  return { owner, renter, listing, booking };
}

// ---------------------------------------------------------------------------
// completeDueBookings
// ---------------------------------------------------------------------------

it("bitiş tarihi geçen APPROVED kayıtları COMPLETED yapar, sayıyı döner", async () => {
  await resetDb();
  const a = await seedBooking({
    status: "APPROVED",
    startDate: "2026-05-01",
    endDate: "2026-05-05",
  });
  const b = await seedBooking({
    status: "APPROVED",
    startDate: "2026-05-10",
    endDate: "2026-05-12",
  });

  const count = await completeDueBookings(NOW);

  expect(count).toBe(2);
  const statuses = await prisma.bookingRequest.findMany({
    select: { status: true },
  });
  expect(statuses.map((r) => r.status)).toEqual(["COMPLETED", "COMPLETED"]);

  // Kiracı başına birer e-posta, doğru alıcı ve veriyle.
  expect(sendBookingStatusChanged).toHaveBeenCalledTimes(2);
  const calls = vi.mocked(sendBookingStatusChanged).mock.calls;
  expect(calls.map(([to]) => to).sort()).toEqual(
    [a.renter.email, b.renter.email].sort(),
  );
  const [, data] = calls[0];
  expect(data.status).toBe("APPROVED"); // T5 şablonu yalnız ONAY/RET bilir
  expect(data.startDate).toBeInstanceOf(Date); // @db.Date UTC gece yarısı
  expect(data.endDate).toBeInstanceOf(Date);
  expect(data.listingTitle).toBe("Test İlanı");
});

it("endDate'i bugün/ileri olan APPROVED kayıtlarına dokunmaz", async () => {
  await resetDb();
  const checkoutToday = await seedBooking({
    status: "APPROVED",
    startDate: "2026-05-29",
    endDate: "2026-06-01", // bugünün UTC tarihi: bitiş < bugün DEĞİL → beklemede
  });
  const future = await seedBooking({
    status: "APPROVED",
    startDate: "2026-07-01",
    endDate: "2026-07-05",
  });

  const count = await completeDueBookings(NOW);

  expect(count).toBe(0);
  for (const id of [checkoutToday.booking.id, future.booking.id]) {
    const saved = await prisma.bookingRequest.findUniqueOrThrow({
      where: { id },
    });
    expect(saved.status).toBe("APPROVED");
  }
  expect(sendBookingStatusChanged).not.toHaveBeenCalled();
});

it("geçmiş tarihli PENDING/CANCELLED/REJECTED kayıtlara dokunmaz", async () => {
  await resetDb();
  const pending = await seedBooking({
    status: "PENDING",
    startDate: "2026-05-01",
    endDate: "2026-05-05",
  });
  const cancelled = await seedBooking({
    status: "CANCELLED",
    startDate: "2026-05-01",
    endDate: "2026-05-05",
  });
  const rejected = await seedBooking({
    status: "REJECTED",
    startDate: "2026-05-01",
    endDate: "2026-05-05",
  });

  const count = await completeDueBookings(NOW);

  expect(count).toBe(0);
  const expected: Record<string, BookingRequestStatus> = {
    [pending.booking.id]: "PENDING",
    [cancelled.booking.id]: "CANCELLED",
    [rejected.booking.id]: "REJECTED",
  };
  for (const [id, status] of Object.entries(expected)) {
    const saved = await prisma.bookingRequest.findUniqueOrThrow({
      where: { id },
    });
    expect(saved.status).toBe(status);
  }
  expect(sendBookingStatusChanged).not.toHaveBeenCalled();
});

it("COMPLETED kayıt ikinci çalıştırmada tekrar sayılmaz", async () => {
  await resetDb();
  const due = await seedBooking({
    status: "APPROVED",
    startDate: "2026-05-01",
    endDate: "2026-05-05",
  });
  await seedBooking({
    status: "COMPLETED",
    startDate: "2026-05-01",
    endDate: "2026-05-03", // zaten tamamlanmış: e-posta yok, sayıya girmez
  });

  const first = await completeDueBookings(NOW);
  expect(first).toBe(1);
  expect(sendBookingStatusChanged).toHaveBeenCalledTimes(1);

  const second = await completeDueBookings(NOW);
  expect(second).toBe(0);
  expect(sendBookingStatusChanged).toHaveBeenCalledTimes(1); // e-posta tekrarı yok
  const saved = await prisma.bookingRequest.findUniqueOrThrow({
    where: { id: due.booking.id },
  });
  expect(saved.status).toBe("COMPLETED");
});

it("e-posta hatası çalıştırmayı düşürmez — kayıt COMPLETED kalır", async () => {
  await resetDb();
  const due = await seedBooking({
    status: "APPROVED",
    startDate: "2026-05-01",
    endDate: "2026-05-05",
  });
  vi.mocked(sendBookingStatusChanged).mockImplementationOnce(() => {
    throw new Error("SMTP kapalı");
  });

  const count = await completeDueBookings(NOW);

  expect(count).toBe(1);
  const saved = await prisma.bookingRequest.findUniqueOrThrow({
    where: { id: due.booking.id },
  });
  expect(saved.status).toBe("COMPLETED");
});

// ---------------------------------------------------------------------------
// Cron route — CRON_SECRET doğrulaması
// ---------------------------------------------------------------------------

it("yanlış/eksik CRON_SECRET → 401", async () => {
  delete process.env.CRON_SECRET; // secret tanımsızsa fail-closed: hep 401
  const missingSecret = await GET(new Request(CRON_URL));
  expect(missingSecret.status).toBe(401);

  process.env.CRON_SECRET = "test-cron-secret";
  const missingHeader = await GET(new Request(CRON_URL));
  expect(missingHeader.status).toBe(401);

  const wrongHeader = await GET(
    new Request(CRON_URL, {
      headers: { authorization: "Bearer yanlis-anahtar" },
    }),
  );
  expect(wrongHeader.status).toBe(401);

  // Bearer öneki olmadan düz değer de reddedilir.
  const bareToken = await GET(
    new Request(CRON_URL, { headers: { authorization: "test-cron-secret" } }),
  );
  expect(bareToken.status).toBe(401);

  // Doğrulama reddedilmeden hiçbir iş yapılmaz.
  expect(sendBookingStatusChanged).not.toHaveBeenCalled();
});

it("doğru Bearer → 200 ve { completed } döner, bitmiş kaydı kapatır", async () => {
  await resetDb();
  process.env.CRON_SECRET = "test-cron-secret";
  // Uzak geçmiş tarih: route `now`'u sabitlemez; zaman geçse de "bitmiştir".
  await seedBooking({
    status: "APPROVED",
    startDate: "2000-01-01",
    endDate: "2000-01-05",
  });

  const response = await GET(
    new Request(CRON_URL, {
      headers: { authorization: "Bearer test-cron-secret" },
    }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ completed: 1 });
  expect(sendBookingStatusChanged).toHaveBeenCalledTimes(1);
});
