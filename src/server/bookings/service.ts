import type { BookingRequest } from "@prisma/client";

import { findApprovedOverlap } from "../../lib/availability";
import {
  sendBookingRequested,
  sendBookingStatusChanged,
} from "../../lib/email/events";
import { prisma } from "../../lib/prisma";
import { fail, firstIssue, ok, type ActionResult } from "../../lib/result";
import { validateStay } from "../../lib/stay";
import { staySchema } from "../../lib/validators/booking";
import type { SessionUser } from "../users/service";

// Rezervasyon talebi çekirdeği — spec §4.1. HTTP/oturum yok: `user` açık
// parametre; aksiyonlar requireUser ile sarar.
//
// KRİTİK DOĞRULUK (eşzamanlı onay asla çift rezervasyon üretmez):
// approve/reject/cancel AYNI kalıbı izler —
//   1) ilan bazlı advisory lock: `pg_advisory_xact_lock(hashtext(listingId))`
//      (satır kilidi FOR UPDATE okunmamış satırları kilitleyemez; burada karar
//      ilan bazlı sıralanır),
//   2) KİLT SONRASI taze okuma → durum PENDING değilse yazmadan fail,
//   3) onayda transaction içinde findApprovedOverlap (T8 predicate'i),
//   4) commit SONRASI e-posta — hata action'ı düşürmez (try/catch).
//
// Yetki matrisi: approve/reject YALNIZ ilan sahibi; cancel YALNIZ kiracı.
// totalPrice/her zaman sunucuda: DB.nightlyPrice × gece (T4), istemci
// payload'ındaki totalPrice/status/renterId alanları asla okunmaz.

const YETKI_YOK = "Bu işlem için yetkiniz yok.";
const TALEP_BULUNAMADI = "Talep bulunamadı.";
const ILAN_BULUNAMADI = "İlan bulunamadı.";
const GECERSIZ_TALEP_ID = "Geçersiz talep kimliği.";
const GECERSIZ_ILAN_ID = "Geçersiz ilan kimliği.";
const KARAR_BAGLANMIS = "Bu talep zaten karara bağlanmış.";
const TARIHLER_DOLU = "Bu tarihler artık dolu, farklı tarih seçin";
const ILAN_KAPALI = "Bu ilan için talep kabul edilmiyor.";
const KENDI_ILANI = "Kendi ilanınıza talep oluşturamazsınız.";
const BEKLEYEN_TALEP = "Bu ilan için zaten bekleyen bir talebiniz var.";
const IPTAL_EDILEMEZ = "Bu talep şu anda iptal edilemez.";

// Prisma @default(cuid()) id deseni — bozuk id Prisma'ya ulaşmadan reddedilir.
const CUID_RE = /^c[a-z0-9]{24}$/;

/** YYYY-MM-DD → UTC gece yarısı Date (@db.Date kolonuyla birebir). */
function isoToUtcDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Karar e-postası — T5: asla reject olmaz; yine de burada tutulur. */
async function notifyStatusChanged(
  booking: {
    startDate: Date;
    endDate: Date;
    listing: { title: string };
    renter: { email: string };
  },
  status: "APPROVED" | "REJECTED",
  reason?: string,
): Promise<void> {
  try {
    await sendBookingStatusChanged(booking.renter.email, {
      listingTitle: booking.listing.title,
      startDate: booking.startDate, // UTC gece yarısı Date (@db.Date)
      endDate: booking.endDate,
      status,
      reason,
    });
  } catch {
    // E-posta hatası action'ı düşürmez; karar zaten commit edildi.
  }
}

/**
 * Talep oluştur — kiracı. `input` bilinçli olarak `unknown`: payload'daki
 * status/renterId/totalPrice alanları zod ile ayıklanır, asla okunmaz.
 * Fiyat T4 ile sunucuda (DB nightlyPrice) hesaplanır; durum her zaman PENDING.
 *
 * Not (brief kararı): create, takvim ÇAKIŞMASI denetlemez — Airbnb modeli
 * kiracı talep gönderebilir, çakışmayı sahip ONAY sırasında yakalar
 * (approveBookingCore → findApprovedOverlap).
 */
