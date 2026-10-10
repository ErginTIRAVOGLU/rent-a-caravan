import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: {
    default: "Karavan — Yol senin, karavanın hazır",
    template: "%s | Karavan",
  },
  description: "Türkiye'de sana uyan karavanı keşfet. Tarihlerini seç, kiralama talebini karavan sahibiyle netleştir.",
  applicationName: "Karavan",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Karavan — Yol senin, karavanın hazır",
    description: "Türkiye yollarına uygun karavanları keşfet.",
    locale: "tr_TR",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className="font-sans">
        <a className="skip-link" href="#main-content">İçeriğe geç</a>
        <SiteHeader />
        <main id="main-content" className="min-h-[60vh]">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
