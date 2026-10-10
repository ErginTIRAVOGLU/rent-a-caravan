import Link from "next/link";
import { Compass, Search } from "lucide-react";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return <div className="page-container grid min-h-[55vh] place-items-center py-14"><div className="max-w-xl text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-sage-pale text-forest"><Compass size={24} /></span><p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-sage-strong">404 · Rota bulunamadı</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Bu yol haritada yok.</h1><p className="mt-3 text-sm leading-6 text-ink-muted">Aradığın sayfa taşınmış ya da adresi değişmiş olabilir.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><ButtonLink href="/" variant="outline">Ana sayfa</ButtonLink><ButtonLink href="/arama"><Search size={16} /> Karavan ara</ButtonLink></div><Link href="/" className="sr-only">Ana sayfaya dön</Link></div></div>;
}
