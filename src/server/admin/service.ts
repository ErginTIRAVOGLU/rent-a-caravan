import { Prisma, type Listing, type User } from "@prisma/client";

import { sendListingStatusChanged } from "../../lib/email/events";
import { prisma } from "../../lib/prisma";
import { fail, ok, type ActionResult } from "../../lib/result";
import type { SessionUser } from "../users/service";

// Admin moderasyon çekirdeği — spec §7. HTTP/oturum yok: `admin` açık parametre;
// aksiyonlar requireAdmin ile sarar.
//
// KRİTİK: durum geçişi SUNUCU otoriterdir — istemciden status asla okunmaz,
// yalnızca aşağıdaki sıkı matris uygulanır:
//   PENDING  → ACTIVE    (approveListingCore; rejectionReason temizlenir)
//   PENDING  → REJECTED  (rejectListingCore; gerekçe ZORUNLU)
//   ACTIVE   → PAUSED    (pauseListingCore)
//   REJECTED → PENDING   (yalnız ilan sahibinin T6 submitListingCore akışı)
//   DRAFT    → PENDING   (yalnız ilan sahibinin T6 submitListingCore akışı)
//   PAUSED   → PENDING   (yalnız ilan sahibinin T6 submitListingCore akışı —
//                          PAUSED'ın TEK çıkış yolu; geniş inceleme düzeltmesi)
// Matriste olmayan her geçiş (ör. DRAFT → ACTIVE, ACTIVE → ACTIVE,
// PAUSED → ACTIVE) fail döner ve HİÇ mutation olmaz. "Duraklatmayı
// kaldır" admin yetkisi YOK — yeniden yayına alma, sahibinin yeniden
// gönderimi + admin onayı üzerinden yürür.
//
// Yetki matrisi: dört işlem de YALNIZ admin (action katmanı requireAdmin ile
// oturum kapısı uygular; service'te role ayrıca doğrulanır — savunma derinliği).
// Eşzamanlılık: booking'lerin aksine takvim yarışı yok; yine de okuma →
// doğrulama → yazma safeTx içinde — advisory lock eklenmedi (spec kararı).
//
// Ban korumaları (setUserBannedCore):
//   1) yönetici hiçbir zaman KENDİ hesabını banlayamaz,
//   2) sistemdeki son AKTİF yönetici (role=ADMIN, isBanned=false) banlanamaz.
// Kural 2'nin tek ihlal yolu kural 1'den geçer; ikinci savunma, banlı bir
// yönetici oturumunun (eski/stale cookie) aktif administratoru kilitlemesini
// engeller. Ban AÇMA (banned=false) bu korumalara tabi değildir (kurtarma yolu).

const YETKI_YOK = "Bu işlem için yetkiniz yok.";
const ILAN_BULUNAMADI = "İlan bulunamadı.";
const KULLANICI_BULUNAMADI = "Kullanıcı bulunamadı.";
const GECERSIZ_ILAN_ID = "Geçersiz ilan kimliği.";
const GECERSIZ_KULLANICI_ID = "Geçersiz kullanıcı kimliği.";
const GECERSIZ_DURUM = "Bu ilan şu anda bu işlem için uygun durumda değil.";
const GEREKCE_GEREKLI = "Ret için gerekçe zorunludur.";
const GEREKCE_UZUN = "Gerekçe en fazla 1000 karakter olabilir.";
const KENDI_HESABI = "Kendi hesabınızı engelleyemezsiniz.";
const SON_AKTIF_YONETICI = "Sistemdeki son aktif yöneticiyi engelleyemezsiniz.";
const ISLEM_BASARISIZ = "Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.";

/**
 * Ban eyleminin istemciye döndüğü azaltılmış görünüm — `passwordHash`
 * (offline kaba-kuvvet malzemesi) ve `googleId` ASLA action yanıtına girmez.
 * İstemci (UserBanActions) yalnız `ok/error` kullanır; alanlar gelecek
 * admin UI'ı içindir.
 */
export type BannedUser = Pick<
  User,
  "id" | "name" | "email" | "role" | "isBanned"
>;

// Prisma @default(cuid()) id deseni — bozuk id Prisma'ya ulaşmadan reddedilir.
const CUID_RE = /^c[a-z0-9]{24}$/;

/** İlan kararının commit sonrası bildirimi: ilan sahibine e-posta. */
type Decision = {
  listing: Listing;
  ownerEmail: string;
};

/**
 * Transaction'ı güvenle yürütür: zaman aşımı / havuz yorgunluğu gibi istisnalar
 * ActionResult'a düşer — server action asla throw etmez, istemci Türkçe hata görür.
 * Kalıp bookings/service.ts safeTx ile aynı.
 */
