import type { Metadata } from "next";
import Link from "next/link";

import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Üye Ol",
};

export default function KayitPage() {
  return (
    <main className="flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-6 sm:p-8">
          <span className="badge badge-accent">Yeni hesap oluştur</span>
          <h1 className="mt-3 text-headline-md font-bold text-primary">
            Üye Ol
          </h1>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Karavan kiralama platformuna ücretsiz kayıt olun.
          </p>

          <div className="mt-6">
            <RegisterForm />
          </div>
        </div>

        <p className="mt-6 text-center text-body-md text-on-surface-variant">
          Zaten üye misiniz?{" "}
          <Link
            href="/giris"
            className="font-semibold text-secondary hover:underline"
          >
            Giriş yapın
          </Link>
        </p>
      </div>
    </main>
  );
}
