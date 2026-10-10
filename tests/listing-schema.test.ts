import { expect, it } from "vitest";

import { AMENITIES } from "../src/lib/amenities";
import { listingSchema } from "../src/lib/validators/listing";

/** Geçerli tam ilan kaydı — şemanın tüm zorunlu alanlarını kapsar. */
function validListing(overrides: Record<string, unknown> = {}) {
  return {
    title: "Güneşli Kıyı Karavanı",
    description:
      "Antalya sahilinde tam donanımlı çekme karavan; hafta sonu kaçamakları için idealdir.",
    city: "Antalya",
    district: "Konyaaltı",
    nightlyPrice: 1500,
    capacity: 4,
    vehicleType: "TOWED_CARAVAN",
    transmission: "MANUAL",
    fuel: "DIESEL",
    licenseRequired: "B",
    minRentalDays: 2,
    amenities: ["AIR_CONDITIONING", "WC", "SOLAR_PANEL"],
    photoUrls: ["https://cdn.karavan.test/ilan/1.jpg"],
    ...overrides,
  };
}

it("geçerli tam kayıt parse edilir", () => {
  const result = listingSchema.safeParse(validListing());

  expect(result.success).toBe(true);
});

it("nightlyPrice: 0 → hata (gece fiyatı 0'dan büyük olmalı)", () => {
  const result = listingSchema.safeParse(validListing({ nightlyPrice: 0 }));

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues[0].path).toContain("nightlyPrice");
    expect(result.error.issues[0].message).toContain("Gece fiyatı");
  }
});

it("capacity: 17 → hata (kapasite 1..16)", () => {
  const result = listingSchema.safeParse(validListing({ capacity: 17 }));

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues[0].path).toContain("capacity");
    expect(result.error.issues[0].message).toContain("16");
  }
});

it('vehicleType: "KAMYON" → hata (enum İngilizce ve kapalı)', () => {
  const result = listingSchema.safeParse(validListing({ vehicleType: "KAMYON" }));

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues[0].path).toContain("vehicleType");
    expect(result.error.issues[0].message).toContain("araç tipi");
  }
});

it("photoUrls: 11 dosya → hata (MAX_PHOTOS = 10)", () => {
  const photoUrls = Array.from(
    { length: 11 },
    (_, i) => `https://cdn.karavan.test/ilan/${i + 1}.jpg`,
  );
  const result = listingSchema.safeParse(validListing({ photoUrls }));

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues[0].path).toContain("photoUrls");
    expect(result.error.issues[0].message).toContain("10");
  }
});

it('vehicleType: "TOWED_CARAVAN" → ok (enum değeri İngilizce)', () => {
  const result = listingSchema.safeParse(
    validListing({ vehicleType: "TOWED_CARAVAN" }),
  );

  expect(result.success).toBe(true);
});

it("minRentalDays: 31 → hata (1..30)", () => {
  const result = listingSchema.safeParse(validListing({ minRentalDays: 31 }));

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues[0].path).toContain("minRentalDays");
  }
});

it("bilinmeyen amenities anahtarı → hata (yalnızca katalog anahtarları)", () => {
  const result = listingSchema.safeParse(
    validListing({ amenities: ["JET_PACK"] }),
  );

  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues[0].path).toContain("amenities");
  }
});

it("AMENITIES kataloğu 17 kayıt ve Türkçe etiketli (spec §3.1)", () => {
  expect(AMENITIES).toHaveLength(17);
  expect(AMENITIES.map((a) => a.key)).toEqual([
    "AIR_CONDITIONING",
    "WC",
    "SHOWER",
    "SOLAR_PANEL",
    "AWNING",
    "HEATING",
    "TV",
    "HOT_WATER",
    "STOVE",
    "FRIDGE",
    "BEDDING",
    "COOKWARE",
    "GPS",
    "BIKE_RACK",
    "REAR_CAMERA",
    "INVERTER",
    "WIFI",
  ]);
  expect(AMENITIES.find((a) => a.key === "AIR_CONDITIONING")?.label).toBe(
    "Klima",
  );
  expect(AMENITIES.find((a) => a.key === "BIKE_RACK")?.label).toBe(
    "Bisiklet Taşıyıcı",
  );
  expect(AMENITIES.find((a) => a.key === "INVERTER")?.label).toBe("İnvertör");
});
