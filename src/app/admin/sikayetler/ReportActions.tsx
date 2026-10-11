"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReportStatus } from "@prisma/client";

import { updateReportStatus } from "../../../server/reports/actions";

// Şikayet satırı durum geçişleri (istemci bileşeni). Sunulacak düğmeler
// service'teki matristen türetilir: OPEN → "İncele", REVIEWING → "Kapat",
// CLOSED terminal (düğme yok). Yetki ve geçiş doğrulaması service'te yapılır;
// burada yalnız Türkçe sonuç gösterilir ve kuyruk tazelenir.

type Props = {
  reportId: string;
  status: ReportStatus;
};

export function ReportActions({ reportId, status }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStatus = status === "OPEN" ? "REVIEWING" : status === "REVIEWING" ? "CLOSED" : null;
  if (nextStatus === null) {
    return null;
  }

  async function handleAdvance() {
    if (nextStatus === null) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await updateReportStatus(reportId, nextStatus);
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

  return (
    <div className="shrink-0 mt-3 sm:mt-0 sm:pl-4">
      <button
        type="button"
        onClick={() => void handleAdvance()}
        disabled={pending}
        className="btn btn-primary py-2"
      >
        {pending
          ? "Kaydediliyor…"
          : nextStatus === "REVIEWING"
            ? "İncele"
            : "Kapat"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-body-md text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
