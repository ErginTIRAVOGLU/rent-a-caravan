import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Route } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { DemoBanner } from "@/components/ui";

export const metadata: Metadata = { title: "Hesap oluştur" };

export default function RegisterPage() {
  return <div className="page-container grid min-h-[65vh] items-center gap-10 py-10 lg:grid-cols-[0.85fr_1fr] lg:py-16"><div className="mx-auto w-full max-w-md"><Link href="/" className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-ink-muted hover:text-forest"><ArrowLeft size={16} /> Ana sayfa</Link><div className="mb-5"><DemoBanner /></div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-sage-strong">Rotaya katıl</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Hesabını oluştur</h1><p className="mb-6 mt-2 text-sm leading-6 text-ink-muted">Kiracı veya ilan sahibi olmak için tek hesap yeterli. Bu demo formu hesap oluşturmaz.</p><AuthForm mode="register" /></div><div className="hidden rounded-[2rem] bg-sage-pale p-10 lg:block"><span className="grid size-12 place-items-center rounded-2xl bg-white text-forest"><Route size={22} /></span><h2 className="mt-8 max-w-md font-display text-4xl font-extrabold tracking-tight text-forest">Yola çıkmanın kendi ritmi var.</h2><p className="mt-4 max-w-md text-sm leading-7 text-ink-muted">Rotanı seç, karavanını bul ve talep sürecini sahibiyle açıkça yönet.</p><div className="mt-10 rounded-2xl border border-sage/30 bg-white/75 p-5 text-sm leading-6 text-ink-muted">Demo sürümünde kullanıcı hesabı, oturum veya profil bilgisi kalıcı olarak kaydedilmez.</div></div></div>;
}
