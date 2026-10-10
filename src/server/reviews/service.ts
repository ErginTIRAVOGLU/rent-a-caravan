import { headers } from "next/headers";
import { Prisma, type Review } from "@prisma/client";

import { getReviewsEnabledCore } from "../admin/service";
import { prisma } from "../../lib/prisma";
import { fail, ok, type ActionResult } from "../../lib/result";
import type { SessionUser } from "../users/service";

// Yorum çekirdeği — spec §7. HTTP/oturum yok: `user` açık parametre;
// aksiyonlar requireUser ile sarar.
//
// KRİTİK: yorum önkoşulları SUNUCU otoriterdir —
//   1) yalnız COMPLETED + kendi booking'i,
//   2) bookingId @unique (mükerrer yorum yok),
//   3) display guard'lar (reviewsEnabled + owner reviewsVisible).
// IP capture: istemci payload'ı asla okunmaz; `headers()` x-forwarded-for.

const YETKI_YOK = "Bu işlem için yetkiniz yok.";
const YORUM_BULUNAMADI = "Yorum bulunamadı.";
const ILAN_BULUNAMADI = "İlan bulunamadı.";
const GECERSIZ_ILAN_ID = "Geçersiz ilan kimliği.";
const GECERSIZ_YORUM_ID = "Geçersiz yorum kimliği.";
const GECERSIZ_TALEP_ID = "Geçersiz talep kimliği.";
const TALEP_BULUNAMADI = "Talep bulunamadı.";
const REZERVASYON_TAMAMLANMADI =
  "Yorum yazmak için rezervasyonunuzun tamamlanmış olması gerekir.";
const ZATEN_YORUM_YAZMIS = "Bu rezervasyon için zaten yorum yazmışsınız.";
const YORUM_KAPALI = "Yorum sistemi şu anda kapalı.";
const SAHIP_YORUM_GIZLI = "İlan sahibi yorumları gizlemiş.";
const PUAN_GECERSIZ = "Puan 1 ile 5 arasında olmalıdır.";
const YORUM_UZUN = "Yorum en fazla 1000 karakter olabilir.";

// Prisma @default(cuid()) id deseni — bozuk id Prisma'ya ulaşmadan reddedilir.
const CUID_RE = /^c[a-z0-9]{24}$/;

/**
 * IP adresini `headers()` x-forwarded-for'dan okur.
 * İstemci payload'ı ASLA okunmadığı için IP sunucu taranır.
 * x-forwarded-for "client, proxy1, proxy2" olabilir — ilk adres istemcidir.
 */
async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (!xff) return null;
  return xff.split(",")[0]?.trim() || null;
}

/**
 * Display guard'lar: reviewsEnabled=false VEYA owner reviewsVisible=false
 * ise yorumlar GİZLENİR (createReviewCore dahil). Her iki koşul da okunur.
 */
export async function reviewsVisibleForListing(
  ownerId: string,
): Promise<boolean> {
  const reviewsEnabled = await getReviewsEnabledCore();
  if (!reviewsEnabled) return false;
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { reviewsVisible: true },
  });
  if (owner && !owner.reviewsVisible) return false;
  return true;
}

/**
 * Yorum oluştur — kiracı. Önkoşullar:
 * 1) booking COMPLETED + kullanıcının kendi booking'i,
 * 2) bookingId @unique (mükerrer yorum yok),
 * 3) display guard'lar (reviewsEnabled + owner reviewsVisible).
 * IP: headers() x-forwarded-for — istemci payload'ı asla okunmaz.
 */
