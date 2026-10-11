"use server";

import type { Report, ReportStatus, ReportTargetType } from "@prisma/client";

import { requireAdmin, requireUser } from "../../lib/auth";
import type { ActionResult } from "../../lib/result";
import {
  createReportCore,
  getReportsCore,
  updateReportStatusCore,
  type AdminReport,
} from "./service";

// Şikayet eylemleri — ince sarmalayıcılar; tüm doğrulama/yetki/iş mantığı
// service çekirdeğindedir. Aksiyonlar yalnız oturum kapısı uygular ve sonucu
// ActionResult olarak döner.

/** Bildirim oluştur — oturum kapısı; hedef/mükerrer/gerekçe kuralları service'te. */
export async function createReport(
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
): Promise<ActionResult<Report>> {
  const user = await requireUser();
  return createReportCore(user, targetType, targetId, reason);
}

/** Şikayet durumunu güncelle — oturum kapısı (ADMIN); durum matrisi service'te. */
export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
): Promise<ActionResult<Report>> {
  const admin = await requireAdmin();
  return updateReportStatusCore(admin, reportId, status);
}

/**
 * Şikayet kuyruğu — ADMIN kapısı. Admin sayfası sunucu bileşeni olarak
 * `getReportsCore()` ile okur; bu eylem istemci tarafı yenileme gereksinimleri
 * (ör. durum geçişi sonrası liste) için aynı kuyruğu döner.
 */
export async function getReports(): Promise<ActionResult<AdminReport[]>> {
  await requireAdmin();
  return getReportsCore();
}
