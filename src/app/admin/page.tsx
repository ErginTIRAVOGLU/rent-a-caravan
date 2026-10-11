import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "../../lib/prisma";

export const metadata: Metadata = {
  title: "Genel Bakış — Yönetim",
};

/**
 * Yönetim genel bakışı: canlı sayaçlar. Açık şikâyet kartı artık çalışan
 * `/admin/sikayetler` kuyruğuna bağlanır (şikâyet akışı Plan 2'de tamamlandı).
 */
export default async function AdminDashboardPage() {
  const [pendingListings, activeListings, userCount, openReports] =
    await Promise.all([
      prisma.listing.count({ where: { status: "PENDING" } }),
      prisma.listing.count({ where: { status: "ACTIVE" } }),
      prisma.user.count(),
      prisma.report.count({ where: { status: "OPEN" } }),
    ]);

  const cards = [
    {
      label: "Bekleyen ilan",
      value: pendingListings,
      href: "/admin/ilanlar",
      hint: "İnceleme sırasındaki ilanlar",
      icon: "rv_hookup",
      color: "accent",
    },
    {
      label: "Aktif ilan",
      value: activeListings,
      href: "/admin/ilanlar",
      hint: "Yayında olan ilanlar",
      icon: "check_circle",
      color: "success",
    },
    {
      label: "Kullanıcı",
      value: userCount,
      href: "/admin/kullanicilar",
      hint: "Kayıtlı tüm hesaplar",
      icon: "people",
      color: "primary",
    },
    {
      label: "Açık şikâyet",
      value: openReports,
      href: "/admin/sikayetler",
      hint: "İnceleme bekleyen bildirimler",
      icon: "report_problem",
      color: "error",
    },
  ];

  const colorTokens: Record<string, { bg: string; text: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary" },
    secondary: { bg: "bg-secondary/10", text: "text-secondary" },
    accent: { bg: "bg-accent-soft", text: "text-accent-deep" },
    success: { bg: "bg-success-bg", text: "text-success" },
    error: { bg: "bg-error-bg", text: "text-error" },
    info: { bg: "bg-info-bg", text: "text-info" },
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-12">
      <header className="mb-6">
        <span className="eyebrow">Yönetim</span>
        <h1 className="mt-1 text-headline-lg font-bold text-primary">Genel Bakış</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Platformun güncel durumu ve bekleyen moderasyon işleri.
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const token = colorTokens[card.color];
          const iconBg = token.bg;
          const iconText = token.text;
          const body = (
            <>
              <p className="text-headline-lg font-bold text-on-surface">{card.value}</p>
              <p className="mt-1 font-semibold text-on-surface-variant">{card.label}</p>
              <p className="mt-1 text-body-sm text-on-surface-variant">{card.hint}</p>
            </>
          );
          return (
            <li key={card.label}>
              {card.href ? (
                <Link
                  href={card.href}
                  className="card p-5 hover:shadow-raised transition-shadow"
                >
                  {body}
                  <div className="mt-4 flex items-center justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg} ${iconText}`}>
                      <span className="material-symbols-outlined text-xl">{card.icon}</span>
                    </div>
                    <span className="material-symbols-outlined text-outline">chevron_right</span>
                  </div>
                </Link>
              ) : (
                <div className="card p-5">
                  {body}
                  <div className="mt-4 flex items-center justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg} ${iconText}`}>
                      <span className="material-symbols-outlined text-xl">{card.icon}</span>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}