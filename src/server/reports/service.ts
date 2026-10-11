import type { Report, ReportStatus, ReportTargetType } from "@prisma/client";
import type { ZodError } from "zod";

import { REPORT_TARGET_DELETED_LABELS } from "../../lib/labels";
import { prisma } from "../../lib/prisma";
import { fail, firstIssue, ok, type ActionResult } from "../../lib/result";
import {
  REPORT_STATUS_TRANSITIONS,
  reportInputSchema,
  reportStatusInputSchema,
} from "../../lib/validators/report";
import type { SessionUser } from "../users/service";

// Şikayet çekirdeği — spec §8. HTTP/oturum yok: `user`/`admin` açık parametre;
// aksiyonlar requireUser/requireAdmin ile sarar.
//
// KRİTİK kurallar:
//   1) hedef SUNUCUDA doğrulanır — LISTING → listing, USER → user; hedef
//      silinmişse "hedef bulunamadı" (kırık link yok),
//   2) AYNI kullanıcı AYNI hedefe AÇIK şikayeti varken tekrar bildiremez
//      (check-then-act; yarış riski MVP'de kabul edilmiştir — spec §11),
//   3) gerekçe 5–500 karakter (trim),
//   4) durum matrisi SUNUCU otoriterdir — istemciden status okunmaz:
//        OPEN → REVIEWING → CLOSED, CLOSED terminal (geri açılmaz).
//      Matris kaynağı `lib/validators/report.ts` (REPORT_STATUS_TRANSITIONS):
//      admin kuyruğu satır düğmeleri (NEXT_REPORT_STATUS) aynı nesneyi okur.
//      Matris dışı HER geçiş fail döner ve HİÇ mutation olmaz
//      (`updateMany` + from-status koşulu kalıbı — admin/service.ts ile aynı),
//   5) durum geçişi YALNIZ admin (action katmanı requireAdmin + service'te rol
//      doğrulaması — savunma derinliği),
//   6) otomatik aksiyon YOK: şikayet işleme kendi başına ilanı duraklatmaz/
//      kullanıcı banlamaz; yönetici mevcut araçları kullanır (spec §8).

const YETKI_YOK = "Bu işlem için yetkiniz yok.";
const SIKAYET_BULUNAMADI = "Şikayet bulunamadı.";
const ILAN_BULUNAMADI = "İlan bulunamadı.";
const KULLANICI_BULUNAMADI = "Kullanıcı bulunamadı.";
const GECERSIZ_ILAN_ID = "Geçersiz ilan kimliği.";
const GECERSIZ_KULLANICI_ID = "Geçersiz kullanıcı kimliği.";
const GECERSIZ_SIKAYET_ID = "Geçersiz şikayet kimliği.";
const GECERSIZ_DURUM = "Şikayet bu işlem için uygun durumda değil.";
const ZATEN_BILDIRMISSINIZ = "Bu hedef için zaten açık bir şikayetiniz var.";

/** Prisma @default(cuid()) id deseni — bozuk id Prisma'ya ulaşmadan reddedilir. */
const CUID_RE = /^c[a-z0-9]{24}$/;

/**
 * Id gerçekten mi string, yoksa yalnız "stringify edince uyuyor" mu?
 * `CUID_RE.test(value)` tek argüman alır ve değeri metne çevirir: `{toString}`
 * gibi bir nesne regex'i geçip Prisma'ya ulaşır ve 500'e düşerdi. Kapı bu
 * yüzden TİP kontrolüdür, regex yalnız ikinci adımdır.
 */
function isCuid(value: unknown): value is string {
  return typeof value === "string" && CUID_RE.test(value);
}

/** Zod hatasını Türkçe mesaj + alan adı taşıyan ActionResult'a çevirir. */
function validationFail<T>(error: ZodError): ActionResult<T> {
  const issue = firstIssue(error);
  return fail(issue.message, issue.field);
}

/**
 * Şikayet oluştur — oturumlu kullanıcı. Sıra: hedef tipi → id biçimi →
 * gerekçe → hedef varlığı → mükerrer AÇIK kayıt → yazma.
 */
export async function createReportCore(
  user: SessionUser,
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
): Promise<ActionResult<Report>> {
  // Hedef tipi + gerekçe tek şemada — hata mesajı ve alan adı Türkçe gelir.
  const parsed = reportInputSchema.safeParse({ targetType, reason });
  if (!parsed.success) {
    return validationFail(parsed.error);
  }
  const type = parsed.data.targetType;

  // Hedef tipine göre id biçimi — bozuk id DB okumasından önce reddedilir.
  if (!isCuid(targetId)) {
    return fail(
      type === "LISTING" ? GECERSIZ_ILAN_ID : GECERSIZ_KULLANICI_ID,
      "targetId",
    );
  }

  // Hedef varlığı — hedef silinmişse bildirim yazılmaz (kırık link yok).
  const target =
    type === "LISTING"
      ? await prisma.listing.findUnique({
          where: { id: targetId },
          select: { id: true },
        })
      : await prisma.user.findUnique({
          where: { id: targetId },
          select: { id: true },
        });
  if (!target) {
    return fail(type === "LISTING" ? ILAN_BULUNAMADI : KULLANICI_BULUNAMADI);
  }

  // Mükerrer koruma: yalnız AÇIK şikayet engeller — kapalı kayıt kullanıcıyı
  // yeniden bildirmekten alıkoymaz.
  const existing = await prisma.report.findFirst({
    where: {
      reporterId: user.id,
      targetType: type,
      targetId,
      status: "OPEN",
    },
    select: { id: true },
  });
  if (existing) {
    return fail(ZATEN_BILDIRMISSINIZ);
  }

  const report = await prisma.report.create({
    data: {
      reporterId: user.id,
      targetType: type,
      targetId,
      reason: parsed.data.reason,
    },
  });
  return ok(report);
}

