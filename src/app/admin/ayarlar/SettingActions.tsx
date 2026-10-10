"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateSetting } from "../../../server/admin/actions";

// Tek bir Setting key için toggle bileşeni (sunucu eylemi çağırır).
// `reviewsEnabled` için özel; şablonlaştırılabilir hale getirilebilir.

type Props = {
  /** Setting anahtarı (ör. "reviewsEnabled"). */
  key: string;
  /** Mevcut durum. */
  current: boolean;
};

export function SettingActions({ key, current }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setPending(true);
    setError(null);
    try {
      const result = await updateSetting(key, !current);
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
    <div className="shrink-0 mt-1 flex items-center">
      <button
        type="button"
        onClick={() => void handleToggle()}
        disabled={pending}
        role="switch"
        aria-checked={current}
        className={`btn py-2.5 px-5 transition-all ${
          current
            ? "btn-primary"
            : "btn-outline text-on-surface-variant hover:bg-surface-mid"
        }`}
      >
        {pending
          ? "Kaydediliyor…"
          : current
            ? "Açık"
            : "Kapalı"}
      </button>
      {error && (
        <p role="alert" className="ml-3 text-body-md text-error">
          {error}
        </p>
      )}
    </div>
  );
}