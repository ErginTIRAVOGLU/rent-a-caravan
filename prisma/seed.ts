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
        "/images/home-card-1.jpg",
        "/images/home-card-2.jpg",
        "/images/detail-interior.jpg",
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
        "/images/home-card-2.jpg",
        "/images/detail-kitchen.jpg",
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
        "/images/home-card-3.jpg",
        "/images/detail-bed.jpg",
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
  const now = new Date();

  for (const user of seedUsers) {
    const saved = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash, isBanned: false, emailVerified: now },
      create: { email: user.email, name: user.name, role: user.role, passwordHash, emailVerified: now },
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

  // Fetch created listings for relations
  const createdListings = await prisma.listing.findMany({
    where: {
      ownerId: {
        in: [userIds["sahip@karavan.test"], userIds["ikinci-sahip@karavan.test"]],
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Sample conversations & messages
  const renterId = userIds["kiraci@karavan.test"];
  const ownerId = userIds["sahip@karavan.test"];

  if (createdListings.length >= 2) {
    // Conversation 1: kiraci <-> sahip (listing 0)
    const conv1 = await prisma.conversation.upsert({
      where: { listingId_renterId: { listingId: createdListings[0].id, renterId } },
      update: { lastMessageAt: now, lastMessagePreview: "İlanınız hala müsait mi?" },
      create: {
        listingId: createdListings[0].id,
        renterId,
        ownerId,
        lastMessageAt: now,
        lastMessagePreview: "İlanınız hala müsait mi?",
      },
    });
    await prisma.message.createMany({
      data: [
        { conversationId: conv1.id, senderId: renterId, content: "Merhaba, ilanınız hala müsait mi?", createdAt: new Date(now.getTime() - 3600000) },
        { conversationId: conv1.id, senderId: ownerId, content: "Evet, müsait. Hangi tarihler düşünüyorsunuz?", createdAt: new Date(now.getTime() - 1800000) },
      ],
    });

    // Conversation 2: kiraci <-> ikinci-sahip (listing 2)
    const ownerId2 = userIds["ikinci-sahip@karavan.test"];
    const conv2 = await prisma.conversation.upsert({
      where: { listingId_renterId: { listingId: createdListings[2].id, renterId } },
      update: { lastMessageAt: now, lastMessagePreview: "Fiyatınız sabit mi?" },
      create: {
        listingId: createdListings[2].id,
        renterId,
        ownerId: ownerId2,
        lastMessageAt: now,
        lastMessagePreview: "Fiyatınız sabit mi?",
      },
    });
    await prisma.message.createMany({
      data: [
        { conversationId: conv2.id, senderId: renterId, content: "Fiyatınız sabit mi?", createdAt: new Date(now.getTime() - 7200000) },
        { conversationId: conv2.id, senderId: ownerId2, content: "Uzun kiralamalarda indirim yapabilirim.", createdAt: new Date(now.getTime() - 5400000) },
      ],
    });
  }

  // Sample reviews (need completed bookings first)
  // Create a completed booking for review
  if (createdListings.length >= 1) {
    const booking = await prisma.bookingRequest.upsert({
      where: { id: "seed-review-booking" },
      update: {},
      create: {
        id: "seed-review-booking",
        listingId: createdListings[0].id,
        renterId,
        startDate: new Date(now.getTime() - 86400000 * 10),
        endDate: new Date(now.getTime() - 86400000 * 7),
        guests: 2,
        totalPrice: 4500,
        status: "COMPLETED",
      },
    });

    await prisma.review.upsert({
      where: { bookingId: booking.id },
      update: { rating: 5, comment: "Harika bir deneyimdi, karavan çok temiz ve sahibi çok yardımcıdı." },
      create: {
        listingId: createdListings[0].id,
        authorId: renterId,
        bookingId: booking.id,
        rating: 5,
        comment: "Harika bir deneyimdi, karavan çok temiz ve sahibi çok yardımcıdı.",
        ipAddress: "127.0.0.1",
      },
    });
  }

  // Sample reports
  await prisma.report.upsert({
    where: { id: "seed-report-1" },
    update: {},
    create: {
      id: "seed-report-1",
      reporterId: renterId,
      targetType: "LISTING",
      targetId: createdListings[0].id,
      reason: "İlan fotoğrafları gerçek durumu yansıtmıyor.",
      status: "OPEN",
    },
  });

  await prisma.report.upsert({
    where: { id: "seed-report-2" },
    update: {},
    create: {
      id: "seed-report-2",
      reporterId: ownerId,
      targetType: "USER",
      targetId: renterId,
      reason: "Kullanıcı iletişimde kaba davrandı.",
      status: "REVIEWING",
    },
  });
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
