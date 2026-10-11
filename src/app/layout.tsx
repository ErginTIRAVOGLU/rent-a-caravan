import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";

import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { Providers } from "./providers";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Karavan Kiralama",
    template: "%s — Karavan Kiralama",
  },
  description:
    "Türkiye genelinde karavan kiralama. Tarihinize ve bütçenize uygun karavanı bulun, doğrudan sahibiyle iletişime geçin.",
};

// Türkçe karakterler latin-ext kapsamında; display=swap ile kritik yazı
// bandı bloklanmaz.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* design2 ikon seti: ikon fontları için display=block Google önerisidir;
            no-page-custom-font kuralı pages/ dizinine aittir (App Router false-positive) */}
        {/* eslint-disable-next-line @next/next/google-font-display, @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${jakarta.variable} flex min-h-screen flex-col font-sans antialiased`}
      >
        <Providers>
          <SiteHeader />
          {/* Sabit header için üst boşluk; ana sayfa hero'su -mt-20 ile altına girer. */}
          <div className="flex-1 pt-20">{children}</div>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
