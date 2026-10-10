import type { Listing } from "@prisma/client";
import type { ZodError } from "zod";

import { prisma } from "../../lib/prisma";
import { fail, firstIssue, ok, type ActionResult } from "../../lib/result";
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
//    submitListingCore (DRAFT|REJECTED → PENDING, en az 1 foto).

const YETKI_YOK = "Bu işlem için yetkiniz yok.";
const ILAN_BULUNAMADI = "İlan bulunamadı.";
const GECERSIZ_DURUM = "Bu ilan şu anda gönderilemez.";
const GECERSIZ_ILAN_ID = "Geçersiz ilan kimliği.";

// Prisma @default(cuid()) ile üretilen id deseni: `c` + 24 alfanümerik.
// Bozuk/çöp bir id Prisma'ya ulaşmadan reddedilir (Türkçe ActionResult).
const CUID_RE = /^c[a-z0-9]{24}$/;

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

/** İlan silme — yalnız sahibi. */
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

  const deleted = await prisma.listing.delete({ where: { id } });
  return ok(deleted);
}

/**
 * İlanı incelemeye gönderme — DRAFT|REJECTED → PENDING, en az 1 fotoğraf zorunlu.
 * Başka hiçbir durumdan bu duruma geçiş yok (ACTIVE/PAUSED/PENDING reddedilir).
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
  if (existing.status !== "DRAFT" && existing.status !== "REJECTED") {
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
