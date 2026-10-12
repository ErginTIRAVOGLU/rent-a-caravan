/**
 * Panel navigasyon config'i — saf veri ve yardımcılar.
 *
 * Sunucu layout'ları sayaçları hesaplar, buradan `PanelNavItem[]` üretir ve
 * `PanelShell`'e prop olarak geçer. Aktif öğe seçimi client tarafında
 * `isPanelItemActive(pathname, item)` ile yapılır.
 */

export type PanelNavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  exact?: boolean;
};

/** `/hesap` menü rozetleri için sunucu tarafı sayaçlar. */
export type AccountCounts = {
  listings: number;
  pendingIncoming: number;
  unreadMessages: number;
};

/** `/admin` menü rozetleri için sunucu tarafı sayaçlar. */
export type AdminCounts = {
  pendingListings: number;
  openReports: number;
};

/**
 * Rozet değeri: pozitifse sayıyı döner, 0 (ya da negatif) ise `undefined` —
 * böylece "0" rozeti hiç render edilmez.
 */
export function navBadge(value: number): number | undefined {
  return value > 0 ? value : undefined;
}

/**
 * Bir menü öğesi verilen yolda aktif mi?
 * - `exact` öğeler yalnızca tam yol eşleşmesinde aktif olur.
 * - Diğer öğeler tam yolda ya da `href + "/"` önekinde aktif olur; böylece
 *   `/hesap/ilan` öneki `/hesap/ilanlarim` öğesini tetiklemez.
 */
export function isPanelItemActive(
  pathname: string,
  item: PanelNavItem,
): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** `/hesap` (tüm kullanıcılar) menü öğeleri — sabit sıra. */
export function accountNavItems(counts: AccountCounts): PanelNavItem[] {
  return [
    { href: "/hesap", label: "Genel Bakış", icon: "dashboard", exact: true },
    {
      href: "/hesap/ilanlarim",
      label: "İlanlarım",
      icon: "rv_hookup",
      badge: navBadge(counts.listings),
    },
    {
      href: "/hesap/taleplerim",
      label: "Taleplerim",
      icon: "inbox",
      badge: navBadge(counts.pendingIncoming),
    },
    {
      href: "/hesap/mesajlar",
      label: "Mesajlar",
      icon: "chat_bubble",
      badge: navBadge(counts.unreadMessages),
    },
    {
      href: "/hesap/degerlendirmeler",
      label: "Değerlendirmeler",
      icon: "star",
    },
    { href: "/hesap/profil", label: "Profil", icon: "person" },
  ];
}

/** `/admin` menü öğeleri — sabit sıra. */
export function adminNavItems(counts: AdminCounts): PanelNavItem[] {
  return [
    { href: "/admin", label: "Genel Bakış", icon: "dashboard", exact: true },
    {
      href: "/admin/ilanlar",
      label: "İlanlar",
      icon: "rv_hookup",
      badge: navBadge(counts.pendingListings),
    },
    { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: "group" },
    {
      href: "/admin/sikayetler",
      label: "Şikâyetler",
      icon: "report_problem",
      badge: navBadge(counts.openReports),
    },
    { href: "/admin/ayarlar", label: "Ayarlar", icon: "settings" },
  ];
}