export async function createBookingCore(
  user: SessionUser,
  input: unknown,
): Promise<ActionResult<BookingRequest>> {
  if (typeof input !== "object" || input === null) {
    return fail("Geçersiz talep verisi.");
  }
  const { listingId } = input as { listingId?: unknown };
  if (typeof listingId !== "string" || !CUID_RE.test(listingId)) {
    return fail(GECERSIZ_ILAN_ID);
  }

  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) {
    return fail(ILAN_BULUNAMADI);
  }
  if (listing.ownerId === user.id) {
    return fail(KENDI_ILANI); // yetki: kendi ilanına talep yok
  }
  if (listing.status !== "ACTIVE") {
    return fail(ILAN_KAPALI);
  }

  // T4 kuralları (sıra + ilk ihlal): biçim, tarih sırası, min/max gece, kapasite.
  const parsed = staySchema.safeParse(input);
  if (!parsed.success) {
    const issue = firstIssue(parsed.error);
    return fail(issue.message, issue.field);
  }
  const stay = validateStay(
    { minRentalDays: listing.minRentalDays, capacity: listing.capacity },
    parsed.data,
    listing.nightlyPrice,
  );
  if (!stay.ok) {
    return fail(stay.error, stay.field);
  }

  // Mükerrer koruması: aynı kiracı + aynı ilanda BEKLEYEN tek talep hakkı var.
  const pending = await prisma.bookingRequest.findFirst({
    where: { listingId: listing.id, renterId: user.id, status: "PENDING" },
    select: { id: true },
  });
  if (pending) {
    return fail(BEKLEYEN_TALEP);
  }

  // Sunucu otoriter: fiyat DB.nightlyPrice × nights; durum her zaman PENDING.
  const booking = await prisma.bookingRequest.create({
    data: {
      listingId: listing.id,
      renterId: user.id,
      startDate: isoToUtcDate(parsed.data.startDate),
      endDate: isoToUtcDate(parsed.data.endDate),
      guests: parsed.data.guests,
      message: parsed.data.message ?? null,
      totalPrice: stay.data.totalPrice,
      status: "PENDING",
    },
  });

  try {
    await sendBookingRequested(user.email, {
      renterName: user.name,
      listingTitle: listing.title,
      startDate: booking.startDate,
      endDate: booking.endDate,
    });
  } catch {
    // E-posta hatası action'ı düşürmez; kayıt zaten yazıldı.
  }
  return ok(booking);
}

/**
 * Talebi onayla — YALNIZ ilan sahibi. Eşzamanlı onay yarışı: iki transaction
 * aynı ilan kilidini ister; kilidi alan kazanır, kaybeden kilit SONRASI taze
 * okumada durumu APPROVED görür ve "karara bağlanmış" hatasıyla — YAZMADAN —
 * döner. Böylece DB'de asla çift onay/çift rezervasyon oluşmaz.
 */
