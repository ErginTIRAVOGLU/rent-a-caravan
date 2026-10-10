"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { StarRating } from "../../../components/StarRating";
import { deleteReview, updateReview } from "../../../server/reviews/actions";

// Yorum eylemleri (istemci): düzenle (inline form) ve sil (onaylı).
// Yetki matrisi service'te uygulanır; burada yalnız Türkçe sonuç + refresh.

type Props = {
  reviewId: string;
  initialRating?: number;
  initialComment?: string | null;
};

export function ReviewActions({
  reviewId,
  initialRating = 0,
  initialComment = null,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (
      !window.confirm("Bu yorumu silmek istediğinize emin misiniz?")
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await deleteReview(reviewId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError("Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (rating === 0) {
      setError("Lütfen puan seçin.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await updateReview(
        reviewId,
        rating,
        comment.trim() || undefined,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={(e) => void handleUpdate(e)} className="space-y-2">
        <StarRating
          value={rating}
          onChange={setRating}
          size="sm"
          label="Puan seçin"
        />
        <textarea
          rows={2}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Yorumunuz…"
          className="input"
        />
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            disabled={pending}
            className="btn btn-outline btn-sm"
          >
            Vazgeç
          </button>
        </div>
        {error ? (
          <p role="alert" className="text-body-md text-error">
            {error}
          </p>
        ) : null}
      </form>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => {
          setEditing(true);
          setError(null);
        }}
        disabled={pending}
        className="btn btn-outline btn-sm"
      >
        Düzenle
      </button>
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={pending}
        className="btn btn-outline btn-sm text-error border-error/30 hover:bg-error-bg"
      >
        Sil
      </button>
    </div>
  );
}
