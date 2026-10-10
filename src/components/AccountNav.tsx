import Link from "next/link";

// Hesap alt menüsü — hesap sayfaları arasında gezinme (keşfedilebilirlik).
// Dokunma hedefi >= 40px (min-h-10); aktif sayfa aria-current ile işaretlenir.

const LINKS = [
  { href: "/hesap/ilanlarim", label: "İlanlarım", key: "ilanlarim" },
  { href: "/hesap/taleplerim", label: "Taleplerim", key: "taleplerim" },
  { href: "/hesap/profil", label: "Profilim", key: "profil" },
] as const;

type AccountKey = (typeof LINKS)[number]["key"];

export function AccountNav({ current }: { current: AccountKey }) {
  return (
    <nav aria-label="Hesap menüsü" className="mt-4 flex flex-wrap gap-1">
      {LINKS.map((link) => {
        const active = link.key === current;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold hover:bg-gray-100 ${
              active
                ? "bg-emerald-50 text-emerald-800"
                : "text-gray-700 hover:text-emerald-700"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
