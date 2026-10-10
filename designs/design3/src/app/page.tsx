import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Compass, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { demoListings } from "@/lib/demo-data";
import { ListingCard } from "@/components/listing-card";
import { SearchForm } from "@/components/search-form";
import { ButtonLink, DemoBanner, SectionHeading } from "@/components/ui";
import { SiteImage } from "@/components/site-image";

const heroImage = "/manus-storage/async-images/8kcjvfQQz0kFwZzIaeFyYE/image-1.webp";

export default function HomePage() {
  return (
    <>
      <section className="page-container pb-10 pt-8 sm:pb-14 sm:pt-12 lg:pb-20 lg:pt-16">
        <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
          <div className="order-2 max-w-2xl lg:order-1">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-sage/30 bg-sage-pale px-3.5 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-forest"><Compass size={15} /> Rotanı özgürce çiz</p>
            <h1 className="font-display text-[2.65rem] font-extrabold leading-[1.04] tracking-[-0.055em] text-ink sm:text-6xl lg:text-[4.35rem]">Yol senin.<br /><span className="text-forest">Karavanın hazır.</span></h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">Kıyı yollarından serin yaylalara, sana uyan karavanı bul. Planını yap, talebini ilet; gerisini sahibiyle netleştir.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold text-ink-muted"><span className="inline-flex items-center gap-1.5"><Check size={15} className="text-forest" /> Şeffaf ilan bilgileri</span><span className="inline-flex items-center gap-1.5"><Check size={15} className="text-forest" /> Ödeme adımı yok</span></div>
          </div>
          <div className="order-1 relative min-h-[280px] overflow-hidden rounded-[2rem] bg-sage-pale sm:min-h-[380px] lg:order-2 lg:min-h-[470px]">
            <SiteImage src={heroImage} alt="Ege kıyısında gün ışığında duran örnek bir karavan" fill priority unoptimized sizes="(max-width: 1024px) 100vw, 54vw" className="object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/55 via-ink/10 to-transparent p-5 pt-20 sm:p-7 sm:pt-24"><span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-xs font-bold text-ink"><span className="size-2 rounded-full bg-accent" /> Ege&apos;de yeni bir rota</span></div>
            <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold text-ink">Görsel: örnek</span>
          </div>
        </div>
        <div className="relative z-10 mt-7 sm:-mt-1 lg:mt-8"><SearchForm /></div>
      </section>

      <section className="page-container pb-16 sm:pb-20">
        <DemoBanner className="mb-8" />
        <SectionHeading eyebrow="İlk durak" title="Yeni eklenen karavanlar" description="Farklı rotalara ve yol arkadaşlarına göre seçilmiş örnek ilanları keşfet." action={<ButtonLink href="/arama" variant="outline">Tüm ilanları gör <ArrowRight size={16} /></ButtonLink>} />
        <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">{demoListings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</div>
      </section>

      <section id="nasil-calisir" className="bg-sage-pale/65 py-16 sm:py-20">
        <div className="page-container">
          <SectionHeading eyebrow="Yol nasıl başlar?" title="Aramadan talebe, üç sade adım" description="Karavanını seç; kiralama planını sahibiyle doğrudan netleştir." />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { n: "01", icon: Compass, title: "Rotanı seç", text: "Şehir, tarih ve kişi sayısını gir; sana uyan karavanları karşılaştır." },
              { n: "02", icon: ShieldCheck, title: "Detayları incele", text: "Fotoğrafları, araç özelliklerini, kuralları ve gecelik fiyatı gör." },
              { n: "03", icon: UsersRound, title: "Talebini gönder", text: "Uygun tarihleri ve notunu ilet. Sahip yanıtladığında planını netleştir." },
            ].map(({ n, icon: Icon, title, text }) => <article key={n} className="relative rounded-3xl border border-line bg-white p-6 sm:p-7"><span className="font-display text-xs font-extrabold tracking-[0.16em] text-accent-deep">{n}</span><span className="mt-5 grid size-11 place-items-center rounded-2xl bg-sage-pale text-forest"><Icon size={19} /></span><h3 className="mt-5 font-display text-lg font-bold text-ink">{title}</h3><p className="mt-2 text-sm leading-6 text-ink-muted">{text}</p></article>)}
          </div>
          <p className="mt-5 text-xs leading-5 text-ink-muted">Talep göndermek rezervasyon onayı veya ödeme değildir. Bu sitedeki içerik ve işlemler demo amaçlıdır.</p>
        </div>
      </section>

      <section className="page-container py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-forest px-6 py-9 text-white sm:px-10 sm:py-12 lg:px-14">
          <div className="relative z-10 max-w-2xl"><p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-sage-light"><Sparkles size={15} /> Yol arkadaşınla paylaş</p><h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Karavanın yeni rotalara hazır mı?</h2><p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">İlan oluşturma akışını keşfet; fotoğrafları ve temel bilgileri ekleyerek örnek ilanını hazırla.</p><div className="mt-6 flex flex-wrap gap-3"><ButtonLink href="/hesap/ilanlarim/yeni" variant="secondary">İlanını oluşturmaya başla <ArrowRight size={16} /></ButtonLink><Link href="/giris" className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-white hover:bg-white/10">Hesap alanını gör <ArrowUpRight size={16} /></Link></div></div>
          <div aria-hidden="true" className="absolute -right-10 -top-20 hidden size-72 rounded-full border border-white/15 md:block" /><div aria-hidden="true" className="absolute -right-2 -top-12 hidden size-52 rounded-full border border-white/15 md:block" />
        </div>
      </section>
    </>
  );
}
