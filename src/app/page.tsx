import Link from "next/link";
import { prisma } from "../lib/prisma";
import { ListingCard } from "../components/ListingCard";
import { SearchFilters } from "../components/SearchFilters";

const steps = [
  {
    no: "01",
    icon: "search",
    title: "Karavanını Seç",
    text: "Şehir, tarih ve bütçene göre filtrele; ilan detaylarında donanım ve kuralları incele.",
    link: { href: "/arama", label: "Karavanları keşfet" },
  },
  {
    no: "02",
    icon: "calendar_month",
    title: "Talebinizi Gönder",
    text: "Konaklama tarihlerini seç ve ilan sahibine ücretsiz talep gönder. Ön ödeme yok.",
    link: { href: "/giris", label: "Giriş yap ve talep gönder" },
  },
  {
    no: "03",
    icon: "key",
    title: "Onay Al ve Yola Çık",
    text: "Sahibi onayladıktan sonra doğrudan iletişime geç; teslim ve ödeme detaylarını birlikte netleştirin.",
    link: { href: "/hesap/taleplerim", label: "Taleplerimi gör" },
  },
];

const guarantees = [
  { icon: "verified_user", title: "Admin onaylı ilanlar", text: "Her ilan yayın öncesi incelenir." },
  { icon: "forum", title: "Doğrudan iletişim", text: "Mesajlaşın, aracı yok, komisyon yok." },
  { icon: "credit_card_off", title: "Ön ödeme yok", text: "Platform ödeme işlemez; ödeme sahibe ait." },
];

const popularSearches = [
  { label: "Hafta sonu müsait ilanlar", href: "/arama?baslangic=2026-10-16&bitis=2026-10-18" },
  { label: "Motorkaravanlar", href: "/arama?aracTipi=MOTORHOME" },
  { label: "Panelvanlar", href: "/arama?aracTipi=PANELVAN" },
  { label: "Aileye uygun geniş karavanlar", href: "/arama?kisi=4" },
];

export default async function Home() {
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return (
    <>
      {/* Hero + arama kutusu — sabit header'ın altında başlar */}
      <section className="relative -mt-20 overflow-hidden bg-primary">
        {/* Ambiyans fotoğraf + derinlik katmanları */}
        <div
          aria-hidden
          className="absolute inset-0 scale-105 bg-cover bg-center opacity-40 mix-blend-overlay"
          style={{ backgroundImage: "url('/images/hero-ambient.jpg')" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-primary via-primary/85 to-primary/55"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-secondary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent/15 blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-32 sm:px-6 lg:px-12 lg:pt-40">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-label-md text-white backdrop-blur-md">
              <span className="material-symbols-outlined text-base text-accent">explore</span>
              Türkiye&apos;nin Doğrulanmış Karavan Kiralama Ağı
            </span>

            <h1 className="mt-6 text-display text-white drop-shadow-sm">
              Türkiye&apos;nin En Güzel Rotalarını Karavanla Keşfet
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-body-lg text-white/85">
              Türkiye genelindeki karavanlar arasından tarihinize ve bütçenize uygun
              olanı bulun, doğrudan sahibiyle iletişime geçin.
            </p>
          </div>

          {/* Yüzen arama kartı */}
          <div className="mx-auto mt-8 max-w-5xl rounded-2xl bg-white/95 p-5 text-left shadow-raised backdrop-blur-sm sm:p-6">
            <SearchFilters submitLabel="Karavan Ara" submitVariant="accent" />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-body-sm text-on-surface-variant">
              <span className="text-primary font-medium">Popüler aramalar:</span>
              {popularSearches.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-white px-3 py-1 text-body-sm text-primary hover:bg-primary-50 hover:border-primary transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Güven şeridi */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-body-md text-white/85">
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-accent">verified_user</span>
              Onaylı ilanlar
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-accent">credit_card_off</span>
              Ön ödeme yok
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-accent">forum</span>
              Doğrudan sahibiyle iletişim
            </span>
          </div>
        </div>
      </section>

      {/* Öne çıkan ilanlar */}
      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Öne çıkan</p>
            <h2 className="section-title mt-1">Popüler Karavanlar</h2>
          </div>
          <Link href="/arama" className="btn btn-outline btn-sm">
            Tümünü Gör
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>

        {listings.length === 0 ? (
          <div className="card mt-6 p-10 text-center">
            <span className="material-symbols-outlined text-4xl text-outline">rv_hookup</span>
            <p className="mt-3 font-semibold text-on-surface">Şu anda yayında karavan yok</p>
            <p className="mt-1 text-body-md text-on-surface-variant">
              İlk ilanı siz oluşturun; yayın öncesi admin onayından geçer.
            </p>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </ul>
        )}
      </section>

      {/* Nasıl çalışır */}
      <section id="nasil-calisir" className="border-t border-outline-variant/60 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Nasıl çalışır?</p>
            <h2 className="section-title mt-2">3 Adımda Özgürlüğe Çık</h2>
            <p className="mt-3 text-body-lg text-on-surface-variant">
              İlanı gezerken bile hiçbir ücret ödemezsiniz. Karavanı belirlersiniz,
              talep gönderirsiniz, sahibi onayladıktan sonra yola çıkarsınız.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.no} className="card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-deep">
                    <span className="material-symbols-outlined text-xl">{step.icon}</span>
                  </span>
                  <span className="text-label-sm text-outline">{step.no}</span>
                </div>
                <h3 className="mt-4 text-headline-sm font-bold text-primary">{step.title}</h3>
                <p className="mt-2 text-body-md text-on-surface-variant">{step.text}</p>
                {step.link ? (
                  <Link
                    href={step.link.href}
                    className="mt-3 inline-flex items-center gap-1 text-label-lg text-accent-deep hover:underline"
                  >
                    {step.link.label}
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Güven şeridi / Garantiler */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-12">
        <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-12 sm:px-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-secondary/25 blur-3xl"
          />
          <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-label-md uppercase tracking-wider text-accent">Şeffaf süreç</p>
              <h2 className="mt-2 text-headline-lg font-bold text-white">
                Ön Ödeme Yok, Komisyon Yok
              </h2>
              <p className="mt-3 max-w-xl text-body-lg text-white/80">
                Platform ödeme işlemez: talep ücretsizdir, ödeme ve teslim
                doğrudan ilan sahibiyle yapılır. Ne zaman, ne kadar
                ödeyeceğinizi baştan bilirsiniz.
              </p>
              <a href="#nasil-calisir" className="btn btn-accent mt-6">
                Nasıl Çalışır?
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </a>
            </div>

            <div className="grid gap-3">
              {guarantees.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
                    <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  </span>
                  <div>
                    <p className="font-bold text-white">{item.title}</p>
                    <p className="mt-0.5 text-body-md text-white/75">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}