async function safeTx<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await prisma.$transaction(fn);
  } catch {
    return fail(ISLEM_BASARISIZ);
  }
}

/**
 * İlan karar e-postası — T5: asla reject olmaz; yine de try/catch ile sarılır
 * (e-posta hatası action'ı düşürmez, karar zaten commit edilmiştir).
 */
async function notifyListingStatusChanged(
  decision: Decision,
  status: "ACTIVE" | "REJECTED" | "PAUSED",
  reason?: string,
): Promise<void> {
  try {
    await sendListingStatusChanged(decision.ownerEmail, {
      listingTitle: decision.listing.title,
      status,
      reason,
    });
  } catch {
    // E-posta hatası action'ı düşürmez; karar zaten commit edildi.
  }
}

/**
 * İlanı onayla — YALNIZ admin; matris: yalnız PENDING → ACTIVE.
 * `rejectionReason` temizlenir (yayına çıkan ilanın eski ret gerekçesi kalmaz).
 * Commit SONRASI ilan sahibine e-posta.
 */
export async function approveListingCore(
  admin: SessionUser,
  id: string,
): Promise<ActionResult<Listing>> {
  if (admin.role !== "ADMIN") {
    return fail(YETKI_YOK); // yetkisiz: mutation yok
  }
  if (!CUID_RE.test(id)) {
    return fail(GECERSIZ_ILAN_ID);
  }

  const result = await safeTx<Decision>(async (tx) => {
    // Atomik geçiş: id + beklenen durum (PENDING) koşulu tek yazımada — iki
    // moderatör aynı PENDING ilana aynı anda karar verse bile matris
    // yetkili kalır; last-write-wins yok, count===0 hem "yok" hem "yanlış durum".
    const res = await tx.listing.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "ACTIVE", rejectionReason: null },
    });
    if (res.count === 0) {
      // Tanı ayrımı yalnız hata yolunda: yok mu, yoksa yanlış durumda mı?
      const exists = await tx.listing.findUnique({
        where: { id },
        select: { id: true },
      });
      return fail<Decision>(exists ? GECERSIZ_DURUM : ILAN_BULUNAMADI);
    }
    const updated = await tx.listing.findUniqueOrThrow({
      where: { id },
      include: { owner: { select: { email: true } } },
    });
    return ok({ listing: updated, ownerEmail: updated.owner.email });
  });

  if (result.ok) {
    await notifyListingStatusChanged(result.data, "ACTIVE");
    return ok(result.data.listing);
  }
  return result;
}

/**
 * İlanı reddet — YALNIZ admin; matris: yalnız PENDING → REJECTED.
 * Gerekçe ZORUNLU (boş/yalnız boşluk fail); `rejectionReason`'a yazılır.
 * Commit SONRASI ilan sahibine e-posta (gerekçeyle).
 */
export async function rejectListingCore(
  admin: SessionUser,
  id: string,
  reason?: string,
): Promise<ActionResult<Listing>> {
  if (admin.role !== "ADMIN") {
    return fail(YETKI_YOK);
  }
  if (!CUID_RE.test(id)) {
    return fail(GECERSIZ_ILAN_ID);
  }
  const trimmed = typeof reason === "string" ? reason.trim() : "";
  if (trimmed.length === 0) {
    return fail(GEREKCE_GEREKLI, "reason");
  }
  if (trimmed.length > 1000) {
    return fail(GEREKCE_UZUN, "reason");
  }

  const result = await safeTx<Decision>(async (tx) => {
    // Atomik geçiş (approve ile aynı kalıp): id + PENDING koşulu tek yazımada.
    const res = await tx.listing.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "REJECTED", rejectionReason: trimmed },
    });
    if (res.count === 0) {
      const exists = await tx.listing.findUnique({
        where: { id },
        select: { id: true },
      });
      return fail<Decision>(exists ? GECERSIZ_DURUM : ILAN_BULUNAMADI);
    }
    const updated = await tx.listing.findUniqueOrThrow({
      where: { id },
      include: { owner: { select: { email: true } } },
    });
    return ok({ listing: updated, ownerEmail: updated.owner.email });
  });

  if (result.ok) {
    await notifyListingStatusChanged(result.data, "REJECTED", trimmed);
    return ok(result.data.listing);
  }
  return result;
}

/**
 * İlanı duraklat — YALNIZ admin; matris: yalnız ACTIVE → PAUSED.
 * PAUSED ilan arama/katalogda görünmez (search katmanı ACTIVE filtreler).
 * Commit SONRASI ilan sahibine e-posta.
 */
