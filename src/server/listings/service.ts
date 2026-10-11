import type { Listing } from "@prisma/client";
import type { ZodError } from "zod";
import { UTApi } from "uploadthing/server";

import { prisma } from "../../lib/prisma";
import { fail, firstIssue, ok, type ActionResult } from "../../lib/result";
import { assertRateLimit, PHOTO_DELETE_LIMIT } from "../../lib/rate-limit";
import { extractFileKey } from "../../lib/upload";
import {
  listingSchema,
  listingUpdateSchema,
} from "../../lib/validators/listing";
import type { SessionUser } from "../users/service";

// İlan CRUD çekirdeği — saf kural katmanı (DB + yetki + sunucu otoriter kararlar).
// HTTP/oturum yok: `user` her zaman açık parametre; aksiyonlar requireUser ile sarar.
//
// Güvenlik kalıpları (Review Focus):
// 1. Yetki matrisi: her mutation'da `listing.ownerId !== user.id` → yetkiniz yok,
//    admin yetkisi BU görevde yok (T10 moderasyonu ele alır) — sıkı sahip-sadece.
// 2. Sunucu otoriter: create her zaman `status: "DRAFT"` + `ownerId: user.id` yazar;
//    istemciden gelen status/ownerId asla okunmaz. Durum geçişi yalnız
//    submitListingCore (DRAFT|REJECTED|PAUSED → PENDING, en az 1 foto).

const YETKI_YOK = "Bu işlem için yetkiniz yok.";
const ILAN_BULUNAMADI = "İlan bulunamadı.";
const GECERSIZ_DURUM = "Bu ilan şu anda gönderilemez.";
const GECERSIZ_ILAN_ID = "Geçersiz ilan kimliği.";
const GECERSIZ_DOSYA = "Geçersiz dosya anahtarı.";
const DOSYA_YETKI_YOK = "Bu dosyayı silmeye yetkiniz yok.";
const DOSYA_SILINEMEDI = "Fotoğraf sunucudan silinemedi, lütfen tekrar deneyin.";

// Prisma @default(cuid()) ile üretilen id deseni: `c` + 24 alfanümerik.
// Bozuk/çöp bir id Prisma'ya ulaşmadan reddedilir (Türkçe ActionResult).
const CUID_RE = /^c[a-z0-9]{24}$/;

/**
 * UploadThing dosya anahtarı deseni — gerçek anahtarlar `uuid_dosyaadı`
 * biçimindedir (ör. `2e0fdb64-…_image.jpg`), cuid DEĞİLDİR; bu yüzden CUID_RE
 * burada kullanılamaz. Kapı reports service'teki isCuid ile aynı stildedir
 * (önce TİP kontrolü, sonra regex) ama UploadThing alfabesine göredir:
 * harf/rakam ile `._-/`, en fazla 512 karakter, `..` segmenti yok.
 */
const FILE_KEY_RE = /^[A-Za-z0-9._/-]{1,512}$/;

/** Dosya anahtarını doğrular; geçersizse fail, geçerliyse null döner. */
function invalidFileKey(key: unknown): ActionResult<never> | null {
  if (typeof key !== "string" || !FILE_KEY_RE.test(key) || key.includes("..")) {
    return fail(GECERSIZ_DOSYA, "photoUrls");
  }
  return null;
}

/** İlan id'sini doğrular; geçersizse fail, geçerliyse null döner. */
function invalidId(id: string): ActionResult<never> | null {
  return CUID_RE.test(id) ? null : fail(GECERSIZ_ILAN_ID);
}

/** İlk Zod hatasını Türkçe mesaj + alan adı ile ActionResult'a çevirir. */
function validationFail<T>(error: ZodError): ActionResult<T> {
  const issue = firstIssue(error);
  return fail(issue.message, issue.field);
}

/**
 * Yeni ilan — her zaman `status: "DRAFT"` ve `ownerId = user.id` yazar.
 * Payload'da `status: "ACTIVE"` veya yabancı `ownerId` gelse bile yok sayılır
 * (şema `ownerId`'yi hiç tanıtmaz, `status` ise burada okunmaz).
 */