/**
 * Şikayet durumunu güncelle — YALNIZ admin. Matris: OPEN → REVIEWING → CLOSED.
 * CLOSED terminal: geri açma yoktur; matris dışı geçişte HİÇ mutation olmaz.
 * `updatedAt` yalnız başarılı geçişte yazılır.
 */
export async function updateReportStatusCore(
  admin: SessionUser,
  reportId: string,
  status: ReportStatus,
): Promise<ActionResult<Report>> {
  if (admin.role !== "ADMIN") {
    return fail(YETKI_YOK); // yetkisiz: mutation yok
  }
  if (!isCuid(reportId)) {
    return fail(GECERSIZ_SIKAYET_ID, "reportId");
  }
  // Bilinmeyen durum değeri (istemci verisi) — matris kapısından önce reddedilir.
  const parsedStatus = reportStatusInputSchema.safeParse({ status });
  if (!parsedStatus.success) {
    return validationFail(parsedStatus.error);
  }
  const nextStatus = parsedStatus.data.status;

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true },
  });
  if (!report) {
    return fail(SIKAYET_BULUNAMADI);
  }
  if (!REPORT_STATUS_TRANSITIONS[report.status].includes(nextStatus)) {
    return fail(GECERSIZ_DURUM, "status");
  }

  // Atomik geçiş (admin/service.ts kalıbı): id + BEKLENEN durum tek yazımada —
  // iki yönetici aynı şikayete aynı anda karar verse bile ikincisi count===0
  // görür, last-write-wins olmaz.
  const res = await prisma.report.updateMany({
    where: { id: reportId, status: report.status },
    data: { status: nextStatus, updatedAt: new Date() },
  });
  if (res.count === 0) {
    return fail(GECERSIZ_DURUM, "status");
  }
  return ok(await prisma.report.findUniqueOrThrow({ where: { id: reportId } }));
}

/** Admin kuyruğu satırının hedefi — hedef silinmişse kırık link yoktur. */
export type ReportTarget = {
  type: ReportTargetType;
  /** Türkçe hedef etiketi (ilan başlığı / kullanıcı adı / "Silinmiş …"). */
  label: string;
  /** İnceleme bağlantısı; hedef silinmişse null. */
  href: string | null;
};

/**
 * Admin kuyruğu satırı — raporun kendisi + bildiren (azaltılmış) + hedef
 * bağlantısı. `Omit<Report, "reporter">`: Prisma'nın tam User ilişkisi
 * (passwordHash) yerine yalnız kuyrukta gösterilen alanlar seçilir.
 */
export type AdminReport = Omit<Report, "reporter"> & {
  reporter: { id: string; name: string; email: string };
  target: ReportTarget;
};

/** Hedef etiketi + inceleme linki; hedef yoksa kırık link üretilmez. */
function resolveTarget(
  targetType: ReportTargetType,
  targetId: string,
  listingTitleById: Map<string, string>,
  userNameById: Map<string, string>,
): ReportTarget {
  if (targetType === "LISTING") {
    const title = listingTitleById.get(targetId);
    return title === undefined
      ? {
          type: targetType,
          label: REPORT_TARGET_DELETED_LABELS.LISTING,
          href: null,
        }
      : { type: targetType, label: title, href: `/ilan/${targetId}` };
  }
  const name = userNameById.get(targetId);
  return name === undefined
    ? {
        type: targetType,
        label: REPORT_TARGET_DELETED_LABELS.USER,
        href: null,
      }
    : {
        type: targetType,
        label: name,
        href: "/admin/kullanicilar",
      };
}

/**
 * Şikayet kuyruğu — en yeniden eskiye. Yetki kapısı action katmanındadır
 * (requireAdmin); bu çekirdek yalnız GÖRÜNTÜLEME verisini hazırlar.
 */
export async function getReportsCore(): Promise<ActionResult<AdminReport[]>> {
  const reports = await prisma.report.findMany({
    include: {
      reporter: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Hedef etiketleri tek seferde çözülür (N+1 yok): LISTING → başlık +
  // /ilan/[id], USER → ad + /admin/kullanicilar (yöneticinin ban aracı).
  const listingIds = [
    ...new Set(
      reports
        .filter((report) => report.targetType === "LISTING")
        .map((report) => report.targetId),
    ),
  ];
  const userIds = [
    ...new Set(
      reports
        .filter((report) => report.targetType === "USER")
        .map((report) => report.targetId),
    ),
  ];
  const [listings, users] = await Promise.all([
    prisma.listing.findMany({
      where: { id: { in: listingIds } },
      select: { id: true, title: true },
    }),
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    }),
  ]);
  const listingTitleById = new Map(listings.map((l) => [l.id, l.title]));
  const userNameById = new Map(users.map((u) => [u.id, u.name]));

  const rows: AdminReport[] = reports.map((report) => ({
    ...report,
    target: resolveTarget(
      report.targetType,
      report.targetId,
      listingTitleById,
      userNameById,
    ),
  }));
  return ok(rows);
}
