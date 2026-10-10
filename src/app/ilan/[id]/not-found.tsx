import type { Metadata } from "next";
import Link from "next/link";

// İlan detayına özel 404 — `notFound()` bu segmentte (ilanda yok/ACTIVE değil)
// çağrılır. Genel 404 kökteki `src/app/not-found.tsx`'te kalır (tek kaynak).

export const metadata: Metadata = {
  title: "İlan Bulunamadı — Karavan Kiralama",
};

export default function ListingNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
      <svg
        aria-hidden="true"
        className="h-12 w-12 text-gray-300"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <path d="M12 7v3" />
        <path d="M12 14h.01" />
      </svg>
      <p className="text-sm font-semibold text-emerald-700">404</p>
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
        Bu ilan bulunamadı veya kaldırıldı
      </h1>
      <p className="max-w-md text-gray-600">
        İlan yayından kaldırılmış, inceleniyor ya da adresi hatalı olabilir.
        Başka bir karavan arayabilirsiniz.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/arama"
          className="inline-flex min-h-11 items-center rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Karavan aramaya dön
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Ana sayfa
        </Link>
      </div>
    </main>
  );
}
