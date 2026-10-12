"use client";

import Link from "next/link";

// Hata sınırı — beklenmeyen hatalar (render/aksiyon/veri hatası) bu sınıra
// düşer. `error.digest` Vercel/log tarafında izlenebilir; kullanıcıya
// gösterilmez. Ek bağımlılık yok; ikon satır içi SVG.

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: Props) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gray-50 p-8 text-center">
      <svg
        aria-hidden="true"
        className="h-12 w-12 text-red-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
      <h1 className="text-2xl font-bold text-gray-900">
        Bir şeyler ters gitti
      </h1>
      <p className="max-w-md text-gray-600">
        Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin; sorun devam ederse
        birkaç dakika sonra tekrar başlayın.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Tekrar dene
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Ana sayfaya dön
        </Link>
      </div>
    </main>
  );
}
