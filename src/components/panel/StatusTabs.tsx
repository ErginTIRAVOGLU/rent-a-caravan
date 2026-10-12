import Link from "next/link";

import { tabHref, type TabOption } from "./tabs";

export type { TabOption } from "./tabs";

type StatusTabsProps = {
  /**
   * Sekmelerin bağlandığı yol. Mevcut query'yi korumak için `?q=…` biçiminde
   * eklenebilir; bileşen yolu ve query'yi ayırıp query'yi linklere taşır.
   */
  basePath: string;
  /** Query anahtarının adı (çağrı yerinde `durum` / `sekme`). */
  param: string;
  tabs: TabOption[];
  /** Şu an seçili sekmenin değeri (`parseTabValue` sonucu). */
  current: string;
};

/**
 * Sayaçlı durum sekmeleri — sunucu tarafı, bağlantı tabanlı (istemci durumu
 * yok). İlk sekme varsayılandır: linki query parametresini düşürür; diğer
 * sekmeler `?param=value` üretir. Aktif sekme `aria-current="page"` taşır.
 */
export function StatusTabs({ basePath, param, tabs, current }: StatusTabsProps) {
  const queryIndex = basePath.indexOf("?");
  const path = queryIndex === -1 ? basePath : basePath.slice(0, queryIndex);
  const search = queryIndex === -1 ? "" : basePath.slice(queryIndex + 1);
  const baseQuery = new URLSearchParams(search);

  const defaultValue = tabs[0]?.value;

  return (
    <nav
      aria-label="Durum sekmeleri"
      className="flex gap-1 overflow-x-auto border-b border-outline-variant/60"
    >
      {tabs.map((tab) => {
        const active = tab.value === current;
        const href = tabHref(
          path,
          baseQuery,
          param,
          tab.value === defaultValue ? "" : tab.value,
        );

        return (
          <Link
            key={tab.value}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 border-primary px-3 text-label-lg text-primary"
                : "inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-label-lg text-on-surface-variant transition-colors hover:text-primary"
            }
          >
            {tab.label}
            <span
              data-testid={`tab-count-${tab.value}`}
              className={
                active
                  ? "badge badge-primary tabular-nums"
                  : "badge badge-neutral tabular-nums"
              }
            >
              {tab.count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