export async function createListingCore(
  user: SessionUser,
  data: unknown,
): Promise<ActionResult<Listing>> {
  const parsed = listingSchema.safeParse(data);
  if (!parsed.success) {
    return validationFail(parsed.error);
  }
  const input = parsed.data; // input.status bilinçli olarak OKUNMAZ

  const listing = await prisma.listing.create({
    data: {
      title: input.title,
      description: input.description,
      city: input.city,
      district: input.district ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      nightlyPrice: input.nightlyPrice,
      capacity: input.capacity,
      vehicleType: input.vehicleType,
      brand: input.brand ?? null,
      model: input.model ?? null,
      transmission: input.transmission,
      fuel: input.fuel,
      licenseRequired: input.licenseRequired,
      minDriverAge: input.minDriverAge ?? null,
      minRentalDays: input.minRentalDays,
      year: input.year ?? null,
      weightKg: input.weightKg ?? null,
      lengthM: input.lengthM ?? null,
      amenities: [...input.amenities],
      houseRules: input.houseRules ?? null,
      photoUrls: [...input.photoUrls],
      ownerId: user.id, // sunucu otoriter: oturumdaki kullanıcı
      status: "DRAFT", // sunucu otoriter: tek doğuş durumu
    },
  });
  return ok(listing);
}

/**
 * İlan güncelleme — yalnız sahibi; alan alan (partial) veri.
 * status/ownerId istemciden GELMEZ: alan listesine hiç alınmaz, dolayısıyla
 * payload'daki status/ownerId girişleri DB'ye asla yazılmaz.
 */
export async function updateListingCore(
  user: SessionUser,
  id: string,
  data: unknown,
): Promise<ActionResult<Listing>> {
  const badId = invalidId(id);
  if (badId) {
    return badId;
  }
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) {
    return fail(ILAN_BULUNAMADI);
  }
  if (existing.ownerId !== user.id) {
    return fail(YETKI_YOK); // yetkisiz girişim: mutation yok
  }

  const parsed = listingUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return validationFail(parsed.error);
  }
  const input = parsed.data; // input.status bilinçli olarak OKUNMAZ
  // Boş/no-op güncelleme (payload yalnız strip edilen alanlar içeriyorsa):
  // Prisma'nın boş update davranışına bırakma, mevcut kaydı olduğu gibi döndür.
  if (Object.values(input).every((v) => v === undefined)) {
    return ok(existing);
  }

  const listing = await prisma.listing.update({
    where: { id },
    data: {
      // Prisma'da `undefined` = alanı değiştirme; null = alanı temizle.
      title: input.title,
      description: input.description,
      city: input.city,
      district: input.district,
      lat: input.lat,
      lng: input.lng,
      nightlyPrice: input.nightlyPrice,
      capacity: input.capacity,
      vehicleType: input.vehicleType,
      brand: input.brand,
      model: input.model,
      transmission: input.transmission,
      fuel: input.fuel,
      licenseRequired: input.licenseRequired,
      minDriverAge: input.minDriverAge,
      minRentalDays: input.minRentalDays,
      year: input.year,
      weightKg: input.weightKg,
      lengthM: input.lengthM,
      amenities: input.amenities,
      houseRules: input.houseRules,
      photoUrls: input.photoUrls,
      // status/ownerId BİLEREK yok — yalnız submitListingCore durumu değiştirir.
    },
  });
  return ok(listing);
}

/** İlan silme — yalnız sahibi. Cascade koruması: booking silinemez. */
export async function deleteListingCore(
  user: SessionUser,
  id: string,
): Promise<ActionResult<Listing>> {
  const badId = invalidId(id);
  if (badId) {
    return badId;
  }
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) {
    return fail(ILAN_BULUNAMADI);
  }
  if (existing.ownerId !== user.id) {
    return fail(YETKI_YOK); // yetkisiz girişim: mutation yok
  }

  // BookingRequest.listing üzerinde ON DELETE CASCADE: düz silme, kiracının
  // beklemede/onaylı/tamamlanmış kayıtlarını da yok eder. Bu nedenle yalnız
  // REJECTED/CANCELLED (rezervasyonun hiç gerçekleşmediği terminal durumlar)
  // varken silmeye izin ver; PENDING/APPROVED/COMPLETED varsa engelle.
  const blockingBookings = await prisma.bookingRequest.count({
    where: {
      listingId: id,
      status: { in: ["PENDING", "APPROVED", "COMPLETED"] },
    },
  });
  if (blockingBookings > 0) {
    return fail(
      "İlana bağlı beklemede, onaylı veya tamamlanmış rezervasyonlar var; ilan silinemez.",
    );
  }

  const deleted = await prisma.listing.delete({ where: { id } });
  return ok(deleted);
}

