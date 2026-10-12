"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isPanelItemActive, type PanelNavItem } from "./nav";

type PanelSidebarProps = {
  items: readonly PanelNavItem[];
  /** Rol/marka başlığı; verilmezse yalnız menü render edilir. */
  brand?: { href: string; label: string; icon: string };
  /** Alt CTA (ör. "+ Yeni İlan"). */
  cta?: { href: string; label: string };
  /** Erişilebilirlik etiketi. */
  navLabel?: string;
  /** Mobil offcanvas'ta öğeye tıklanınca çağrılır (kapatma). */
  onNavigate?: () => void;
};

/**
 * Panel sidebar içeriği — aktif öğe `usePathname` ile belirlenir. Konumlandırma
 * (masaüstü sabit / mobil offcanvas) `PanelShell`'e aittir; bu bileşen yalnız
 * içeriği render eder.
 */
export function PanelSidebar({
  items,
  brand,
  cta,
  navLabel = "Panel menüsü",
  onNavigate,
}: PanelSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col px-4 py-4 sm:px-6 lg:px-5 lg:py-6">
      {brand ? (
        <Link
          href={brand.href}
          onClick={onNavigate}
          className="flex items-center gap-2 text-headline-md font-bold text-primary"
        >
          <span className="material-symbols-outlined text-accent">
            {brand.icon}
          </span>
          {brand.label}
        </Link>
      ) : null}

      <nav
        aria-label={navLabel}
        className="mt-4 flex flex-col gap-1.5 lg:mt-6"
      >
        {items.map((item) => {
          const active = isPanelItemActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={
                active
                  ? "inline-flex min-h-10 items-center gap-2.5 rounded-lg bg-primary px-3.5 text-label-lg text-white transition-colors"
                  : "inline-flex min-h-10 items-center gap-2.5 rounded-lg px-3.5 text-label-lg text-on-surface-variant transition-colors hover:bg-surface-low hover:text-primary"
              }
            >
              <span className="material-symbols-outlined text-lg">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge !== undefined ? (
                <span
                  data-testid={`nav-badge-${item.href}`}
                  className={
                    active
                      ? "flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[10px] font-bold text-white"
                      : "flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary"
                  }
                  aria-label={`${item.badge} adet`}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {cta ? (
        <Link
          href={cta.href}
          onClick={onNavigate}
          className="btn btn-accent mt-4"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          {cta.label}
        </Link>
      ) : null}

      <div className="mt-auto border-t border-outline-variant/60 pt-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="inline-flex items-center gap-1.5 text-body-sm text-on-surface-variant transition-colors hover:text-primary"
        >
          <span className="material-symbols-outlined text-base">
            arrow_back
          </span>
          Siteye dön
        </Link>
      </div>
    </div>
  );
}
