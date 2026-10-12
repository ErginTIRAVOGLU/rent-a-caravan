import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "../../../lib/auth";
import { getUserReviews } from "../../../server/reviews/service";
import { PageHeader } from "../../../components/panel/PageHeader";
import { StarRating } from "../../../components/StarRating";
import { ReviewActions } from "./ReviewActions";

export const metadata: Metadata = {
  title: "Değerlendirmeler",
};

// Değerlendirmeler sayfası — iki bölüm:
//   1) "Yazdıklarım": kullanıcının yazdığı yorumlar (düzenle/sil).
//   2) "İlanlarıma Yazılanlar": ilanlarına yazılan yorumlar (salt okunur).
// Veri kaynağı: getUserReviews service (sayfa doğrudan Prisma sorgulamaz).

export default async function DegerlendirmelerPage() {
  const user = await requireUser();

  const reviewsResult = await getUserReviews(user);
  const written = reviewsResult.ok ? reviewsResult.data.written : [];
  const received = reviewsResult.ok ? reviewsResult.data.received : [];

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        eyebrow="Hesabım"
        title="Değerlendirmeler"
        description="Yazdığınız yorumlar ve ilanlarınıza yazılan yorumlar."
      />

      {/* Yazdıklarım */}
      <section className="mt-8">
        <h2 className="section-title">Yazdıklarım</h2>
        {written.length === 0 ? (
          <div className="card mt-3 p-6 text-center">
            <span className="material-symbols-outlined text-3xl text-outline">
              rate_review
            </span>
            <p className="mt-2 font-semibold text-on-surface">
              Henüz yorum yazmadınız
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {written.map((review) => (
              <li key={review.id} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/ilan/${review.listing.id}`}
                      className="font-bold text-on-surface hover:text-primary hover:underline"
                    >
                      {review.listing.title}
                    </Link>
                    <div className="mt-1">
                      <StarRating value={review.rating} size="sm" />
                    </div>
                  </div>
                  <ReviewActions
                    reviewId={review.id}
                    initialRating={review.rating}
                    initialComment={review.comment}
                  />
                </div>
                {review.comment ? (
                  <p className="mt-3 break-words text-body-md text-on-surface-variant">
                    {review.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* İlanlarıma Yazılanlar */}
      <section className="mt-10">
        <h2 className="section-title">İlanlarıma Yazılanlar</h2>
        {received.length === 0 ? (
          <div className="card mt-3 p-6 text-center">
            <span className="material-symbols-outlined text-3xl text-outline">
              chat_bubble
            </span>
            <p className="mt-2 font-semibold text-on-surface">
              Henüz yorum yok
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {received.map((review) => (
              <li key={review.id} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/ilan/${review.listing.id}`}
                      className="font-bold text-on-surface hover:text-primary hover:underline"
                    >
                      {review.listing.title}
                    </Link>
                    <p className="mt-1 text-body-sm text-on-surface-variant">
                      {review.author.name}
                    </p>
                    <div className="mt-1">
                      <StarRating value={review.rating} size="sm" />
                    </div>
                  </div>
                </div>
                {review.comment ? (
                  <p className="mt-3 break-words text-body-md text-on-surface-variant">
                    {review.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
