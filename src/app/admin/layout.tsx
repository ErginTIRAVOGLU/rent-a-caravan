import type { Metadata } from "next";
import type { ReactNode } from "react";

import { requireAdmin } from "../../lib/auth";
import { getAdminCounts } from "../../server/panel/counts";
import { adminNavItems } from "../../components/panel/nav";
import { PanelShell } from "../../components/panel/PanelShell";

export const metadata: Metadata = {
  title: "Yönetim — Karavan Kiralama",
};

// `/admin` panel kabuğu: oturum kapısı (requireAdmin) + rol bazlı menü
// rozetleri burada bir kez hesaplanır (spec §7.5, §8). Sayfa içerikleri
// `children` olarak RSC şeklinde geçer; admin paneli bir CTA taşımaz (yönetici
// yeni ilan/kayıt oluşturmaz), bildirim zili açık şikâyet kuyruğuna gider.
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();
  const counts = await getAdminCounts();

  return (
    <PanelShell
      items={adminNavItems(counts)}
      brand={{ href: "/admin", label: "Yönetim", icon: "admin_panel_settings" }}
      navLabel="Yönetim menüsü"
      notifications={{ href: "/admin/sikayetler", count: counts.openReports }}
    >
      {children}
    </PanelShell>
  );
}