export async function approveBookingCore(
  user: SessionUser,
  id: string,
): Promise<ActionResult<BookingRequest>> {
  if (!CUID_RE.test(id)) {
    return fail(GECERSIZ_TALEP_ID);
  }
  // Ön okuma (kilit dışı): hızlı yetki/finalik reddi; durum KİLİT SONRASI
  // yeniden okunur — bu okuma karar için bağlayıcı değildir.
  const initial = await prisma.bookingRequest.findUnique({
    where: { id },
    include: {
      listing: { select: { ownerId: true, title: true } },
      renter: { select: { name: true, email: true } },
    },
  });
  if (!initial) {
    return fail(TALEP_BULUNAMADI);
  }
  if (initial.listing.ownerId !== user.id) {
    return fail(YETKI_YOK); // yetkisiz: mutation yok
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1) İlan bazlı advisory lock: kararlar ilan başına sıralanır (FOR UPDATE
    //    okunmamış satırı kilitleyemez; boş ilana da uygulanır).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${initial.listingId}))`;
    // 2) Kilit sonrası TAZE okuma — yarışçıların bağlayıcı durum kontrolü.
    const fresh = await tx.bookingRequest.findUnique({ where: { id } });
    if (!fresh) {
      return fail<BookingRequest>(TALEP_BULUNAMADI);
    }
    if (fresh.status !== "PENDING") {
      return fail<BookingRequest>(KARAR_BAGLANMIS); // diğer yarışçı kazandı
    }
    // 3) Çakışma: kesinleşmiş aralıklar (kendi kaydı hariç) — T8 predicate.
    const overlap = await findApprovedOverlap(
      tx,
      fresh.listingId,
      fresh.startDate,
      fresh.endDate,
      fresh.id,
    );
    if (overlap) {
      return fail<BookingRequest>(TARIHLER_DOLU);
    }
    const updated = await tx.bookingRequest.update({
      where: { id },
      data: { status: "APPROVED" },
    });
    return ok(updated);
  });

  // 4) Commit SONRASI e-posta — hata action'ı düşürmez.
  if (result.ok) {
    await notifyStatusChanged(initial, "APPROVED");
  }
  return result;
}

/**
 * Talebi reddet — YALNIZ ilan sahibi; PENDING → REJECTED + gerekçe.
 * Onayla ile aynı lock + kilit-sonrası-okuma kalıbı (kararlar tek kazananlı).
 */
export async function rejectBookingCore(
  user: SessionUser,
  id: string,
  reason?: string,
): Promise<ActionResult<BookingRequest>> {
  if (!CUID_RE.test(id)) {
    return fail(GECERSIZ_TALEP_ID);
  }
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  if (trimmed.length > 1000) {
    return fail("Gerekçe en fazla 1000 karakter olabilir.", "reason");
  }

  const initial = await prisma.bookingRequest.findUnique({
    where: { id },
    include: {
      listing: { select: { ownerId: true, title: true } },
      renter: { select: { name: true, email: true } },
    },
  });
  if (!initial) {
    return fail(TALEP_BULUNAMADI);
  }
  if (initial.listing.ownerId !== user.id) {
    return fail(YETKI_YOK);
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${initial.listingId}))`;
    const fresh = await tx.bookingRequest.findUnique({ where: { id } });
    if (!fresh) {
      return fail<BookingRequest>(TALEP_BULUNAMADI);
    }
    if (fresh.status !== "PENDING") {
      return fail<BookingRequest>(KARAR_BAGLANMIS);
    }
    const updated = await tx.bookingRequest.update({
      where: { id },
      data: { status: "REJECTED", rejectionReason: trimmed || null },
    });
    return ok(updated);
  });

  if (result.ok) {
    await notifyStatusChanged(initial, "REJECTED", trimmed || undefined);
  }
  return result;
}

/**
 * Talebi iptal et — YALNIZ kiracı; yalnız PENDING veya APPROVED → CANCELLED.
 * COMPLETED/REJECTED/iptal edilmiş talep fail (durum değişmez).
 */
export async function cancelBookingCore(
  user: SessionUser,
  id: string,
): Promise<ActionResult<BookingRequest>> {
  if (!CUID_RE.test(id)) {
    return fail(GECERSIZ_TALEP_ID);
  }
  const initial = await prisma.bookingRequest.findUnique({ where: { id } });
  if (!initial) {
    return fail(TALEP_BULUNAMADI);
  }
  if (initial.renterId !== user.id) {
    return fail(YETKI_YOK); // iptal yalnız kiracının hakkı
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${initial.listingId}))`;
    const fresh = await tx.bookingRequest.findUnique({ where: { id } });
    if (!fresh) {
      return fail<BookingRequest>(TALEP_BULUNAMADI);
    }
    if (fresh.status !== "PENDING" && fresh.status !== "APPROVED") {
      return fail<BookingRequest>(IPTAL_EDILEMEZ);
    }
    const updated = await tx.bookingRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    return ok(updated);
  });
  // İptal e-postası yok: şablon yalnız ONAY/RET kararlarını kapsar (T5).
  return result;
}
