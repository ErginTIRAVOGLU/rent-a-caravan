"use server";

import type { Review } from "@prisma/client";

import { requireUser } from "../../lib/auth";
import { type ActionResult } from "../../lib/result";
import {
  createReviewCore,
  deleteReviewCore,
  getReviewsForListing,
  getUserReviews,
  updateReviewCore,
  updateReviewsVisibleCore,
  type ListingReviews,
  type UserReviews,
} from "./service";

// Yorum eylemleri — ince sarmalayıcılar; tüm doğrulama/ yetki/ iş mantığı
// service çekirdeğindedir. Aksiyonlar yalnız oturum kapısı (requireUser)
// uygular ve sonucu ActionResult olarak döner.

/** Yorum oluştur — oturum kapısı; önkoşullar/IP capture service'te. */
export async function createReview(
  listingId: string,
  bookingId: string,
  rating: number,
  comment?: string,
): Promise<ActionResult<Review>> {
  const user = await requireUser();
  return createReviewCore(user, listingId, bookingId, rating, comment);
}

/** Yorum güncelle — oturum kapısı; yalnız yazar. */
export async function updateReview(
  reviewId: string,
  rating: number,
  comment?: string,
): Promise<ActionResult<Review>> {
  const user = await requireUser();
  return updateReviewCore(user, reviewId, rating, comment);
}

/** Yorum sil — oturum kapısı; yazar veya ADMIN. */
export async function deleteReview(reviewId: string): Promise<ActionResult<true>> {
  const user = await requireUser();
  return deleteReviewCore(user, reviewId);
}

/** İlanın yorumları + ortalama puan — display guard'lar service'te. */
export async function getReviewsForListingAction(
  listingId: string,
): Promise<ActionResult<ListingReviews>> {
  return getReviewsForListing(listingId);
}

/** Kullanıcının yazdığı/aldığı yorumlar — oturum kapısı. */
export async function getUserReviewsAction(): Promise<ActionResult<UserReviews>> {
  const user = await requireUser();
  return getUserReviews(user);
}

/** İlan sahibi yorum görünürlüğü — oturum kapısı. */
export async function updateReviewsVisible(
  visible: boolean,
): Promise<ActionResult<true>> {
  const user = await requireUser();
  return updateReviewsVisibleCore(user, visible);
}
