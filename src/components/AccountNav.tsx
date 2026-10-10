import Link from "next/link";

// Hesap alt menüsü — hesap sayfaları arasında gezinme (keşfedilebilirlik).
// Dokunma hedefi >= 40px (min-h-10); aktif sayfa aria-current ile işaretlenir.

const LINKS = [
  { href: "/hesap/ilanlarim", label: "İlanlarım", key: "ilanlarim", icon: "caravan" },
  { href: "/hesap/taleplerim", label: "Taleplerim", key: "taleplerim", icon: "inbox" },
  { href: "/hesap/profil", label: "Profil", key: "profil", icon: "person" },
] as const;

type AccountKey = (typeof LINKS)[number]["key"];

export function AccountNav({ current }: { current: AccountKey }) {
  return (
    <nav aria-label="Hesap menüsü" className="flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const active = link.key === current;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-label-lg font-semibold transition-colors ${
              active
                ? "bg-primary text-white hover:bg-primary-deep"
                : "bg-surface-low text-on-surface hover:bg-surface-mid"
            }`}
          >
            <span className="material-symbols-outlined text-lg">
              {link.icon}
            </span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}