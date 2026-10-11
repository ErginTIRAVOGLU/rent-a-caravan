import "./env";

import type { Listing, Prisma } from "@prisma/client";
import { compare, hashSync } from "bcryptjs";

import { prisma } from "../../../src/lib/prisma";
import { seed } from "../../../prisma/seed";
import { E2E_REVIEW_BOOKING_ID, LISTINGS, PASSWORD, USERS } from "./seed-data";

/**
 * E2E önkoşulları (dev DB — `DATABASE_URL`).
 *
 * `npx playwright test` her koşumda bunu çalıştırır; amaç senaryoların
 * çalışmadan önce ihtiyaç duyduğu durumu GARANTİ etmek (üst üste koşabilirlik):
 *
 *   1) Seed kullanıcıları giriş yapabilir durumda (ban yok, e-posta doğrulu,
 *      şifre SEED_PASSWORD). Eksik/bozuk kullanıcı `prisma/seed.ts` ile tamir
 *      edilir.
 *   2) Senaryo 3 hedefi (Bolu ilanı) PENDING durumuna döner — admin onayı
 *      sonrası ACTIVE olur, bir sonraki koşumda tekrar PENDING olmalı.
 *   3) Senaryo 1/2 için kiracının Antalya/İzmir ilanlarındaki AÇIK talepleri
 *      silinir (aksi halde "zaten bekleyen talebiniz var" / tarih çakışması
 *      nedeniyle talep ve onay başarısız olur). COMPLETED kayıtlar korunur.
 *   4) Senaryo 5 için İzmir ilanında yorumsuz, geçmiş tarihli bir COMPLETED
 *      rezervasyon upsert edilir (seed'in COMPLETED kaydının yorumu zaten
 *      yazılmıştır, o yüzden ayrı bir fixture gerekir).
 *   5) Yorum görünürlüğü korumaları ve hız sınırı sayaçları temizlenir
 *      (ikisi de testlerin sessizce başarısız olmasına neden olur).
 *
 * NOT: Bu betik DEV veritabanını değiştirir; sadece e2e koşumu için kullanın.
 */

function log(message: string): void {
  console.log(`[e2e fixtures] ${message}`);
}

/** UTC gece yarısı — `@db.Date` kolonlarıyla birebir (seed ile aynı kalıp). */
function utcDay(offsetDays: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays),
  );
}

const SEED_EMAILS: readonly string[] = Object.values(USERS);

async function missingSeedUsers(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { email: { in: [...SEED_EMAILS] } },
    select: { email: true },
  });
  const found = new Set(rows.map((row) => row.email));
  return SEED_EMAILS.filter((email) => !found.has(email));
}

/** Giriş önkoşullarını tamir et: ban, e-posta doğrulaması, şifre. */
async function repairLoginUsers(): Promise<void> {
  for (const email of SEED_EMAILS) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) continue; // eksik kullanıcıyı seed tamir eder

    const data: Prisma.UserUpdateInput = {};
    if (user.isBanned) data.isBanned = false;
    if (user.emailVerified === null) data.emailVerified = new Date();

    const passwordOk =
      user.passwordHash !== null && (await compare(PASSWORD, user.passwordHash));
    if (!passwordOk) data.passwordHash = hashSync(PASSWORD, 10);

    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { email }, data });
      log(`${email}: giriş önkoşulleri tamir edildi (ban / e-posta / şifre).`);
    }
  }
}

/** Seed ilanlarını bul; gerekirse `prisma/seed.ts` ile tam tamir koştur. */
async function ensureListings(): Promise<Record<keyof typeof LISTINGS, Listing>> {
  const byTitle = (title: string) => prisma.listing.findFirst({ where: { title } });

  const readAll = async () => {
    const [antalya, izmir, bolu] = await Promise.all([
      byTitle(LISTINGS.antalya),
      byTitle(LISTINGS.izmir),
      byTitle(LISTINGS.bolu),
    ]);
    return { antalya, izmir, bolu };
  };

  let found = await readAll();
  const ready = (value: Awaited<ReturnType<typeof readAll>>) =>
    value.antalya?.status === "ACTIVE" &&
    value.izmir?.status === "ACTIVE" &&
    value.bolu !== null;

  if (!ready(found)) {
    log("Seed ilanları eksik — prisma/seed.ts koşturuluyor.");
    await seed();
    found = await readAll();
  }

  const { antalya, izmir, bolu } = found;
  if (!antalya || antalya.status !== "ACTIVE" || !izmir || izmir.status !== "ACTIVE" || !bolu) {
    throw new Error(
      "E2E önkoşulları hazır değil: `npm run seed` çalıştırın (2 ACTIVE + 1 PENDING ilan bekleniyor).",
    );
  }
  return { antalya, izmir, bolu };
}

