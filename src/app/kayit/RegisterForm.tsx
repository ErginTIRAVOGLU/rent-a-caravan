"use client";

import { useActionState } from "react";
import Link from "next/link";

import {
  registerAction,
  type RegisterState,
} from "../../server/users/actions";

const inputClassName =
  "mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200";

const initialState: RegisterState = { error: null, done: false };

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerAction,
    initialState,
  );

  if (state.done) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Kayıt başarılı! Şimdi giriş yapabilirsiniz.
        </p>
        <Link
          href="/giris"
          className="flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Giriş sayfasına git
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700"
        >
          Ad Soyad
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
          className={inputClassName}
        />
        {state.field === "name" && state.error ? (
          <p className="mt-1 text-sm text-red-600">{state.error}</p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
        >
          E-posta
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClassName}
        />
        {state.field === "email" && state.error ? (
          <p className="mt-1 text-sm text-red-600">{state.error}</p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700"
        >
          Şifre
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputClassName}
          aria-describedby="password-help"
        />
        <p id="password-help" className="mt-1 text-xs text-gray-500">
          En az 8 karakter.
        </p>
        {state.field === "password" && state.error ? (
          <p className="mt-1 text-sm text-red-600">{state.error}</p>
        ) : null}
      </div>

      {state.error && !state.field ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending ? "Kayıt yapılıyor…" : "Üye ol"}
      </button>
    </form>
  );
}
