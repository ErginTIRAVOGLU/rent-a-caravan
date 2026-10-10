import type { Metadata } from "next";
import Link from "next/link";

import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Üye Ol — Karavan Kiralama",
};

export default function KayitPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900">Üye Ol</h1>
        <p className="mt-1 text-sm text-gray-600">
          Karavan kiralama platformuna ücretsiz kayıt olun.
        </p>

        <div className="mt-6">
          <RegisterForm />
        </div>

        <p className="mt-6 text-center text-sm text-gray-600">
          Zaten üye misiniz?{" "}
          <Link
            href="/giris"
            className="font-semibold text-emerald-600 hover:underline"
          >
            Giriş yapın
          </Link>
        </p>
      </div>
    </main>
  );
}
