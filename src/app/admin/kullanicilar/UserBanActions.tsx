"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmModal } from "../../../components/ConfirmModal";
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleToggle() {
    setConfirmOpen(false);
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
        <span className="badge badge-neutral text-body-sm">Kendi hesabınız</span>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              // Ban açma doğrudan uygulanır; banlama modal ile onaylanır.
              if (isBanned) {
                void handleToggle();
              } else {
                setError(null);
                setConfirmOpen(true);
              }
            }}
            disabled={pending}
            className={`btn py-2 ${
              isBanned ? "btn-success" : "btn-outline text-error border-error/30 hover:bg-error-bg"
            }`}
          >
            {pending ? "İşleniyor…" : isBanned ? "Banı Aç" : "Banla"}
          </button>
          <ConfirmModal
            open={confirmOpen}
            title="Kullanıcıyı Banla"
            description="Bu kullanıcıyı banlamak istediğinize emin misiniz? Hesap giriş yapamaz."
            confirmLabel="Banla"
            pending={pending}
            onConfirm={() => void handleToggle()}
            onCancel={() => setConfirmOpen(false)}
          />
        </>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-body-md text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}