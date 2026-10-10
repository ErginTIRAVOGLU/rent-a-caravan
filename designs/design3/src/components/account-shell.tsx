import type { ReactNode } from "react";
import { AccountNav } from "@/components/account-nav";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DemoBanner } from "@/components/ui";

export function AccountShell({ title, description, children, admin = false }: { title: string; description: string; children: ReactNode; admin?: boolean }) {
  return (
    <div className="page-container py-8 sm:py-12">
      <div className="mb-7"><Breadcrumbs items={[{ label: "Ana sayfa", href: "/" }, { label: admin ? "Yönetim" : "Hesap", href: admin ? "/admin/ilanlar" : "/hesap/ilanlarim" }, { label: title }]} /><p className="mb-2 text-xs font-extrabold uppercase tracking-[0.15em] text-sage-strong">{admin ? "Karavan · Yönetim" : "Karavan · Hesap alanı"}</p><h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{description}</p></div>
      <DemoBanner className="mb-6" />
      <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8"><AccountNav admin={admin} /><section className="min-w-0">{children}</section></div>
    </div>
  );
}