/**
 * İlanı incelemeye gönderme — DRAFT|REJECTED|PAUSED → PENDING, en az 1 fotoğraf zorunlu.
 * Başka hiçbir durumdan bu duruma geçiş yok (ACTIVE/PENDING reddedilir).
 * PAUSED → PENDING, duraklatılmış ilan için TEK çıkış yoludur (admin onayıyla
 * yeniden ACTIVE olur); e-posta kopyası "incelemeye yeniden gönderebilirsiniz" der.
 */
export async function submitListingCore(
  user: SessionUser,
  id: string,
): Promise<ActionResult<Listing>> {
  const badId = invalidId(id);
  if (badId) {
    return badId;
  }
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) {
    return fail(ILAN_BULUNAMADI);
  }
  if (existing.ownerId !== user.id) {
    return fail(YETKI_YOK); // yetkisiz girişim: mutation yok
  }
  // PAUSED da gönderilebilir: admin duraklatan ilan sahibi yeniden incelemeye
  // gönderebilir (PAUSED → PENDING → admin onayı → ACTIVE). Bu, PAUSED için
  // tek çıkış yoludur; mail kopyası da buna atıf yapar.
  if (
    existing.status !== "DRAFT" &&
    existing.status !== "REJECTED" &&
    existing.status !== "PAUSED"
  ) {
    return fail(GECERSIZ_DURUM);
  }
  if (existing.photoUrls.length < 1) {
    return fail("İlanı göndermek için en az 1 fotoğraf eklemelisiniz.", "photoUrls");
  }

  const listing = await prisma.listing.update({
    where: { id },
    data: { status: "PENDING", rejectionReason: null },
  });
  return ok(listing);
}

/**
 * İlan fotoğrafı silme — PhotoUploader "Kaldır" buradan geçer (UTApi
 * sunucu sırrı gerektirir, istemcide çalışmaz).
 *
 * Sıra: anahtar biçimi → hız sınırı → sahiplik kuralı → silme.
 * Sahiplik kuralı: key, `ownerId === user.id` olan bir ilanın `photoUrls`
 * listesindeyse VEYA hiçbir ilan key'e atıf yapmıyorsa (yetim = az önce
 * yüklenmiş taslak fotoğraf; anahtarlar tahmin edilemez, ayrıca auth +
 * hız sınırı var) `UTApi.deleteFiles` çağrılır. Başkasının ilanına ait
 * key reddedilir ve `deleteFiles` ASLA çağrılmaz.
 *
 * Yetim kuralının gerekçesi: ListingForm fotoğrafları ilan satırı
 * oluşmadan yükler (create gönderim anında yapılır), bu yüzden salt
 * sahiplik kontrolü taslak fotoğrafların silinmesini bozardı.
 */
export async function deleteListingPhotoCore(
  user: SessionUser,
  key: unknown,
): Promise<ActionResult<true>> {
  const badKey = invalidFileKey(key);
  if (badKey) {
    return badKey;
  }
  const fileKey = key as string;

  const rate = await assertRateLimit(
    "photo-delete",
    user.id,
    PHOTO_DELETE_LIMIT.limit,
    PHOTO_DELETE_LIMIT.windowSeconds,
  );
  if (!rate.ok) {
    return rate;
  }

  const candidates = await prisma.listing.findMany({
    select: { ownerId: true, photoUrls: true },
  });
  const referencedByOther = candidates.some(
    (listing) =>
      listing.ownerId !== user.id &&
      listing.photoUrls.some((url) => extractFileKey(url) === fileKey),
  );
  if (referencedByOther) {
    return fail(DOSYA_YETKI_YOK);
  }

  try {
    const utapi = new UTApi();
    await utapi.deleteFiles(fileKey);
  } catch {
    return fail(DOSYA_SILINEMEDI);
  }
  return ok(true);
}
