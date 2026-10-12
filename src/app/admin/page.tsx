import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "../../lib/prisma";
import { REPORT_TARGET_LABELS } from "../../lib/labels";
import { PageHeader } from "../../components/panel/PageHeader";
import { StatCard } from "../../components/panel/StatCard";
import { PanelCard } from "../../components/panel/PanelCard";
import { EmptyState } from "../../components/panel/EmptyState";

export const metadata: Metadata = {
  title: "Genel Bakış",
};

/** @db timestamp → DD.MM.YYYY (UTC; saat dilimi kaymaz). */
function formatDate(value: Date): string {
  const dd = String(value.getUTCDate()).padStart(2, "0");
  const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${value.getUTCFullYear()}`;
}

/** Son aktivite akışının normalize edilmiş olayı. */
type ActivityEvent = {
  id: string;
  icon: string;
  label: string;
  detail: string;
  href?: string;
  at: Date;
};

/**
 * Yönetim genel bakışı (spec §8): 4 stat kartı + moderasyon kuyruğu (en yeni 3
 * PENDING ilan) + şikâyet kuyruğu (en yeni 2 OPEN şikâyet) + son aktivite.
 *
 * "Son aktivite" MEVCUT tablolardan türetilir — yeni DB alanı yok (spec §11):
 * en yeni ilan başvuruları (Listing.createdAt), açılan şikâyetler
 * (Report.createdAt), yeni kullanıcılar (User.createdAt) ve onaylanan ilanlar
 * (ListingStatusHistory → PENDING→ACTIVE, createdAt). Dört kaynak birleşip
 * zaman ekseninde sıralanır, en yeni 4 olay gösterilir.
 */
export default async function AdminDashboardPage() {
  const [
    pendingListings,
    activeListings,
    userCount,
    openReports,
    moderationQueue,
    reportQueue,
    recentListings,
    recentReports,
    recentUsers,
    recentApprovals,
  ] = await Promise.all([
    prisma.listing.count({ where: { status: "PENDING" } }),
    prisma.listing.count({ where: { status: "ACTIVE" } }),
    prisma.user.count(),
    prisma.report.count({ where: { status: "OPEN" } }),
    // Moderasyon kuyruğu: en yeni PENDING ilanlar (en eski değil — admin'in
    // bekleyen işine güncel bakış).
    prisma.listing.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        city: true,
        createdAt: true,
        owner: { select: { name: true } },
      },
    }),
    // Şikâyet kuyruğu: en yeni OPEN şikâyetler.
    prisma.report.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: {
        id: true,
        reason: true,
        targetType: true,
        createdAt: true,
        reporter: { select: { name: true } },
      },
    }),
    prisma.listing.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, targetType: true, createdAt: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.listingStatusHistory.findMany({
      where: { fromStatus: "PENDING", toStatus: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        listingId: true,
        createdAt: true,
        listing: { select: { title: true } },
      },
    }),
  ]);

  const events: ActivityEvent[] = [
    ...recentListings.map((listing) => ({
      id: `listing-${listing.id}`,
      icon: "rv_hookup",
      label: "Yeni ilan başvurusu",
      detail: listing.title,
      href: `/admin/ilanlar/${listing.id}`,
      at: listing.createdAt,
    })),
    ...recentReports.map((report) => ({
      id: `report-${report.id}`,
      icon: "report_problem",
      label: "Şikâyet açıldı",
      detail: REPORT_TARGET_LABELS[report.targetType],
      href: "/admin/sikayetler",
      at: report.createdAt,
    })),
    ...recentUsers.map((user) => ({
      id: `user-${user.id}`,
      icon: "person_add",
      label: "Yeni kullanıcı",
      detail: user.name,
      href: "/admin/kullanicilar",
      at: user.createdAt,
    })),
    ...recentApprovals.map((entry) => ({
      id: `approval-${entry.id}`,
      icon: "check_circle",
      label: "İlan onaylandı",
      detail: entry.listing.title,
      href: `/admin/ilanlar/${entry.listingId}`,
      at: entry.createdAt,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader eyebrow="Yönetim" title="Genel Bakış" />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Bekleyen ilan"
          value={pendingListings}
          icon="rv_hookup"
          tone="accent"
          href="/admin/ilanlar"
        />
        <StatCard
          label="Aktif ilan"
          value={activeListings}
          icon="check_circle"
          tone="success"
          href="/admin/ilanlar"
        />
        <StatCard
          label="Kullanıcı"
          value={userCount}
          icon="group"
          tone="primary"
          href="/admin/kullanicilar"
        />
        <StatCard
          label="Açık şikâyet"
          value={openReports}
          icon="report_problem"
          tone="error"
          href="/admin/sikayetler"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <PanelCard
          title="Moderasyon kuyruğu"
          className="lg:col-span-2"
          action={
            <Link
              href="/admin/ilanlar"
              className="text-body-sm font-semibold text-primary hover:underline"
            >
              Tümünü gör
            </Link>
          }
        >
          {moderationQueue.length === 0 ? (
            <EmptyState
              icon="check_circle"
              title="Moderasyon bekleyen ilan yok"
              description="İnceleme kuyruğu boş; yeni başvurular burada görünür."
            />
          ) : (
            <ul className="divide-y divide-outline-variant/60">
              {moderationQueue.map((listing) => (
                <li
                  key={listing.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-on-surface">
                      {listing.title}
                    </p>
                    <p className="mt-0.5 text-body-sm text-on-surface-variant">
                      {listing.city} · {listing.owner.name} ·{" "}
                      {formatDate(listing.createdAt)}
                    </p>
                  </div>
                  <Link
                    href={`/admin/ilanlar/${listing.id}`}
                    className="btn btn-outline py-2"
                  >
                    İncele
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard
          title="Şikâyet kuyruğu"
          action={
            <Link
              href="/admin/sikayetler"
              className="text-body-sm font-semibold text-primary hover:underline"
            >
              Tümünü gör
            </Link>
          }
        >
          {reportQueue.length === 0 ? (
            <EmptyState
              icon="report_off"
              title="Açık şikâyet yok"
              description="Yeni bildirimler burada listelenir."
            />
          ) : (
            <ul className="divide-y divide-outline-variant/60">
              {reportQueue.map((report) => (
                <li key={report.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="break-words text-body-md text-on-surface">
                    {report.reason}
                  </p>
                  <p className="mt-1 text-body-sm text-on-surface-variant">
                    {report.reporter.name} ·{" "}
                    {REPORT_TARGET_LABELS[report.targetType]} ·{" "}
                    {formatDate(report.createdAt)}
                  </p>
                  <Link
                    href="/admin/sikayetler"
                    className="mt-2 inline-flex text-body-sm font-semibold text-primary hover:underline"
                  >
                    Kuyruğa git
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>

      <div className="mt-6">
        <PanelCard title="Son aktivite">
          {events.length === 0 ? (
            <EmptyState
              icon="history"
              title="Henüz aktivite yok"
              description="Yeni olaylar burada listelenir."
            />
          ) : (
            <ul className="divide-y divide-outline-variant/60">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-low text-on-surface-variant">
                    <span className="material-symbols-outlined text-lg">
                      {event.icon}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-md text-on-surface">
                      {event.href ? (
                        <Link
                          href={event.href}
                          className="font-semibold hover:text-primary hover:underline"
                        >
                          {event.label}
                        </Link>
                      ) : (
                        <span className="font-semibold">{event.label}</span>
                      )}
                    </p>
                    <p className="truncate text-body-sm text-on-surface-variant">
                      {event.detail}
                    </p>
                  </div>
                  <span className="shrink-0 text-body-sm text-on-surface-variant">
                    {formatDate(event.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </div>
    </div>
  );
}
