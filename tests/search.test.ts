import { expect, it } from "vitest";

import { prisma } from "../src/lib/prisma";
import { searchListings } from "../src/server/listings/search";
import { makeListing, makeUser, resetDb } from "./helpers/db";

// T8 arama çekirdeği — brief Step 1'deki 6 kilit testi + şehir filtresi.
// Fixture: 3 ACTIVE + 1 PAUSED (+ PENDING/REJECTED kapsam dışı) + 1 ACTIVE
// ilan üzerinde APPROVED rezervasyon (tarih eleme kilidi).
//
// Tarihler @db.Date kolonları: UTC gece yarısı Date'leri (Date.UTC).
// Kilit predicate (T9 ile birebir): startDate < bitis AND endDate > baslangic
// → [baslangic, bitis) yarım açık; bitişik tarihler ÇAKIŞMAZ.

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

type Fixture = {
  antalya: string; // ACTIVE, PANELVAN, cap 4, ₺1500
  ankara: string; // ACTIVE, MOTORHOME, cap 2, ₺3000
  izmir: string; // ACTIVE, TOWED_CARAVAN, cap 6, ₺800
  paused: string; // PAUSED — aramada görünmemeli
  pending: string; // PENDING — aramada görünmemeli
  rejected: string; // REJECTED — aramada görünmemeli
  booked: string; // ACTIVE, cap 4, ₺1200 — APPROVED rezervasyon [10.11.2026 → 12.11.2026]
};

/**
 * Temiz DB üzerine fixture kurar. Rezervasyon: startDate=2026-11-10,
 * endDate=2026-11-12 (checkout), status=APPROVED.
 * → baslangic=11 (bitis=13) sorgusu çakışır (ELENER);
 * → baslangic=12 (bitis=14) sorgusu bitişik kalır (BULUNUR).
 */
async function seedFixture(): Promise<Fixture> {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const guest = await prisma.user.create({ data: makeUser() });

  const antalya = await prisma.listing.create({
    data: makeListing(owner.id, {
      title: "Antalya Panelvan",
      city: "Antalya",
      vehicleType: "PANELVAN",
      capacity: 4,
      nightlyPrice: 1500,
    }),
  });
  const ankara = await prisma.listing.create({
    data: makeListing(owner.id, {
      title: "Ankara Motorkaravan",
      city: "Ankara",
      vehicleType: "MOTORHOME",
      capacity: 2,
      nightlyPrice: 3000,
    }),
  });
  const izmir = await prisma.listing.create({
    data: makeListing(owner.id, {
      title: "İzmir Çekme Karavan",
      city: "İzmir",
      vehicleType: "TOWED_CARAVAN",
      capacity: 6,
      nightlyPrice: 800,
    }),
  });
  const paused = await prisma.listing.create({
    data: makeListing(owner.id, { status: "PAUSED", city: "Antalya" }),
  });
  const pending = await prisma.listing.create({
    data: makeListing(owner.id, { status: "PENDING", city: "Antalya" }),
  });
  const rejected = await prisma.listing.create({
    data: makeListing(owner.id, { status: "REJECTED", city: "Antalya" }),
  });
  const booked = await prisma.listing.create({
    data: makeListing(owner.id, {
      title: "Bolu Rezervasyonlu Panelvan",
      city: "Bolu",
      vehicleType: "PANELVAN",
      capacity: 4,
      nightlyPrice: 1200,
    }),
  });

  await prisma.bookingRequest.create({
    data: {
      listing: { connect: { id: booked.id } },
      renter: { connect: { id: guest.id } },
      startDate: utc(2026, 11, 10),
      endDate: utc(2026, 11, 12),
      guests: 2,
      totalPrice: 2400,
      status: "APPROVED",
    },
  });

  return {
    antalya: antalya.id,
    ankara: ankara.id,
    izmir: izmir.id,
    paused: paused.id,
    pending: pending.id,
    rejected: rejected.id,
    booked: booked.id,
  };
}

function ids(result: { items: { id: string }[] }): string[] {
  return result.items.map((item) => item.id);
}

it("yalnızca ACTIVE ilanlar döner (PAUSED/PENDING/REJECTED hariç)", async () => {
  const fx = await seedFixture();

  const result = await searchListings({});

  expect(result.total).toBe(4);
  expect(new Set(ids(result))).toEqual(
    new Set([fx.antalya, fx.ankara, fx.izmir, fx.booked]),
  );
});

