"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

/**
 * Yönetim navigasyonu — aktif rota `usePathname` ile belirlenir (server
 * layout'ta pathname yok). lg'de dikey sidebar, altında yatay kaydırılabilir
 * çubuk olarak davranır.
 */
export function AdminNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Yönetim menüsü"
      className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-1.5 lg:overflow-visible"
    >
      {items.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "inline-flex min-h-10 shrink-0 items-center gap-2.5 rounded-lg bg-primary px-3.5 text-label-lg text-white transition-colors lg:w-full"
                : "inline-flex min-h-10 shrink-0 items-center gap-2.5 rounded-lg px-3.5 text-label-lg text-on-surface-variant transition-colors hover:bg-surface-low hover:text-primary lg:w-full"
            }
          >
            <span className="material-symbols-outlined text-lg">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
