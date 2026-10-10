import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sayfa Bulunamadı — Karavan Kiralama",
};

/** Genel 404 — `notFound()` (ilan detayı dahil) bu sınıra düşer. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
      <p className="text-sm font-semibold text-emerald-700">404</p>
      <h1 className="text-3xl font-bold text-gray-900">
        Sayfa bulunamadı
      </h1>
      <p className="max-w-md text-gray-600">
        Aradığınız sayfa veya ilan yayından kaldırılmış olabilir.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        Ana sayfaya dön
      </Link>
    </main>
  );
}
