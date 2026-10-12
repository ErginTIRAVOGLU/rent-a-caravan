import type { Metadata } from "next";
import Link from "next/link";
import type { ReportStatus } from "@prisma/client";

import { requireAdmin } from "../../../lib/auth";
import { REPORT_STATUS_LABELS } from "../../../lib/labels";
import { PageHeader } from "../../../components/panel/PageHeader";
import {
  StatusTabs,
  type TabOption,
} from "../../../components/panel/StatusTabs";
import { EmptyState } from "../../../components/panel/EmptyState";
import { parseTabValue } from "../../../components/panel/tabs";
import { getReportsCore, type AdminReport } from "../../../server/reports/service";
import { AdminReportsTable } from "./AdminReportsTable";

export const metadata: Metadata = {
  title: "Şikâyetler — Yönetim",
};

// `/admin/sikayetler` — durum sekmeleri (Açık/İnceleniyor/Kapatıldı) + sunucu
// tarafı `?q=` araması + tablo (spec §7.4, §8, §9). Durum geçişleri
// (OPEN→REVIEWING→CLOSED; CLOSED geri açılmaz) mevcut `ReportActions` adasıyla
// sunulur. Otomatik aksiyon yoktur.

/** Sekme sırası — ilk sekme (`OPEN`) varsayılandır. */
const STATUS_ORDER = ["OPEN", "REVIEWING", "CLOSED"] as const;

/** Boş sekme başlıkları — duruma özel, tek cümle. */
const EMPTY_TITLE: Record<ReportStatus, string> = {
  OPEN: "Açık şikayet yok",
  REVIEWING: "İncelenen şikayet yok",
  CLOSED: "Kapatılmış şikayet yok",
};

/** Tek değerli query alanı; dizi/undefined → boş metin. */
function firstValue(raw: string | string[] | undefined): string {
  return typeof raw === "string" ? raw : "";
}

/**
 * `q` eşleşmesi sayfanın sunduğu alanlarla sınırlıdır: gerekçe, hedef etiketi
 * (ilan başlığı / kullanıcı adı) ve bildiren adı/e-postası. Küçük/büyük harf
 * duyarsızdır.
 */
function matchesQuery(report: AdminReport, q: string): boolean {
  return [
    report.reason,
    report.target.label,
    report.reporter.name,
    report.reporter.email,
  ].some((value) => value.toLowerCase().includes(q));
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const result = await getReportsCore();
  // Kuyruk yüklenemezse BOŞ DURUM GÖSTERİLMEZ: "Henüz şikayet yok" demek
  // admin'e DB hatasını "şikayet gelmiyor" diye saklardı. Hata sınırına
  // (app/error.tsx) düşer; kullanıcı dürüst bir hata ekranı görür.
  if (!result.ok) {
    throw new Error(result.error);
  }
  const all = result.data;

  const durum = parseTabValue(
    params.durum,
    STATUS_ORDER,
    "OPEN",
  ) as ReportStatus;
  const q = firstValue(params.q).trim().toLowerCase();

  // Sayaçlar `q` uygulanmadan tam durum dağılımını verir.
  const counts: Record<ReportStatus, number> = {
    OPEN: 0,
    REVIEWING: 0,
    CLOSED: 0,
  };
  for (const report of all) {
    counts[report.status] += 1;
  }
  const total = all.length;

  const reports = all.filter(
    (report) =>
      report.status === durum && (q === "" || matchesQuery(report, q)),
  );

  const tabs: TabOption[] = STATUS_ORDER.map((value) => ({
    value,
    label: REPORT_STATUS_LABELS[value],
    count: counts[value],
  }));

  // Sekme linkleri mevcut `q` aramasını korur (StatusTabs sözleşmesi).
  const tabBasePath = q
    ? `/admin/sikayetler?q=${encodeURIComponent(q)}`
    : "/admin/sikayetler";
  const clearHref =
    durum === "OPEN" ? "/admin/sikayetler" : `/admin/sikayetler?durum=${durum}`;

  const showChrome = total > 0;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Yönetim"
        title="Şikâyetler"
        description="Kullanıcı bildirimlerini inceleyin; durumu açıktan incelemeye, incelemeden kapatıya taşıyın."
        actions={
          showChrome ? (
            <form
              method="get"
              action="/admin/sikayetler"
              role="search"
              className="flex items-center gap-2"
            >
              {durum !== "OPEN" ? (
                <input type="hidden" name="durum" value={durum} />
              ) : null}
              <label htmlFor="admin-sikayetler-q" className="sr-only">
                Şikayet ara
              </label>
              <input
                id="admin-sikayetler-q"
                name="q"
                type="search"
                defaultValue={firstValue(params.q).trim()}
                placeholder="Gerekçe, hedef veya bildiren ara"
                className="input h-11 w-48 sm:w-64"
              />
              <button
                type="submit"
                aria-label="Ara"
                className="btn btn-outline shrink-0"
              >
                <span className="material-symbols-outlined text-lg">
                  search
                </span>
              </button>
            </form>
          ) : null
        }
      />

      {showChrome ? (
        <div className="mb-4">
          <StatusTabs
            basePath={tabBasePath}
            param="durum"
            tabs={tabs}
            current={durum}
          />
        </div>
      ) : null}

      {reports.length === 0 ? (
        <div className="card">
          {q ? (
            <EmptyState
              icon="search_off"
              title="Aramanızla eşleşen şikayet yok"
              description="Farklı bir arama deneyin."
              action={
                <Link href={clearHref} className="btn btn-outline">
                  Aramayı temizle
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon="report_problem"
              title={EMPTY_TITLE[durum]}
              description="Bu durumda şikayet bulunmuyor."
              action={
                <Link href="/admin" className="btn btn-outline">
                  Genel Bakışa dön
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <div className="card overflow-hidden p-2 sm:p-4">
          <AdminReportsTable reports={reports} />
        </div>
      )}
    </div>
  );
}
