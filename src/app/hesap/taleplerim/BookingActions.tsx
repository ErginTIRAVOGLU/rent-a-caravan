"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  approveBooking,
  cancelBooking,
  rejectBooking,
} from "../../../server/bookings/actions";

// Talep satırı eylemleri (istemci): onayla/red (gerekçeli) veya iptal.
// Yetki matrisi service'te uygulanır (onay/red yalnız sahip, iptal yalnız
// kiracı); burada yalnız Türkçe sonuç + liste tazelenir.

type Props = {
  bookingId: string;
  /** decide = gelen talep (onayla/reddet), cancel = giden talep (iptal). */
  mode: "decide" | "cancel";
};

type Pending = "approve" | "reject" | "cancel" | null;

export function BookingActions({ bookingId, mode }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setPending("approve");
    setError(null);
    try {
      const result = await approveBooking(bookingId);
      setPending(null);
      if (!result.ok) {
        setError(result.error); // ör. "Bu tarihler artık dolu…" / "karara bağlanmış"
        router.refresh(); // karar başka sekmede verilmiş olabilir — satırı tazele
        return;
      }
      router.refresh();
    } catch {
      setPending(null);
      setError("Bağlantı hatası, lütfen tekrar deneyin.");
      router.refresh();
    }
  }

  async function handleReject() {
    setPending("reject");
    setError(null);
    try {
      const result = await rejectBooking(bookingId, reason.trim() || undefined);
      setPending(null);
      if (!result.ok) {
        setError(result.error);
        router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setPending(null);
      setError("Bağlantı hatası, lütfen tekrar deneyin.");
      router.refresh();
    }
  }

  async function handleCancel() {
    const confirmed = window.confirm(
      "Bu talebi iptal etmek istediğinize emin misiniz?",
    );
    if (!confirmed) {
      return;
    }
    setPending("cancel");
    setError(null);
    try {
      const result = await cancelBooking(bookingId);
      setPending(null);
      if (!result.ok) {
        setError(result.error);
        router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setPending(null);
      setError("Bağlantı hatası, lütfen tekrar deneyin.");
      router.refresh();
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {mode === "decide" && !rejecting ? (
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

      {mode === "decide" && rejecting ? (
        <div className="space-y-2 rounded-lg bg-surface-low p-3">
          <label
            htmlFor={`reason-${bookingId}`}
            className="field-label"
          >
            Red gerekçesi (opsiyonel)
          </label>
          <textarea
            id={`reason-${bookingId}`}
            rows={2}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Kiracıya iletilecek gerekçe…"
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

      {mode === "cancel" ? (
        <button
          type="button"
          onClick={() => void handleCancel()}
          disabled={pending !== null}
          className="btn btn-outline text-error border-error/30 hover:bg-error-bg py-2"
        >
          {pending === "cancel" ? "İptal ediliyor…" : "İptal Et"}
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