export async function createReviewCore(
  user: SessionUser,
  listingId: string,
  bookingId: string,
  rating: number,
  comment?: string,
): Promise<ActionResult<Review>> {
  if (!CUID_RE.test(listingId)) {
    return fail(GECERSIZ_ILAN_ID);
  }
  if (!CUID_RE.test(bookingId)) {
    return fail(GECERSIZ_TALEP_ID);
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return fail(PUAN_GECERSIZ, "rating");
  }
  const trimmedComment = typeof comment === "string" ? comment.trim() : "";
  if (trimmedComment.length > 1000) {
    return fail(YORUM_UZUN, "comment");
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, ownerId: true },
  });
  if (!listing) {
    return fail(ILAN_BULUNAMADI);
  }

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: { id: true, listingId: true, renterId: true, status: true },
  });
  if (!booking) {
    return fail(TALEP_BULUNAMADI);
  }
  if (booking.listingId !== listingId) {
    return fail(GECERSIZ_TALEP_ID);
  }
  if (booking.renterId !== user.id) {
    return fail(YETKI_YOK);
  }
  if (booking.status !== "COMPLETED") {
    return fail(REZERVASYON_TAMAMLANMADI);
  }

  // Display guard'lar: reviewsEnabled + owner reviewsVisible.
  const visible = await reviewsVisibleForListing(listing.ownerId);
  if (!visible) {
    const reviewsEnabled = await getReviewsEnabledCore();
    return fail(reviewsEnabled ? SAHIP_YORUM_GIZLI : YORUM_KAPALI);
  }

  // Mükerrer koruması: bookingId @unique (P2002).
  const existing = await prisma.review.findUnique({
    where: { bookingId },
    select: { id: true },
  });
  if (existing) {
    return fail(ZATEN_YORUM_YAZMIS);
  }

  // IP capture: headers() x-forwarded-for (istemci payload'ı asla okunmaz).
  const ipAddress = await getClientIp();

  try {
    const review = await prisma.review.create({
      data: {
        listingId,
        authorId: user.id,
        bookingId,
        rating,
        comment: trimmedComment || null,
        ipAddress,
      },
    });
    return ok(review);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return fail(ZATEN_YORUM_YAZMIS);
    }
    throw error;
  }
}

/**
 * Yorum güncelle — yalnız yazar. `updatedAt` güncellenir.
 */
export async function updateReviewCore(
  user: SessionUser,
  reviewId: string,
  rating: number,
  comment?: string,
): Promise<ActionResult<Review>> {
  if (!CUID_RE.test(reviewId)) {
    return fail(GECERSIZ_YORUM_ID);
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return fail(PUAN_GECERSIZ, "rating");
  }
  const trimmedComment = typeof comment === "string" ? comment.trim() : "";
  if (trimmedComment.length > 1000) {
    return fail(YORUM_UZUN, "comment");
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, authorId: true },
  });
  if (!review) {
    return fail(YORUM_BULUNAMADI);
  }
  if (review.authorId !== user.id) {
    return fail(YETKI_YOK);
  }

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: {
      rating,
      comment: trimmedComment || null,
      updatedAt: new Date(),
    },
  });
  return ok(updated);
}

/**
 * Yorum sil — yazar veya ADMIN. Hard delete.
 */
export async function deleteReviewCore(
  user: SessionUser,
  reviewId: string,
): Promise<ActionResult<true>> {
  if (!CUID_RE.test(reviewId)) {
    return fail(GECERSIZ_YORUM_ID);
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, authorId: true },
  });
  if (!review) {
    return fail(YORUM_BULUNAMADI);
  }
  if (review.authorId !== user.id && user.role !== "ADMIN") {
    return fail(YETKI_YOK);
  }

  await prisma.review.delete({ where: { id: reviewId } });
  return ok(true);
}

export type ListingReview = Review & {
  author: { id: string; name: string; avatarUrl: string | null };
};

export type ListingReviews = {
  reviews: ListingReview[];
  averageRating: number | null;
};

/**
 * İlanın yorumları + ortalama puan. Display guard'lar:
 * reviewsEnabled=false VEYA owner reviewsVisible=false → boş döner.
 */
export async function getReviewsForListing(
  listingId: string,
): Promise<ActionResult<ListingReviews>> {
  if (!CUID_RE.test(listingId)) {
    return fail(GECERSIZ_ILAN_ID);
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, ownerId: true },
  });
  if (!listing) {
    return fail(ILAN_BULUNAMADI);
  }

  const visible = await reviewsVisibleForListing(listing.ownerId);
  if (!visible) {
    return ok({ reviews: [], averageRating: null });
  }

  const reviews: ListingReview[] = await prisma.review.findMany({
    where: { listingId },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  return ok({ reviews, averageRating });
}

export type UserReviews = {
  written: Review[];
  received: Review[];
};

/**
 * Kullanıcının yazdığı ve ilanlarına yazılan yorumlar.
 */
export async function getUserReviews(
  user: SessionUser,
): Promise<ActionResult<UserReviews>> {
  const [written, received] = await Promise.all([
    prisma.review.findMany({
      where: { authorId: user.id },
      include: { listing: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.review.findMany({
      where: { listing: { ownerId: user.id } },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        listing: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return ok({ written, received });
}

/**
 * İlan sahibi yorum görünürlüğünü günceller — yalnız ilan sahibi.
 */
export async function updateReviewsVisibleCore(
  user: SessionUser,
  visible: boolean,
): Promise<ActionResult<true>> {
  await prisma.user.update({
    where: { id: user.id },
    data: { reviewsVisible: visible },
  });
  return ok(true);
}
