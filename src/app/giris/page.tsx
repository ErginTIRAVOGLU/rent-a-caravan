import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Giriş Yap",
};

// Auth.js hata kodları → Türkçe mesajlar (OAuth hataları ?error= ile gelir).
const oauthErrorMessages: Record<string, string> = {
  CredentialsSignin: "E-posta veya şifre hatalı.",
  AccessDenied:
    "Girişiniz reddedildi. Hesabınız askıya alınmış olabilir.",
  OAuthCallback: "Google ile giriş tamamlanmadı. Lütfen tekrar deneyin.",
  OAuthAccountNotLinked:
    "Bu e-posta adresi farklı bir giriş yöntemiyle zaten kayıtlı.",
  Configuration:
    "Giriş servisinde bir sorun oluştu. Lütfen daha sonra tekrar deneyin.",
};

function oauthErrorMessage(code: unknown): string | null {
  if (typeof code !== "string" || code.length === 0) {
    return null;
  }
  return oauthErrorMessages[code] ?? "Giriş yapılamadı. Lütfen tekrar deneyin.";
}

/**
 * Auth.js `callbackUrl` mutlak URL gelebilir (middleware'den) → uygulama içi
 * yola çevir. Origin bilerek atlanır: dış origin'li bir URL bile olsa sonuç
 * her zaman bu uygulamanın bir yolu olur (açık yönlendirme yok).
 */
function toAppPath(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  try {
    const url = new URL(value);
    return url.pathname + url.search;
  } catch {
    return undefined;
  }
}

type Props = {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
};

export default async function GirisPage({ searchParams }: Props) {
  const params = await searchParams;
  const callbackUrl = toAppPath(params.callbackUrl);

  return (
    <main className="flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-6 sm:p-8">
          <span className="badge badge-accent">Hesabınıza giriş</span>
          <h1 className="mt-3 text-headline-md font-bold text-primary">
            Giriş Yap
          </h1>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Rezervasyon ve ilan yönetimi için hesabınıza giriş yapın.
          </p>

          <div className="mt-6">
            <LoginForm
              callbackUrl={callbackUrl}
              serverError={oauthErrorMessage(params.error)}
            />
          </div>
        </div>

        <p className="mt-6 text-center text-body-md text-on-surface-variant">
          Hesabınız yok mu?{" "}
          <Link
            href="/kayit"
            className="font-semibold text-secondary hover:underline"
          >
            Üye olun
          </Link>
        </p>
      </div>
    </main>
  );
}
