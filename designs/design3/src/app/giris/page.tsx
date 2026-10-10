import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { DemoBanner } from "@/components/ui";

export const metadata: Metadata = { title: "Giriş yap" };

export default function LoginPage() {
  return <div className="page-container grid min-h-[65vh] items-center gap-10 py-10 lg:grid-cols-[1fr_0.85fr] lg:py-16"><div className="hidden rounded-[2rem] bg-forest p-10 text-white lg:block"><span className="grid size-12 place-items-center rounded-2xl bg-white/10"><Compass size={22} /></span><h1 className="mt-8 max-w-md font-display text-4xl font-extrabold tracking-tight">Yeni bir rota, tek bir hesapla başlar.</h1><p className="mt-4 max-w-md text-sm leading-7 text-white/70">Aynı hesapla karavan ara, talep gönder veya kendi ilanını hazırla.</p><div className="mt-10 border-t border-white/15 pt-5 text-xs text-white/60">Örnek arayüz · gerçek giriş bağlantısı kurulmamıştır.</div></div><div className="mx-auto w-full max-w-md"><Link href="/" className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-ink-muted hover:text-forest"><ArrowLeft size={16} /> Ana sayfa</Link><div className="mb-5"><DemoBanner /></div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-sage-strong">Yoluna devam et</p><h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Tekrar hoş geldin</h2><p className="mb-6 mt-2 text-sm leading-6 text-ink-muted">Hesap bilgilerini gir. Bu demo formu bilgileri sunucuya göndermez.</p><AuthForm mode="login" /></div></div>;
}
