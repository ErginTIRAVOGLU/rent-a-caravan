import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "../../../lib/auth";
import {
  REPORT_STATUS_LABELS,
  REPORT_TARGET_LABELS,
} from "../../../lib/labels";
import { getReportsCore } from "../../../server/reports/service";
import { ReportActions } from "./ReportActions";

export const metadata: Metadata = {
  title: "Şikâyetler — Yönetim",
};

/** @db/timestamp → DD.MM.YYYY (UTC; saat dilimi kaymaz). */
function formatDate(value: Date): string {
  const dd = String(value.getUTCDate()).padStart(2, "0");
  const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${value.getUTCFullYear()}`;
}

/** Durum rozeti renkleri — açık dikkat çeker, kapalı sakin. */
function statusBadgeClass(status: keyof typeof REPORT_STATUS_LABELS): string {
  switch (status) {
    case "OPEN":
      return "badge-error";
    case "REVIEWING":
      return "badge-primary";
    default:
      return "badge-neutral";
  }
}

/**
 * Şikayet kuyruğu (spec §8): gerekçe, bildiren, hedefe link, durum rozeti ve
 * tarih. Durum geçişleri matriste olan düğmelerle sunulur (OPEN→REVIEWING→
 * CLOSED; CLOSED geri açılmaz). Otomatik aksiyon yoktur — yönetici gerekip
 * görürse ilanı duraklatma/kullanıcı banlama araçlarını kullanır (satırdaki
 * hedef linkleri bu yüzden ilan detayına ve kullanıcı listesine gider).
 */
export default async function AdminReportsPage() {
  await requireAdmin();

  const result = await getReportsCore();
  // Kuyruk yüklenemezse BOŞ DURUM GÖSTERİLMEZ: "Henüz şikayet yok" demek
  // admin'e DB hatasını "şikayet gelmiyor" diye saklardı. Hata sınırına
  // (app/error.tsx) düşer; kullanıcı dürüst bir hata ekranı görür.
  if (!result.ok) {
    throw new Error(result.error);
  }
  const reports = result.data;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-12">
      <header className="mb-6">
        <span className="eyebrow">Yönetim</span>
        <h1 className="mt-1 text-headline-lg font-bold text-primary">
          Şikâyetler
        </h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Kullanıcı bildirimlerini inceleyin; durumu açıktan incelemeye,
          incelemeden kapatıya taşıyın. Kapatılan şikayet yeniden açılmaz.
        </p>
      </header>

      {reports.length === 0 ? (
        <div className="card mt-8 p-8 text-center">
          <span className="material-symbols-outlined text-3xl text-outline">
            report_problem
          </span>
          <p className="mt-2 font-semibold text-on-surface">Henüz şikayet yok</p>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Kullanıcılar ilan veya hesap bildiriminde bulunduğunda burada
            listelenir.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {reports.map((report) => (
            <li key={report.id} className="card p-4 sm:p-5">
              <div className="sm:flex sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`badge ${statusBadgeClass(report.status)}`}
                    >
                      {REPORT_STATUS_LABELS[report.status]}
                    </span>
                    <span className="badge badge-neutral">
                      {REPORT_TARGET_LABELS[report.target.type]}
                    </span>
                    <span className="text-body-sm text-on-surface-variant">
                      {formatDate(report.createdAt)}
                    </span>
                  </div>

                  <p className="mt-2 whitespace-pre-line break-words text-body-md text-on-surface">
                    {report.reason}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-on-surface-variant">
                    <span>Bildiren:</span>
                    <span className="font-semibold text-on-surface">
                      {report.reporter.name}
                    </span>
                    <span>{report.reporter.email}</span>
                  </div>

                  <p className="mt-1 text-body-sm text-on-surface-variant">
                    Hedef:{" "}
                    {report.target.href ? (
                      <Link
                        href={report.target.href}
                        className="font-semibold text-primary hover:underline"
                      >
                        {report.target.label}
                      </Link>
                    ) : (
                      <span className="font-semibold">{report.target.label}</span>
                    )}
                  </p>
                </div>

                <ReportActions reportId={report.id} status={report.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