/** Senaryo 5: İzmir ilanında yorumsuz COMPLETED rezervasyon (sabit kimlik). */
async function ensureReviewBooking(listing: Listing, renterId: string): Promise<void> {
  await prisma.bookingRequest.upsert({
    where: { id: E2E_REVIEW_BOOKING_ID },
    update: {
      listingId: listing.id,
      renterId,
      status: "COMPLETED",
      startDate: utcDay(-40),
      endDate: utcDay(-37),
      guests: 2,
      totalPrice: 3600,
    },
    create: {
      id: E2E_REVIEW_BOOKING_ID,
      listingId: listing.id,
      renterId,
      status: "COMPLETED",
      startDate: utcDay(-40),
      endDate: utcDay(-37),
      guests: 2,
      totalPrice: 3600,
    },
  });
  // Üst üste koşabilirlik: senaryo 5'in yazdığı yorum her koşumda silinir.
  await prisma.review.deleteMany({ where: { bookingId: E2E_REVIEW_BOOKING_ID } });
}

export async function prepareDatabase(): Promise<void> {
  const missing = await missingSeedUsers();
  if (missing.length > 0) {
    log(`Eksik seed kullanıcıları (${missing.join(", ")}) — prisma/seed.ts koşturuluyor.`);
    await seed();
    const stillMissing = await missingSeedUsers();
    if (stillMissing.length > 0) {
      throw new Error(`Seed kullanıcıları oluşturulamadı: ${stillMissing.join(", ")}`);
    }
  }
  await repairLoginUsers();

  const listings = await ensureListings();

  const renter = await prisma.user.findUniqueOrThrow({
    where: { email: USERS.renter },
    select: { id: true },
  });
  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: USERS.owner },
    select: { id: true, reviewsVisible: true },
  });

  // Senaryo 3: Bolu ilanı yeniden "incelemede" olmalı.
  if (listings.bolu.status !== "PENDING") {
    await prisma.listing.update({
      where: { id: listings.bolu.id },
      data: { status: "PENDING", rejectionReason: null },
    });
    log(`${LISTINGS.bolu}: durum PENDING'a sıfırlandı (senaryo 3).`);
  }

  // Senaryo 1/2: kiracının bu ilanlardaki açık talepleri temizlenir.
  const cleared = await prisma.bookingRequest.deleteMany({
    where: {
      renterId: renter.id,
      listingId: { in: [listings.antalya.id, listings.izmir.id] },
      status: { notIn: ["COMPLETED"] },
    },
  });
  if (cleared.count > 0) {
    log(`Kiracının ${cleared.count} açık talebi silindi (senaryo 1/2).`);
  }

  // Senaryo 4: kiracı ile sahip arasındaki İzmir sohbeti silinir; "Sor" butonu
  // her koşumda BOŞ bir sohbet başlatmalı (aksi halde önceki koşumun mesajları
  // görünür ve "ilk mesajı siz gönderin" akışı doğrulanamaz).
  const conversations = await prisma.conversation.deleteMany({
    where: { listingId: listings.izmir.id, renterId: renter.id },
  });
  if (conversations.count > 0) {
    log(`${conversations.count} İzmir sohbeti silindi (senaryo 4).`);
  }

  await ensureReviewBooking(listings.izmir, renter.id);

  // Senaryo 5: yorumların görünmesi için sahibin görünürlük bayrağı açık olmalı.
  if (!owner.reviewsVisible) {
    await prisma.user.update({
      where: { id: owner.id },
      data: { reviewsVisible: true },
    });
    log("İlan sahibinin reviewsVisible bayrağı açıldı (senaryo 5).");
  }
  // `reviewsEnabled=false` ayarı tüm yorumları gizler; kapalıysa kaldırılır.
  const reviewsSetting = await prisma.setting.findUnique({
    where: { key: "reviewsEnabled" },
  });
  if (reviewsSetting && reviewsSetting.value === false) {
    await prisma.setting.delete({ where: { key: "reviewsEnabled" } });
    log("reviewsEnabled ayarı kapalıydı — kaldırıldı (senaryo 5).");
  }

  // Hız sınırı sayaçları geçici kayıtlardır; testlerin limite takılmaması için
  // temizlenir (aynı dakika içinde üst üste koşumda sayaç birikebilir).
  const rateEntries = await prisma.rateLimitEntry.deleteMany({});
  if (rateEntries.count > 0) {
    log(`${rateEntries.count} hız sınırı sayacı temizlendi.`);
  }

  log("Önkoşullar hazır: 2 ACTIVE + 1 PENDING ilan, 4 seed kullanıcı.");
}
