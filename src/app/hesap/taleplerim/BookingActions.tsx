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

const inputClassName =
  "mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200";

export function BookingActions({ bookingId, mode }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setPending("approve");
    setError(null);
    const result = await approveBooking(bookingId);
    setPending(null);
    if (!result.ok) {
      setError(result.error); // ör. "Bu tarihler artık dolu…" / "karara bağlanmış"
      return;
    }
    router.refresh();
  }

  async function handleReject() {
    setPending("reject");
    setError(null);
    const result = await rejectBooking(bookingId, reason.trim() || undefined);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
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
    const result = await cancelBooking(bookingId);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-2">
      {mode === "decide" && !rejecting ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleApprove()}
            disabled={pending !== null}
            className="min-h-10 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
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
            className="min-h-10 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            Reddet
          </button>
        </div>
      ) : null}

      {mode === "decide" && rejecting ? (
        <div className="space-y-2 rounded-lg bg-gray-50 p-3">
          <label
            htmlFor={`reason-${bookingId}`}
            className="block text-sm font-medium text-gray-700"
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
            className={inputClassName}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleReject()}
              disabled={pending !== null}
              className="min-h-10 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
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
              className="min-h-10 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
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
          className="min-h-10 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {pending === "cancel" ? "İptal ediliyor…" : "İptal Et"}
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
