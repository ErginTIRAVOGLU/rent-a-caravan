"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { StarRating } from "../../../../components/StarRating";
import { createReview } from "../../../../server/reviews/actions";

// Yorum formu (istemci): puan (1-5) + yorum (≤1000 karakter).
// Sunucu eylemi createReview; başarıda /hesap/degerlendirmeler'e yönlendirir.

type Props = {
  listingId: string;
  bookingId: string;
};

export function ReviewForm({ listingId, bookingId }: Props) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (rating === 0) {
      setError("Lütfen puan seçin.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await createReview(
        listingId,
        bookingId,
        rating,
        comment.trim() || undefined,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/hesap/degerlendirmeler");
      router.refresh();
    } catch {
      setError("Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="card space-y-4 p-5">
      <div>
        <span className="field-label">Puanınız</span>
        <div className="mt-1">
          <StarRating
            value={rating}
            onChange={setRating}
            size="lg"
            label="Puan seçin"
          />
        </div>
      </div>

      <div>
        <label htmlFor="review-comment" className="field-label">
          Yorumunuz (opsiyonel)
        </label>
        <textarea
          id="review-comment"
          rows={4}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Deneyiminizi paylaşın…"
          className="input"
        />
        <p className="mt-1 text-body-sm text-on-surface-variant">
          En fazla 1000 karakter.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-error-bg px-3 py-2 text-body-md text-error"
        >
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Gönderiliyor…" : "Yorumu Gönder"}
      </button>
    </form>
  );
}
