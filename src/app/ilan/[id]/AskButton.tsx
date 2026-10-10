"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { startConversation } from "../../../server/messages/actions";

// "Sor" butonu — sohbet başlatır, oturum yoksa giriş sayfasına yönlendirir.
type Props = {
  listingId: string;
};

export function AskButton({ listingId }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const result = await startConversation(listingId);
      if (!result.ok) {
        if (result.error.includes("giriş") || result.error.includes("oturum")) {
          // Auth.js redirect eder ama client tarafında yakalayıp next parametresi ekleyelim
          router.push(`/giris?next=/ilan/${listingId}`);
          return;
        }
        setError(result.error);
        return;
      }
      // Sohbet oluşturuldu/bulundu, sohbet sayfasına yönlendir
      router.push(`/hesap/mesajlar/${result.data.id}`);
      router.refresh();
    } catch {
      setError("Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      {error && (
        <p role="alert" className="rounded-lg bg-error-bg px-3 py-2 text-body-md text-error">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="btn btn-outline w-full py-3 border-primary text-primary hover:bg-primary hover:text-white"
      >
        <span className="material-symbols-outlined align-middle mr-1">chat_bubble_outline</span>
        {pending ? "Açılıyor…" : "Sor"}
      </button>
      <p className="text-body-xs text-center text-on-surface-variant">
        İlan sahibiyle doğrudan sohbet edin
      </p>
    </div>
  );
}