export async function pauseListingCore(
  admin: SessionUser,
  id: string,
): Promise<ActionResult<Listing>> {
  if (admin.role !== "ADMIN") {
    return fail(YETKI_YOK);
  }
  if (!CUID_RE.test(id)) {
    return fail(GECERSIZ_ILAN_ID);
  }

  const result = await safeTx<Decision>(async (tx) => {
    // Atomik geçiş (approve ile aynı kalıp): id + ACTIVE koşulu tek yazımada.
    const res = await tx.listing.updateMany({
      where: { id, status: "ACTIVE" },
      data: { status: "PAUSED" },
    });
    if (res.count === 0) {
      const exists = await tx.listing.findUnique({
        where: { id },
        select: { id: true },
      });
      return fail<Decision>(exists ? GECERSIZ_DURUM : ILAN_BULUNAMADI);
    }
    const updated = await tx.listing.findUniqueOrThrow({
      where: { id },
      include: { owner: { select: { email: true } } },
    });
    return ok({ listing: updated, ownerEmail: updated.owner.email });
  });

  if (result.ok) {
    await notifyListingStatusChanged(result.data, "PAUSED");
    return ok(result.data.listing);
  }
  return result;
}

/**
 * Kullanıcı banı — YALNIZ admin; `User.isBanned` bayrağını değiştirir.
 * Koruma 1: yönetici kendi hesabını BANLAYAMAZ (banned=true).
 * Koruma 2: sistemdeki son aktif yönetici (role=ADMIN, isBanned=false)
 * banlanamaz — hedef zaten banlıysa aktif yönetici sayımı buna izin verir.
 * Ban AÇMA (banned=false) bu korumalara tabi değildir (kurtarma yolu açık).
 */
export async function setUserBannedCore(
  admin: SessionUser,
  userId: string,
  banned: boolean,
): Promise<ActionResult<BannedUser>> {
  if (admin.role !== "ADMIN") {
    return fail(YETKI_YOK);
  }
  if (!CUID_RE.test(userId)) {
    return fail(GECERSIZ_KULLANICI_ID);
  }
  if (banned && userId === admin.id) {
    return fail(KENDI_HESABI); // koruma 1: mutation yok
  }

  // Koruma 2 (atomik): hedef satır hâlâ var mı + aktif yönetici sayımı AYNI
  // transaction'da — ban-yarışında (iki yönetici aynı anda birbirini banlarsa)
  // sayımlar tutarlı kalır. writeMany sonucu 0 ise hedef silinmiş (P2025) demektir.
  const updated = await prisma.$transaction(async (tx) => {
    const fresh = await tx.user.findUnique({ where: { id: userId } });
    if (!fresh) {
      return fail<BannedUser>(KULLANICI_BULUNAMADI);
    }
    if (banned && fresh.role === "ADMIN" && !fresh.isBanned) {
      const activeAdmins = await tx.user.count({
        where: { role: "ADMIN", isBanned: false },
      });
      if (activeAdmins <= 1) {
        return fail<BannedUser>(SON_AKTIF_YONETICI); // mutation yok
      }
    }
    // updateMany + id filtresi: satır bu arada silinmişse P2025 fırlatmak yerine
    // count===0 ile sessizce "bulunamadı" döner (safeTx asla throw etmez).
    const res = await tx.user.updateMany({
      where: { id: userId },
      data: { isBanned: banned },
    });
    if (res.count === 0) {
      return fail<BannedUser>(KULLANICI_BULUNAMADI);
    }
    // İstemciye GİDEN tek okuma: passwordHash/googleId ASLA seçilmez —
    // bcrypt hash'i (offline kaba-kuvvet malzemesi) action yanıtına sızmaz.
    return ok(
      await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isBanned: true,
        },
      }),
    );
  });
  return updated;
}

/**
 * Genel ayar güncelle — YALNIZ admin.
 * `Setting` modeli: key (String @id), value (Json), updatedAt.
 * Boşsa default true (reviewsEnabled için) — getter `?? true` uygular.
 */
export async function updateSettingCore(
  admin: SessionUser,
  key: string,
  value: unknown,
): Promise<ActionResult<{ key: string; value: unknown }>> {
  if (admin.role !== "ADMIN") {
    return fail(YETKI_YOK);
  }
  if (!key || typeof key !== "string") {
    return fail("Geçersiz ayar anahtarı.", "key");
  }

  const updated = await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue },
    update: { value: value as Prisma.InputJsonValue },
  });

  return ok({ key: updated.key, value: updated.value });
}
