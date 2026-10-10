"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, House, UserRound, UsersRound, ShieldCheck, Plus } from "lucide-react";

const memberItems = [
  { href: "/hesap/ilanlarim", label: "İlanlarım", icon: House },
  { href: "/hesap/taleplerim", label: "Taleplerim", icon: ClipboardList },
  { href: "/hesap/profil", label: "Profil", icon: UserRound },
];
const adminItems = [
  { href: "/admin/ilanlar", label: "İlan moderasyonu", icon: House },
  { href: "/admin/kullanicilar", label: "Kullanıcılar", icon: UsersRound },
];

export function AccountNav({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  const items = admin ? adminItems : memberItems;
  return (
    <nav aria-label={admin ? "Yönetim menüsü" : "Hesap menüsü"} className="rounded-3xl border border-line bg-white p-3">
      {admin ? <div className="mb-2 flex items-center gap-2 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.13em] text-ink-faint"><ShieldCheck size={15} /> Yönetim</div> : null}
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/hesap/ilanlarim" && pathname.startsWith(`${href}/`));
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-sm font-semibold transition-colors ${active ? "bg-sage-pale text-forest" : "text-ink-muted hover:bg-paper hover:text-ink"}`}><Icon size={17} />{label}</Link>;
      })}
      {!admin ? <Link href="/hesap/ilanlarim/yeni" className="mt-3 flex min-h-11 items-center gap-3 rounded-2xl border border-dashed border-sage bg-paper px-3.5 text-sm font-bold text-forest hover:bg-sage-pale"><Plus size={17} /> İlan oluştur</Link> : null}
    </nav>
  );
}