it("tarih çakışan ilan elenir", async () => {
  const fx = await seedFixture();

  // Rezervasyon [2026-11-10 → 2026-11-12]; sorgu [11 → 13] içine düşer.
  const overlapping = await searchListings({
    baslangic: "2026-11-11",
    bitis: "2026-11-13",
  });
  expect(ids(overlapping)).not.toContain(fx.booked);
  expect(overlapping.total).toBe(3);

  // Tek tarihli sorgu: tarih filtresi yok sayılır (brief kararı) — ilan görünür.
  const onlyStart = await searchListings({ baslangic: "2026-11-11" });
  expect(ids(onlyStart)).toContain(fx.booked);
});

it("bitişik tarih bulunur", async () => {
  const fx = await seedFixture();

  // Checkout günü rezervasyonun bitişi: [12 → 14], endDate(12) > 12 değil → çakışma yok.
  const adjacent = await searchListings({
    baslangic: "2026-11-12",
    bitis: "2026-11-14",
  });
  expect(ids(adjacent)).toContain(fx.booked);
  expect(adjacent.total).toBe(4);
});

it("kisi filtresi capacity >= kisi uygular", async () => {
  const fx = await seedFixture();

  const four = await searchListings({ kisi: "4" });
  expect(new Set(ids(four))).toEqual(
    new Set([fx.antalya, fx.izmir, fx.booked]),
  );

  const six = await searchListings({ kisi: "6" });
  expect(ids(six)).toEqual([fx.izmir]);
});

it("aracTipi ve fiyat aralığı filtreleri", async () => {
  const fx = await seedFixture();

  const motorhome = await searchListings({ aracTipi: "MOTORHOME" });
  expect(ids(motorhome)).toEqual([fx.ankara]);

  // ₺1000–₺2000: Antalya(1500) ve Bolu(1200) — Ankara(3000)/İzmir(800) hariç.
  const priceRange = await searchListings({
    minFiyat: "1000",
    maxFiyat: "2000",
  });
  expect(new Set(ids(priceRange))).toEqual(
    new Set([fx.antalya, fx.booked]),
  );
});

it("sayfa başına 20, toplam sayfa sayısı doğru", async () => {
  await resetDb();
  const owner = await prisma.user.create({ data: makeUser() });
  const base = Date.UTC(2026, 0, 1);
  // 25 ACTIVE ilan, deterministik createdAt (desc sıralama kilidi).
  for (let i = 0; i < 25; i++) {
    await prisma.listing.create({
      data: makeListing(owner.id, {
        title: `İlan ${String(i).padStart(2, "0")}`,
        createdAt: new Date(base + i * 60_000),
      }),
    });
  }

  const page1 = await searchListings({ sayfa: "1" });
  expect(page1.items).toHaveLength(20);
  expect(page1.total).toBe(25);
  expect(page1.items[0]!.title).toBe("İlan 24"); // en yeni önce

  const page2 = await searchListings({ sayfa: "2" });
  expect(page2.items).toHaveLength(5);
  expect(page2.total).toBe(25);
  expect(page2.items.map((l) => l.title)).toEqual([
    "İlan 04",
    "İlan 03",
    "İlan 02",
    "İlan 01",
    "İlan 00",
  ]);

  // Toplam sayfa sayısı: ceil(25/20) = 2 — sayfalar kesişmez.
  expect(Math.ceil(page1.total / 20)).toBe(2);
  const page1Ids = new Set(ids(page1));
  for (const item of page2.items) {
    expect(page1Ids.has(item.id)).toBe(false);
  }

  // Geçersiz sayfa değeri yok sayılır → 1. sayfa.
  const invalidPage = await searchListings({ sayfa: "abc" });
  expect(invalidPage.items).toHaveLength(20);
});

it("şehir filtresi büyük/küçük harf duyarsız ve kısmi eşleşir", async () => {
  const fx = await seedFixture();

  expect(ids(await searchListings({ sehir: "ant" }))).toEqual([fx.antalya]);
  expect(ids(await searchListings({ sehir: "ANTALYA" }))).toEqual([
    fx.antalya,
  ]);
  expect(ids(await searchListings({ sehir: "İzmir" }))).toEqual([fx.izmir]);
  // Next.js query dizi gelirse (sehir=a&sehir=b) ilk değer kullanılır.
  expect(
    ids(await searchListings({ sehir: ["İzmir", "yok-sehir"] })),
  ).toEqual([fx.izmir]);
});
