import Image from "next/image";
import Link from "next/link";

// Global alt bilgi — design2 footer düzeni (4 sütun + alt bar).
// Yalnız gerçek rotalara link verilir; kırık bağlantı yok.

const columns = [
  {
    title: "Keşfet",
    links: [
      { href: "/arama", label: "Karavanları Keşfet" },
      { href: "/hesap/ilanlarim/yeni", label: "Karavanını Kirala" },
      { href: "/#nasil-calisir", label: "Nasıl Çalışır?" },
    ],
  },
  {
    title: "Hesap",
    links: [
      { href: "/giris", label: "Giriş Yap" },
      { href: "/kayit", label: "Kayıt Ol" },
      { href: "/hesap/taleplerim", label: "Taleplerim" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-surface-mid bg-surface-low">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Marka */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <Image
                src="/images/logo.png"
                alt=""
                width={96}
                height={24}
                className="h-6 w-auto"
              />
              <span className="text-title-md font-bold tracking-tight text-primary">
                Karavan Kiralama<span className="text-accent">.</span>
              </span>
            </div>
            <p className="mt-4 max-w-md text-body-md text-on-surface-variant">
              Türkiye genelindeki karavanlar arasından tarihinize ve
              bütçenize uygun olanı bulun. Platform ödeme almaz; ödeme ve
              teslim doğrudan ilan sahibiyle yapılır.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="badge bg-accent-soft text-accent-deep">
                Doğa &amp; Keşif
              </span>
              <span className="badge bg-surface-mid text-on-surface-variant">
                Özgür Rotalar
              </span>
            </div>
          </div>

          {/* Bağlantı sütunları */}
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-label-lg font-bold text-on-surface">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-body-md text-on-surface-variant transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Alt bar */}
        <div className="mt-10 flex flex-col gap-4 border-t border-outline-variant/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-body-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-success">
                verified_user
              </span>
              Güvenli kiralama
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-success">
                handshake
              </span>
              Doğrudan sahibiyle iletişim
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-success">
                credit_card_off
              </span>
              Platform komisyonu yok
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant">
            © 2026 Karavan Kiralama. Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </footer>
  );
}
