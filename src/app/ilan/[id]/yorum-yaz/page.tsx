import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { ReviewForm } from "./ReviewForm";

export const metadata: Metadata = {
  title: "Yorum Yaz",
};

// Yorum yazma sayfası — yalnız COMPLETED + kendi booking'i + mevcut yorum yok.
// Aksi halde bilgi mesajı + yönlendirme.

type Props = {
  params: Promise<{ id: string }>;
};

export default async function YorumYazPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { id: true, title: true, status: true },
  });
  if (!listing || listing.status !== "ACTIVE") {
    notFound();
  }

  // Kullanıcının bu ilan için COMPLETED booking'i var mı?
  const booking = await prisma.bookingRequest.findFirst({
    where: {
      listingId: id,
      renterId: user.id,
      status: "COMPLETED",
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (!booking) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="card p-6 text-center">
          <span className="material-symbols-outlined text-3xl text-outline">
            rate_review
          </span>
          <p className="mt-2 font-semibold text-on-surface">
            Yorum yazmak için tamamlanmış bir rezervasyonunuz olmalı.
          </p>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Rezervasyonunuz tamamlandıktan sonra buradan yorum yazabilirsiniz.
          </p>
          <Link href={`/ilan/${id}`} className="btn btn-primary btn-sm mt-4">
            İlana Dön
          </Link>
        </div>
      </div>
    );
  }

  // Bu booking için zaten yorum var mı?
  const existingReview = await prisma.review.findUnique({
    where: { bookingId: booking.id },
    select: { id: true },
  });

  if (existingReview) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="card p-6 text-center">
          <span className="material-symbols-outlined text-3xl text-outline">
            check_circle
          </span>
          <p className="mt-2 font-semibold text-on-surface">
            Bu rezervasyon için zaten yorum yazmışsınız.
          </p>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Yorumunuzu Değerlendirmeler sayfanızdan düzenleyebilirsiniz.
          </p>
          <Link
            href="/hesap/degerlendirmeler"
            className="btn btn-primary btn-sm mt-4"
          >
            Değerlendirmelerime Git
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6">
        <span className="eyebrow">Yorum Yaz</span>
        <h1 className="mt-1 text-headline-lg font-bold text-primary">
          {listing.title}
        </h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Deneyiminizi değerlendirin.
        </p>
      </header>

      <ReviewForm listingId={id} bookingId={booking.id} />
    </div>
  );
}
