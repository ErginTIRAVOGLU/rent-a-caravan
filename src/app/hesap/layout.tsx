import type { ReactNode } from "react";

import { requireUser } from "../../lib/auth";
import { getAccountCounts } from "../../server/panel/counts";
import { accountNavItems } from "../../components/panel/nav";
import { PanelShell } from "../../components/panel/PanelShell";

// `/hesap` panel kabuğu: oturum kapısı + rol bazlı menü rozetleri burada bir
// kez hesaplanır (spec §6, §7.5). Sayfa içerikleri `children` olarak RSC
// şeklinde geçer; diğer `/hesap/*` sayfaları Task 8'e kadar kendi eski
// `AccountNav`'larını render etmeye devam eder (geçici durum).

export default async function HesapLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const counts = await getAccountCounts(user.id);

  return (
    <PanelShell
      items={accountNavItems(counts)}
      cta={{ href: "/hesap/ilanlarim/yeni", label: "+ Yeni İlan" }}
      navLabel="Hesap menüsü"
      notifications={{
        href: "/hesap/mesajlar",
        endpoint: "/api/messages/unread-count",
      }}
    >
      {children}
    </PanelShell>
  );
}
