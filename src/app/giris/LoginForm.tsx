"use client";

import { useActionState } from "react";
import { signIn } from "next-auth/react";

import { loginAction, type LoginState } from "../../server/users/actions";

type Props = {
  callbackUrl?: string;
  serverError?: string | null;
};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

const inputClassName = "input min-h-11 py-3";

export function LoginForm({ callbackUrl, serverError }: Props) {
  const initialState: LoginState = { error: serverError ?? null };
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => void signIn("google", { redirectTo: callbackUrl || "/" })}
        className="btn btn-outline w-full py-3"
      >
        <GoogleIcon />
        Google ile devam et
      </button>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-surface-highest" />
        <span className="text-body-sm text-on-surface-variant">veya</span>
        <span className="h-px flex-1 bg-surface-highest" />
      </div>

      <form action={formAction} className="space-y-4">
        {callbackUrl ? (
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
        ) : null}

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
            autoComplete="current-password"
            required
            className={inputClassName}
          />
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
          {pending ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>
    </div>
  );
}
