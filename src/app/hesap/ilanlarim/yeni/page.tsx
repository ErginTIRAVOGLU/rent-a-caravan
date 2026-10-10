import type { Metadata } from "next";
import Link from "next/link";

import { ListingForm } from "../../../../components/ListingForm";
import { requireUser } from "../../../../lib/auth";

export const metadata: Metadata = {
  title: "Yeni İlan — Karavan Kiralama",
};

/** Girişsiz erişim requireUser() ile /giris'e yönlendirilir. */
export default async function YeniIlanPage() {
  await requireUser();

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link
          href="/hesap/ilanlarim"
          className="text-sm font-semibold text-emerald-600 hover:underline"
        >
          ← İlanlarıma dön
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Yeni İlan</h1>
        <p className="mt-1 text-sm text-gray-600">
          Karavanınızı üç adımda kiraya açın: bilgiler, fotoğraflar, önizleme.
        </p>

        <div className="mt-6">
          <ListingForm />
        </div>
      </div>
    </main>
  );
}
