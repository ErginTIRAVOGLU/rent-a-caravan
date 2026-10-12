import Link from "next/link";
import type { ReportStatus } from "@prisma/client";

import {
  REPORT_STATUS_LABELS,
  REPORT_TARGET_LABELS,
} from "../../../lib/labels";
import type { AdminReport } from "../../../server/reports/service";
import { ReportActions } from "./ReportActions";

/** @db/timestamp → DD.MM.YYYY (UTC; saat dilimi kaymaz). */
function formatDate(value: Date): string {
  const dd = String(value.getUTCDate()).padStart(2, "0");
  const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${value.getUTCFullYear()}`;
}

/** Durum rozeti renkleri — açık dikkat çeker, kapalı sakin. */
function statusBadgeClass(status: ReportStatus): string {
  switch (status) {
    case "OPEN":
      return "badge-error";
    case "REVIEWING":
      return "badge-primary";
    default:
      return "badge-neutral";
  }
}

/** Hedef hücresi — tür rozeti + (varsa) inceleme linki. */
function TargetCell({ report }: { report: AdminReport }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="badge badge-neutral">
        {REPORT_TARGET_LABELS[report.target.type]}
      </span>
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
    </div>
  );
}

/** Bildiren satırı — ad + e-posta. */
function ReporterLine({ report }: { report: AdminReport }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-on-surface-variant">
      <span>Bildiren:</span>
      <span className="font-semibold text-on-surface">
        {report.reporter.name}
      </span>
      <span>{report.reporter.email}</span>
    </p>
  );
}

/**
 * Admin şikayet kuyruğu — masaüstünde tablo, mobilde aynı veriyi taşıyan
 * kartlar. Durum geçişleri mevcut istemci adası `ReportActions` ile sunulur
 * (OPEN→İncele, REVIEWING→Kapat, CLOSED terminal).
 */
export function AdminReportsTable({ reports }: { reports: AdminReport[] }) {
  return (
    <>
      {/* Masaüstü tablo sunumu. */}
      <div
        data-testid="admin-reports-table"
        className="hidden overflow-x-auto md:block"
      >
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-outline-variant/60 text-label-md uppercase tracking-wider text-on-surface-variant">
              <th scope="col" className="px-3 py-3 font-medium">
                Gerekçe
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Hedef
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Durum
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Tarih
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Aksiyonlar
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr
                key={report.id}
                className="border-b border-outline-variant/40 align-top last:border-0"
              >
                <td className="px-3 py-4">
                  <p className="whitespace-pre-line break-words text-on-surface">
                    {report.reason}
                  </p>
                  <div className="mt-2">
                    <ReporterLine report={report} />
                  </div>
                </td>
                <td className="px-3 py-4">
                  <TargetCell report={report} />
                </td>
                <td className="px-3 py-4">
                  <span className={`badge ${statusBadgeClass(report.status)}`}>
                    {REPORT_STATUS_LABELS[report.status]}
                  </span>
                </td>
                <td className="px-3 py-4 text-on-surface-variant">
                  {formatDate(report.createdAt)}
                </td>
                <td className="px-3 py-4">
                  <ReportActions reportId={report.id} status={report.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil kart sunumu — aynı veri. */}
      <ul data-testid="admin-reports-cards" className="space-y-4 md:hidden">
        {reports.map((report) => (
          <li
            key={report.id}
            className="rounded-xl border border-outline-variant/60 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${statusBadgeClass(report.status)}`}>
                {REPORT_STATUS_LABELS[report.status]}
              </span>
              <span className="text-body-sm text-on-surface-variant">
                {formatDate(report.createdAt)}
              </span>
            </div>

            <p className="mt-2 whitespace-pre-line break-words text-body-md text-on-surface">
              {report.reason}
            </p>

            <div className="mt-2">
              <ReporterLine report={report} />
            </div>

            <div className="mt-2">
              <span className="mr-2 text-body-sm text-on-surface-variant">
                Hedef:
              </span>
              <TargetCell report={report} />
            </div>

            <div className="mt-4">
              <ReportActions reportId={report.id} status={report.status} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
