"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ListingStatus } from "@prisma/client";

import { deleteListing, submitListing } from "../../../server/listings/actions";

type Props = {
  listingId: string;
  status: ListingStatus;
};

/**
 * İlan satırı eylemleri (istemci bileşeni): gönder/sil düğmeleri sunucu
 * eylemlerini çağırır; yetki kontrolü service'te yapılır, burada yalnız
 * kullanıcıya Türkçe sonuç gösterilir ve liste tazelenir.
 */
export function ListingActions({ listingId, status }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<"submit" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Yalnız DRAFT/REJECTED/PAUSED incelemeye gönderilebilir (service ile aynı kural). */
  const canSubmit = status === "DRAFT" || status === "REJECTED" || status === "PAUSED";

  // Server action reddi (ağ/serileştirme/sunucu throw) için ortak TR mesajı.
  const HATA = "Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.";

  async function handleSubmit() {
    setPending("submit");
    setError(null);
    try {
      const result = await submitListing(listingId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError(HATA);
    } finally {
      setPending(null);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Bu ilanı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
    );
    if (!confirmed) {
      return;
    }
    setPending("delete");
    setError(null);
    try {
      const result = await deleteListing(listingId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError(HATA);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canSubmit ? (
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={pending !== null}
          className="btn btn-primary py-2"
        >
          {pending === "submit"
            ? "Gönderiliyor…"
            : status === "REJECTED" || status === "PAUSED"
              ? "Tekrar Gönder"
              : "Gönder"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={pending !== null}
        className="btn btn-outline text-error border-error/30 hover:bg-error-bg py-2"
      >
        {pending === "delete" ? "Siliniyor…" : "Sil"}
      </button>
      {error ? (
        <p role="alert" className="text-body-md text-error ml-auto">
          {error}
        </p>
      ) : null}
    </div>
  );
}
