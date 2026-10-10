"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  verifyEmailAction,
  resendVerifyEmailAction,
  type VerifyEmailResult,
} from "../../server/users/actions";

const initialState: VerifyEmailResult = { ok: false, error: undefined, field: undefined };

export default function DogrulaPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const resendEmail = searchParams.get("resend");

  const [state, formAction, pending] = useActionState(
    verifyEmailAction,
    initialState,
  );
  const [resendState, resendFormAction, resendPending] = useActionState(
    resendVerifyEmailAction,
    initialState,
  );

  const verified = state.ok && state.data?.verified === true;
  const resendVerified = resendState.ok && resendState.data?.verified === true;

  // Token varsa sayfa yüklendiğinde otomatik doğrula.
  useEffect(() => {
    if (token && !verified && !pending) {
      const formData = new FormData();
      formData.append("token", token);
      formAction(formData);
    }
  }, [token, formAction, verified, pending]);

  // resend query param varsa resend formunu göster
  useEffect(() => {
    if (resendEmail && !verified) {
      // Otomatik yeniden gönder
      const formData = new FormData();
      formData.append("email", resendEmail);
      resendFormAction(formData);
    }
  }, [resendEmail, resendFormAction, verified]);

  if (!token && !resendEmail) {
    return (
      <main className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="card p-6 sm:p-8 text-center">
            <span className="badge badge-error">Geçersiz bağlantı</span>
            <h1 className="mt-3 text-headline-md font-bold text-primary">
              Doğrulama bağlantısı eksik
            </h1>
            <p className="mt-2 text-body-md text-on-surface-variant">
              Bu sayfaya bir doğrulama bağlantısıyla gelmelisiniz. Lütfen e-postanızdaki
              linke tıklayın veya yeniden gönderin.
            </p>
            <Link
              href="/giris"
              className="mt-6 btn btn-primary w-full py-3 block"
            >
              Giriş sayfasına git
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-6 sm:p-8">
          <span className="badge badge-accent">E-posta doğrulama</span>
          <h1 className="mt-3 text-headline-md font-bold text-primary">
            E-posta adresinizi doğrulayın
          </h1>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Hesabınızı aktif etmek için doğrulama bağlantısını kullanın.
          </p>

          {verified ? (
            <div className="mt-6 space-y-4">
              <p
                role="status"
                className="rounded-lg bg-success-bg px-4 py-3 text-body-md text-success"
              >
                E-posta adresiniz başarıyla doğrulandı! Artık giriş yapabilirsiniz.
              </p>
              <Link
                href="/giris"
                className="btn btn-primary w-full py-3 block"
              >
                Giriş yap
              </Link>
            </div>
          ) : state.error ? (
            <div className="mt-6 space-y-4">
              <p
                role="alert"
                className="rounded-lg bg-error-bg px-4 py-3 text-body-md text-error"
              >
                {state.error}
              </p>
              <p className="text-body-sm text-on-surface-variant text-center">
                Yeni bir doğrulama e-postası isterseniz:
              </p>
              <form action={resendFormAction} className="space-y-2">
                <input type="hidden" name="email" value={resendEmail ?? ""} />
                <button
                  type="submit"
                  disabled={resendPending}
                  className="btn btn-outline w-full py-3"
                >
                  {resendPending ? "Gönderiliyor…" : "Doğrulama e-postasını yeniden gönder"}
                </button>
              </form>
              {resendState.ok && !resendVerified && !resendState.error && (
                <p
                  role="status"
                  className="rounded-lg bg-success-bg px-4 py-2 text-body-sm text-success text-center"
                >
                  Doğrulama e-postası yeniden gönderildi. Lütfen e-posta kutunuzu kontrol edin.
                </p>
              )}
              {resendState.error && (
                <p
                  role="alert"
                  className="rounded-lg bg-error-bg px-4 py-2 text-body-sm text-error text-center"
                >
                  {resendState.error}
                </p>
              )}
              <Link
                href="/giris"
                className="btn btn-secondary w-full py-3 block"
              >
                Giriş sayfasına git
              </Link>
            </div>
          ) : (
            <form action={formAction} className="mt-6">
              <input type="hidden" name="token" value={token ?? ""} />
              <button
                type="submit"
                disabled={pending}
                className="btn btn-primary w-full py-3"
              >
                {pending ? "Doğrulanıyor…" : "E-postayı doğrula"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}