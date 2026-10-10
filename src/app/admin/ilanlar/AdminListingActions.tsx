"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ListingStatus } from "@prisma/client";

import {
  approveListing,
  pauseListing,
  rejectListing,
} from "../../../server/admin/actions";

type Props = {
  listingId: string;
  status: ListingStatus;
};

/**
 * Moderasyon satırı eylemleri (istemci bileşeni): Onayla/Reddet/Duraklat
 * düğmeleri sunucu eylemlerini çağırır. Yalnız service durum matrisindeki
 * geçişler sunulur (PENDING: onayla+reddet, ACTIVE: duraklat); yetki ve
 * geçiş doğrulaması service'te yapılır, burada yalnız Türkçe sonuç gösterilir
 * ve liste tazelenir.
 */
export function AdminListingActions({ listingId, status }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "reject" | "pause" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

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
    const reason = window.prompt("Ret gerekçesi (zorunlu):");
    if (reason === null) {
      return; // kullanıcı vazgeçti
    }
    setPending("reject");
    setError(null);
    try {
      const result = await rejectListing(listingId, reason);
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
    const confirmed = window.confirm(
      "Bu ilanı duraklatmak istediğinize emin misiniz? Aramalarda görünmez.",
    );
    if (!confirmed) {
      return;
    }
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
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "PENDING" ? (
          <>
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
              onClick={() => void handleReject()}
              disabled={pending !== null}
              className="min-h-10 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {pending === "reject" ? "Reddediliyor…" : "Reddet"}
            </button>
          </>
        ) : null}
        {status === "ACTIVE" ? (
          <button
            type="button"
            onClick={() => void handlePause()}
            disabled={pending !== null}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {pending === "pause" ? "Duraklatılıyor…" : "Duraklat"}
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
