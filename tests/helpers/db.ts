import { hashSync } from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";

// Güvenlik ağı: testler yalnızca test DB'sine bağlanmalı. vitest.config.mts,
// worker'larda DATABASE_URL'i TEST_DATABASE_URL'e eşitler; eşitlik yoksa ya
// test.env uygulanmamış ya .env eksiktir — erken ve sesli düş.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL tanımlı değil. .env dosyasını .env.example'dan oluşturun.",
  );
}
if (process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error(
    `DATABASE_URL test veritabanına (${testDatabaseUrl}) bağlanmıyor; mevcut değer: ${process.env.DATABASE_URL}. vitest.config.mts içindeki test.env yapılandırmasını kontrol edin.`,
  );
}

/**
 * Tüm tabloları TRUNCATE ... CASCADE ile temizler (testler arası izolasyon).
 * Tablolar pg_tables'den dinamik okunur; yeni model eklemek resetDb'yi güncellemeyi gerektirmez.
 * `_prisma_migrations` (migration takibi) bilinçli olarak hariç tutulur.
 */
export async function resetDb(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '\\_prisma%' ESCAPE '\\'
  `;
  if (tables.length === 0) {
    return;
  }
  const tableList = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}

// makeUser varsayılan şifresi: planın demo şifresi (bcrypt hash, düz metin değil).
const demoPasswordHash = hashSync("demo1234", 10);

/** `prisma.user.create({ data: makeUser() })` için fabrika verisi. */
export function makeUser(overrides: Partial<Prisma.UserCreateInput> = {}): Prisma.UserCreateInput {
  return {
    name: "Test Kullanıcısı",
    email: `test-${crypto.randomUUID()}@karavan.test`,
    passwordHash: demoPasswordHash,
    ...overrides,
  };
}

/** `prisma.listing.create({ data: makeListing(user.id) })` için fabrika verisi. */
export function makeListing(
  ownerId: string,
  overrides: Partial<Prisma.ListingCreateInput> = {},
): Prisma.ListingCreateInput {
  return {
    owner: { connect: { id: ownerId } },
    title: "Test İlanı",
    description: "Test ilan açıklaması.",
    city: "Antalya",
    nightlyPrice: 1500,
    capacity: 4,
    vehicleType: "PANELVAN",
    transmission: "MANUAL",
    fuel: "DIESEL",
    licenseRequired: "B",
    amenities: [],
    photoUrls: [],
    status: "ACTIVE",
    ...overrides,
  };
}
