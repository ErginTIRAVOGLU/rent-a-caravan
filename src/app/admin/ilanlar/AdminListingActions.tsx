"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ListingStatus } from "@prisma/client";

import { ConfirmModal } from "../../../components/ConfirmModal";
import {
  approveListing,
  pauseListing,
  rejectListing,
  unpauseListing,
} from "../../../server/admin/actions";

type Props = {
  listingId: string;
  status: ListingStatus;
};

/**
 * Moderasyon satırı eylemleri (istemci bileşeni): Onayla/Reddet/Duraklat/
 * Yayına Al düğmeleri sunucu eylemlerini çağırır. Yalnız service durum
 * matrisindeki geçişler sunulur (PENDING: onayla+reddet, ACTIVE: duraklat,
 * PAUSED: yayına al); yetki ve geçiş doğrulaması service'te yapılır, burada
 * yalnız Türkçe sonuç gösterilir ve liste tazelenir.
 */
export function AdminListingActions({ listingId, status }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<
    "approve" | "reject" | "pause" | "unpause" | null
  >(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Server action reddi (ağ/serileştirme/sunucu throw) için ortak TR mesajı.
  const HATA = "Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.";

  async function handleApprove() {
    setPending("approve");
    setError(null);
    try {
      const result = await approveListing(listingId);
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

  async function handleReject() {
    if (!rejecting) {
      setRejecting(true);
      setError(null);
      return;
    }
    setPending("reject");
    setError(null);
    try {
      const result = await rejectListing(listingId, reason.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError(HATA);
    } finally {
      setPending(null);
      setRejecting(false);
      setReason("");
    }
  }

  async function handleUnpause() {
    setPending("unpause");
    setError(null);
    try {
      const result = await unpauseListing(listingId);
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
    setConfirmOpen(false);
    setPending("pause");
    setError(null);
    try {
      const result = await pauseListing(listingId);
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
    <div className="mt-3 space-y-2">
      {status === "PENDING" && !rejecting ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleApprove()}
            disabled={pending !== null}
            className="btn btn-success py-2"
          >
            {pending === "approve" ? "Onaylanıyor…" : "Onayla"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRejecting(true);
              setError(null);
            }}
            disabled={pending !== null}
            className="btn btn-outline text-error border-error/30 hover:bg-error-bg py-2"
          >
            Reddet
          </button>
        </div>
      ) : null}

      {status === "PENDING" && rejecting ? (
        <div className="space-y-2 rounded-lg bg-surface-low p-3">
          <label
            htmlFor={`reason-${listingId}`}
            className="field-label"
          >
            Red gerekçesi (zorunlu)
          </label>
          <textarea
            id={`reason-${listingId}`}
            rows={2}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="İlan sahibine iletilecek gerekçe…"
            className="input"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleReject()}
              disabled={pending !== null}
              className="btn btn-error py-2"
            >
              {pending === "reject" ? "Reddediliyor…" : "Reddet"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
                setReason("");
                setError(null);
              }}
              disabled={pending !== null}
              className="btn btn-outline py-2"
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : null}

      {status === "ACTIVE" ? (
        <>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setConfirmOpen(true);
            }}
            disabled={pending !== null}
            className="btn btn-outline text-info border-info/30 hover:bg-info-bg py-2"
          >
            {pending === "pause" ? "Duraklatılıyor…" : "Duraklat"}
          </button>
          <ConfirmModal
            open={confirmOpen}
            title="İlanı Duraklat"
            description="Bu ilanı duraklatmak istediğinize emin misiniz? Aramalarda görünmez."
            confirmLabel="Duraklat"
            pending={pending !== null}
            pendingLabel="Duraklatılıyor…"
            tone="primary"
            onConfirm={() => void handlePause()}
            onCancel={() => setConfirmOpen(false)}
          />
        </>
      ) : null}

      {status === "PAUSED" ? (
        <button
          type="button"
          onClick={() => void handleUnpause()}
          disabled={pending !== null}
          className="btn btn-success py-2"
        >
          {pending === "unpause" ? "Yayına alınıyor…" : "Yayına Al"}
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="text-body-md text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}