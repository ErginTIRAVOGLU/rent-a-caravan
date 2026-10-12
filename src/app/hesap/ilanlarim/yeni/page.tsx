import type { Metadata } from "next";
import Link from "next/link";

import { ListingForm } from "../../../../components/ListingForm";
import { PageHeader } from "../../../../components/panel/PageHeader";
import { requireUser } from "../../../../lib/auth";

export const metadata: Metadata = {
  title: "Yeni İlan — Karavan Kiralama",
};

/** Girişsiz erişim requireUser() ile /giris'e yönlendirilir. */
export default async function YeniIlanPage() {
  await requireUser();

  return (
    <div className="mx-auto w-full max-w-7xl">
      <Link
        href="/hesap/ilanlarim"
        className="text-sm font-semibold text-emerald-600 hover:underline"
      >
        ← İlanlarıma dön
      </Link>

      <PageHeader
        title="Yeni İlan"
        description="Karavanınızı üç adımda kiraya açın: bilgiler, fotoğraflar, önizleme."
      />

      <ListingForm />
    </div>
  );
}
