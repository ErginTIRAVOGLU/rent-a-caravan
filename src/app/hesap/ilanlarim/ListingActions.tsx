"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ListingStatus } from "@prisma/client";

import { ConfirmModal } from "../../../components/ConfirmModal";
import {
  deleteListing,
  pauseOwnListing,
  submitListing,
} from "../../../server/listings/actions";

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
  const [pending, setPending] = useState<"submit" | "delete" | "pause" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);

  /** Yalnız DRAFT/REJECTED/PAUSED incelemeye gönderilebilir (service ile aynı kural). */
  const canSubmit = status === "DRAFT" || status === "REJECTED" || status === "PAUSED";
  /** Yalnız ACTIVE duraklatılabilir (service pauseOwnListingCore ile aynı kural). */
  const canPause = status === "ACTIVE";

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
    setConfirmOpen(false);
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

  async function handlePause() {
    setPauseConfirmOpen(false);
    setPending("pause");
    setError(null);
    try {
      const result = await pauseOwnListing(listingId);
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
      {canPause ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setPauseConfirmOpen(true);
          }}
          disabled={pending !== null}
          className="btn btn-outline py-2"
        >
          {pending === "pause" ? "Duraklatılıyor…" : "Duraklat"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
        disabled={pending !== null}
        className="btn btn-outline text-error border-error/30 hover:bg-error-bg py-2"
      >
        {pending === "delete" ? "Siliniyor…" : "Sil"}
      </button>
      <ConfirmModal
        open={confirmOpen}
        title="İlanı Sil"
        description="Bu ilanı silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        confirmLabel="Sil"
        pending={pending !== null}
        pendingLabel="Siliniyor…"
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmOpen(false)}
      />
      <ConfirmModal
        open={pauseConfirmOpen}
        title="İlanı Duraklat"
        description="Bu ilanı duraklatmak istediğinize emin misiniz? Aramalarda görünmez; düzenleyip yeniden incelemeye gönderebilirsiniz."
        confirmLabel="Duraklat"
        pending={pending !== null}
        pendingLabel="Duraklatılıyor…"
        tone="primary"
        onConfirm={() => void handlePause()}
        onCancel={() => setPauseConfirmOpen(false)}
      />
      {error ? (
        <p role="alert" className="text-body-md text-error ml-auto">
          {error}
        </p>
      ) : null}
    </div>
  );
}
