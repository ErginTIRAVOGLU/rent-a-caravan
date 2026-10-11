"use client";

import { useId, useState } from "react";
import type { ReportTargetType } from "@prisma/client";

import {
  REPORT_REASON_MAX,
  REPORT_REASON_MIN,
} from "../lib/validators/report";
import { createReport } from "../server/reports/actions";

// "Bildir" dialogu — ilan detay ve profil sayfasında AYNI bileşen kullanılır
// (hedef tipi prop'uyla: LISTING / USER).
//
// Kurallar SUNUCU otoriterdir (createReportCore): hedef varlığı, mükerrer AÇIK
// şikayet engeli ve gerekçe 5–500 karakter. Buradaki sayaç/kapalı düğme yalnız
// erken geri bildirimdir; sunucu reddi aynı dialogda Türkçe gösterilir.

/** Dialog başlığı — hedef tipine göre. */
const DIALOG_TITLES: Record<ReportTargetType, string> = {
  LISTING: "İlanı Bildir",
  USER: "Kullanıcıyı Bildir",
};

/** Server action reddi (ağ/serileştirme/sunucu throw) için ortak TR mesajı. */
const HATA = "Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.";

type Props = {
  targetType: ReportTargetType;
  targetId: string;
};

export function ReportDialog({ targetType, targetId }: Props) {
  const fieldId = useId();
  const titleId = `${fieldId}-title`;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  /** Kırpılmış uzunluk — sayaç ve gönder kilidi aynı ölçüyü kullanır. */
  const reasonLength = reason.trim().length;
  const canSubmit = reasonLength >= REPORT_REASON_MIN;

  function closeDialog() {
    setOpen(false);
    setError(null);
  }

  async function handleSubmit() {
    setPending(true);
    setError(null);
    try {
      const result = await createReport(targetType, targetId, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReason("");
      setOpen(false);
      setSent(true);
    } catch {
      setError(HATA);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      {sent ? (
        <p role="status" className="rounded-lg bg-success-bg px-3 py-2 text-body-md text-success">
          Bildiriminiz iletildi, teşekkür ederiz. Yönetim ekibi inceleyecek.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setSent(false);
          setOpen(true);
        }}
        className="btn btn-outline w-full py-3 border-outline text-on-surface-variant hover:bg-surface-mid"
      >
        <span className="material-symbols-outlined align-middle mr-1">flag</span>
        Bildir
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={closeDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="card w-full max-w-md p-5"
            // İçerideki tıklama arka plan kapatmasını tetiklemesin.
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId} className="text-title-md font-bold text-primary">
              {DIALOG_TITLES[targetType]}
            </h2>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Gerekçeyi yazın; bildiriminiz yönetim ekibine iletilir.
            </p>

            <div className="mt-4 space-y-2">
              <label htmlFor={fieldId} className="field-label">
                Bildirim gerekçesi
              </label>
              <textarea
                id={fieldId}
                rows={4}
                maxLength={REPORT_REASON_MAX}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Sorunu kısaca açıklayın…"
                className="input"
              />
              <div className="flex items-center justify-between text-body-sm text-on-surface-variant">
                <span>En az {REPORT_REASON_MIN} karakter yazın.</span>
                <span>
                  {reasonLength} / {REPORT_REASON_MAX}
                </span>
              </div>
            </div>

            {error ? (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-error-bg px-3 py-2 text-body-md text-error"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={pending || !canSubmit}
                className="btn btn-primary py-2.5"
              >
                {pending ? "Gönderiliyor…" : "Gönder"}
              </button>
              <button
                type="button"
                onClick={closeDialog}
                disabled={pending}
                className="btn btn-outline py-2.5"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
