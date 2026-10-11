"use client";

import { useEffect, useId } from "react";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  /** danger = kırmızı onay (sil/ban), primary = varsayılan vurgu. */
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Paylaşımlı onay dialogu — native tarayıcı onay kutusu yerine kullanılır
 * (`ReportDialog.tsx` kalıbı: role=dialog, aria-modal, backdrop + Escape
 * ile kapatma, Türkçe düğmeler). Kapalıyken hiçbir şey render etmez.
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel = "İşleniyor…",
  pending = false,
  tone = "danger",
  onConfirm,
  onCancel,
}: Props) {
  const fieldId = useId();
  const titleId = `${fieldId}-title`;
  const descriptionId = `${fieldId}-description`;

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="card w-full max-w-md p-5"
        // İçerideki tıklama arka plan kapatmasını tetiklemesin.
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-title-md font-bold text-primary">
          {title}
        </h2>
        <p id={descriptionId} className="mt-1 text-body-md text-on-surface-variant">
          {description}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`btn py-2.5 ${tone === "danger" ? "btn-error" : "btn-primary"}`}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="btn btn-outline py-2.5"
          >
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}
