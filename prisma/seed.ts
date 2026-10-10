import "dotenv/config";
import { hashSync } from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

export const SEED_PASSWORD = "demo1234";

const seedUsers = [
  { email: "admin@karavan.test", name: "Demo Admin", role: "ADMIN" },
  { email: "sahip@karavan.test", name: "Ayşe Yıldız", role: "USER" },
  { email: "ikinci-sahip@karavan.test", name: "Burak Çelik", role: "USER" },
  { email: "kiraci@karavan.test", name: "Can Kaya", role: "USER" },
] as const;

function seedListings(ownerIds: Record<string, string>): Prisma.ListingCreateManyInput[] {
  return [
    {
      ownerId: ownerIds["sahip@karavan.test"],
      title: "Deniz Manzaralı Çekme Karavan",
      description:
        "Antalya Konyaaltı sahilinde, ailecek keyifli tatiller için bakımlı çekme karavan. Plaja yürüme mesafesinde; mutfak, banyo ve geniş dinlenme alanı hazır.",
      city: "Antalya",
      district: "Konyaaltı",
      lat: 36.8689,
      lng: 30.6833,
      nightlyPrice: 1500,
      capacity: 4,
      vehicleType: "TOWED_CARAVAN",
      brand: "Hobby",
      model: "560 WTE",
      transmission: "MANUAL",
      fuel: "DIESEL",
      licenseRequired: "BE",
      minDriverAge: 25,
      minRentalDays: 2,
      year: 2021,
      weightKg: 1500,
      lengthM: 7.4,
      amenities: ["WC", "SHOWER", "FRIDGE", "AWNING", "BEDDING", "COOKWARE", "HOT_WATER"],
      houseRules:
        "Sigara içilmez. Evcil hayvan kabul edilir. Gece 22.00'den sonra sesli müzik yoktur.",
      photoUrls: [
        "https://placehold.co/800x600/4a90d9/ffffff?text=Antalya+Karavan+1",
        "https://placehold.co/800x600/4a90d9/ffffff?text=Antalya+Karavan+2",
        "https://placehold.co/800x600/4a90d9/ffffff?text=Antalya+Karavan+3",
      ],
      status: "ACTIVE",
    },
    {
      ownerId: ownerIds["sahip@karavan.test"],
      title: "Ege Turu İçin Kompakt Panelvan",
      description:
        "İzmir Urla'dan çıkıp Ege'yi turlamaya hazır kompakt panelvan. Dar sokaklarda kolay park, iki kişilik konforlu yatak ve tam donanımlı mutfak.",
      city: "İzmir",
      district: "Urla",
      lat: 38.3228,
      lng: 26.4422,
      nightlyPrice: 1200,
      capacity: 2,
      vehicleType: "PANELVAN",
      brand: "Volkswagen",
      model: "California Ocean",
      transmission: "SEMI_AUTOMATIC",
      fuel: "DIESEL",
      licenseRequired: "B",
      minDriverAge: 23,
      minRentalDays: 1,
      year: 2019,
      weightKg: 2500,
      lengthM: 4.9,
      amenities: ["WC", "SHOWER", "FRIDGE", "HEATING", "GPS", "BIKE_RACK", "BEDDING"],
      houseRules: "Sigara yasaktır. Günlük kilometre sınırı 250 km'dir.",
      photoUrls: [
        "https://placehold.co/800x600/7ed321/ffffff?text=İzmir+Panelvan+1",
        "https://placehold.co/800x600/7ed321/ffffff?text=İzmir+Panelvan+2",
      ],
      status: "ACTIVE",
    },
    {
      ownerId: ownerIds["ikinci-sahip@karavan.test"],
      title: "Abant ve Yayla Turu Motorhome",
      description:
        "Bolu, Abant ve Gölcük çevresi yayla turları için donanımlı motorhome. Geniş iç hacim, ısıtma sistemi ve dört mevsim konfor.",
      city: "Bolu",
      district: "Mudurnu",
      lat: 40.4833,
      lng: 31.5833,
      nightlyPrice: 2000,
      capacity: 4,
      vehicleType: "MOTORHOME",
      brand: "Ford",
      model: "Rapport ADN",
      transmission: "AUTOMATIC",
      fuel: "DIESEL",
      licenseRequired: "C1",
      minDriverAge: 21,
      minRentalDays: 3,
      year: 2023,
      weightKg: 3500,
      lengthM: 6.8,
      amenities: [
        "WC",
        "SHOWER",
        "HEATING",
        "TV",
        "FRIDGE",
        "STOVE",
        "SOLAR_PANEL",
        "REAR_CAMERA",
        "WIFI",
      ],
      houseRules: "Sigara içilmez. Kış aylarında zincir zorunludur.",
      photoUrls: [
        "https://placehold.co/800x600/f5a623/ffffff?text=Bolu+Motorhome+1",
        "https://placehold.co/800x600/f5a623/ffffff?text=Bolu+Motorhome+2",
      ],
      status: "PENDING",
    },
  ];
}

/**
 * Demo verisi: 4 kullanıcı (1 admin) + 3 ilan (2 ACTIVE, 1 PENDING).
 * Idempotent: kullanıcılar upsert, sahiplerin ilanları yeniden oluşturulur.
 * Hepsi `SEED_PASSWORD` (demo1234) ile giriş yapabilir; hash bcrypt.
 */
export async function seed(): Promise<void> {
  const passwordHash = hashSync(SEED_PASSWORD, 10);
  const userIds: Record<string, string> = {};

  for (const user of seedUsers) {
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash, isBanned: false },
      create: { email: user.email, name: user.name, role: user.role, passwordHash },
    });
    userIds[user.email] = saved.id;
  }

  await prisma.listing.deleteMany({
    where: {
      ownerId: {
        in: [userIds["sahip@karavan.test"], userIds["ikinci-sahip@karavan.test"]],
      },
    },
  });
  await prisma.listing.createMany({ data: seedListings(userIds) });
}

// CLI girişi: `npm run seed` / `prisma db seed` bu dosyayı doğrudan çalıştırır;
// testler import ederken (vitest argv[1] farklıdır) otomatik çalışmaz.
const invokedDirectly =
  process.argv[1] !== undefined &&
  /(^|[\\/])prisma[\\/]seed\.(ts|mts|cts|js|mjs)$/.test(process.argv[1]);

if (invokedDirectly) {
  seed()
    .then(async () => {
      console.log("Seed tamam: 4 kullanıcı (1 admin), 3 ilan (2 ACTIVE, 1 PENDING).");
      await prisma.$disconnect();
    })
    .catch(async (error: unknown) => {
      console.error("Seed başarısız:", error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
