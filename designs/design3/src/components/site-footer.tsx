import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-white">
      <div className="page-container grid gap-10 py-12 md:grid-cols-[1.35fr_1fr_1fr] md:py-16">
        <div>
          <Link href="/" className="font-display text-2xl font-extrabold tracking-tight text-forest">karavan<span className="text-accent">.</span></Link>
          <p className="mt-3 max-w-sm text-sm leading-6 text-ink-muted">Türkiye yollarında yeni hikâyelere yer aç. Karavanını bul, rotanı kendin çiz.</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-ink-muted"><span className="size-1.5 rounded-full bg-accent" /> Demo arayüz · Örnek içerikler</p>
        </div>
        <div>
          <h2 className="text-sm font-bold text-ink">Keşfet</h2>
          <ul className="mt-4 grid gap-3 text-sm text-ink-muted"><li><Link className="hover:text-forest" href="/arama">Karavanları keşfet</Link></li><li><Link className="hover:text-forest" href="/#nasil-calisir">Nasıl çalışır?</Link></li><li><Link className="hover:text-forest" href="/hesap/ilanlarim/yeni">Karavanını kirala</Link></li></ul>
        </div>
        <div>
          <h2 className="text-sm font-bold text-ink">Hesabın</h2>
          <ul className="mt-4 grid gap-3 text-sm text-ink-muted"><li><Link className="hover:text-forest" href="/giris">Giriş yap</Link></li><li><Link className="hover:text-forest" href="/kayit">Hesap oluştur</Link></li><li><Link className="hover:text-forest" href="/hesap/taleplerim">Taleplerim</Link></li></ul>
        </div>
      </div>
      <div className="border-t border-line"><div className="page-container flex flex-col gap-3 py-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between"><p>© 2026 Karavan. Bu arayüzdeki ilanlar örnektir.</p><p>Demo sürümü · canlı iletişim kanalı bağlı değil</p></div></div>
    </footer>
  );
}
