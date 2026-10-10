"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { setUserBanned } from "../../../server/admin/actions";

type Props = {
  userId: string;
  isBanned: boolean;
  /** Kendi satırı: düğme gizlenir (service'teki self-ban korumasıyla tutarlı). */
  isSelf: boolean;
};

/**
 * Kullanıcı ban düğmesi (istemci bileşeni): Ban/Aç toggle sunucu eylemini
 * çağırır. Koruma hataları (kendi hesabı / son aktif yönetici) service'ten
 * Türkçe mesaj olarak gelir ve satırda gösterilir.
 */
export function UserBanActions({ userId, isBanned, isSelf }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (!isBanned) {
      const confirmed = window.confirm(
        "Bu kullanıcıyı banlamak istediğinize emin misiniz? Hesap giriş yapamaz.",
      );
      if (!confirmed) {
        return;
      }
    }
    setPending(true);
    setError(null);
    try {
      const result = await setUserBanned(userId, !isBanned);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      // Server action reddi: buton kilitli kalmaz, kullanıcı Türkçe uyarı görür.
      setError("Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {isSelf ? (
        <span className="text-xs text-gray-500">Kendi hesabınız</span>
      ) : (
        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={pending}
          className={
            isBanned
              ? "min-h-10 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              : "min-h-10 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          }
        >
          {pending ? "İşleniyor…" : isBanned ? "Banı Aç" : "Banla"}
        </button>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
