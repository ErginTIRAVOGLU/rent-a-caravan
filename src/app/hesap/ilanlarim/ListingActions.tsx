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

  // Yalnız DRAFT/REJECTED incelemeye gönderilebilir (service ile aynı kural).
  const canSubmit = status === "DRAFT" || status === "REJECTED";

  async function handleSubmit() {
    setPending("submit");
    setError(null);
    const result = await submitListing(listingId);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
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
    const result = await deleteListing(listingId);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canSubmit ? (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={pending !== null}
            className="min-h-10 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {pending === "submit"
              ? "Gönderiliyor…"
              : status === "REJECTED"
                ? "Tekrar Gönder"
                : "Gönder"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={pending !== null}
          className="min-h-10 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {pending === "delete" ? "Siliniyor…" : "Sil"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
