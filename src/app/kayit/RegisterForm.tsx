"use client";

import { useActionState } from "react";
import Link from "next/link";

import {
  registerAction,
  type RegisterState,
} from "../../server/users/actions";

const inputClassName = "input min-h-11 py-3";

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
          className="rounded-lg bg-success-bg px-4 py-3 text-body-md text-success"
        >
          Kayıt başarılı! Şimdi giriş yapabilirsiniz.
        </p>
        <Link
          href="/giris"
          className="btn btn-primary w-full py-3"
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
          className="field-label"
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
          <p className="field-error">{state.error}</p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="email"
          className="field-label"
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
          <p className="field-error">{state.error}</p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="password"
          className="field-label"
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
        <p id="password-help" className="field-error text-on-surface-variant">
          En az 8 karakter.
        </p>
        {state.field === "password" && state.error ? (
          <p className="field-error">{state.error}</p>
        ) : null}
      </div>

      {state.error && !state.field ? (
        <p
          role="alert"
          className="rounded-lg bg-error-bg px-3 py-2 text-body-md text-error"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary w-full py-3"
      >
        {pending ? "Kayıt yapılıyor…" : "Üye ol"}
      </button>
    </form>
  );
}
