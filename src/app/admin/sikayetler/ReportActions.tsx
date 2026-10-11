"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReportStatus } from "@prisma/client";

import { NEXT_REPORT_STATUS } from "../../../lib/validators/report";
import { updateReportStatus } from "../../../server/reports/actions";

// Şikayet satırı durum geçişleri (istemci bileşeni). Sunulacak düğme
// `NEXT_REPORT_STATUS` ile belirlenir: OPEN → "İncele" (REVIEWING),
// REVIEWING → "Kapat" (CLOSED), CLOSED terminal (düğme yok). Bu harita
// `lib/validators/report.ts` içindeki TEK matris kaynağından türetilir; sunucu
// (updateReportStatusCore) aynı matrisi zorunlu kılar — yani burada yapılan
// seçim kural ihlali olamaz, yine de doğrulama ve yetki service'te kalır.

type Props = {
  reportId: string;
  status: ReportStatus;
};

export function ReportActions({ reportId, status }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStatus = NEXT_REPORT_STATUS[status];
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
