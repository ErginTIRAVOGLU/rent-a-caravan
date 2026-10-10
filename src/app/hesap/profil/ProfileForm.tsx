"use client";

import { useActionState, useEffect, useState } from "react";

import {
  updateProfileAction,
  type ProfileState,
} from "../../../server/users/actions";

// Profil formu (istemci): ad/telefon + şifre değiştirme tek formda.
// Alan hataları `field` ile ilgili inputsun altında; genel hata alert kutusunda.
// Pending sırasında gönderim düğmesi devre dışı (kilit yok — çift gönderim
// server action seviyesinde zaten seyrek).

const inputClassName =
  "mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200";

const labelClassName = "block text-sm font-medium text-gray-700";

const initialState: ProfileState = { error: null, done: false };

type Props = {
  email: string;
  initialName: string;
  initialPhone: string;
};

export function ProfileForm({ email, initialName, initialPhone }: Props) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialState,
  );
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Sunucu eylemi sonrası route yenilenir ve yeni initial değerler gelir —
  // kontrollü ad/telefon alanları bunlarla eşitlenir.
  useEffect(() => {
    setName(initialName);
    setPhone(initialPhone);
  }, [initialName, initialPhone]);

  // Başarıdan sonra şifre alanları temizlenir (state her eylem sonucunda yeni
  // nesnedir; kimlik değişimi ikinci ve sonraki başarıları da yakalar).
  useEffect(() => {
    if (state.done) {
      setCurrentPassword("");
      setNewPassword("");
    }
  }, [state]);

  return (
    <form action={formAction} className="mt-6 space-y-6">
      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Profil bilgileri</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="profile-name" className={labelClassName}>
              Ad
            </label>
            <input
              id="profile-name"
              name="name"
              type="text"
              required
              maxLength={80}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClassName}
            />
            {state.field === "name" && state.error ? (
              <p className="mt-1 text-sm text-red-600">{state.error}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="profile-phone" className={labelClassName}>
              Telefon (opsiyonel)
            </label>
            <input
              id="profile-phone"
              name="phone"
              type="tel"
              maxLength={20}
              autoComplete="tel"
              placeholder="0555 555 55 55"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClassName}
            />
            <p className="mt-1 text-xs text-gray-500">
              Boş bırakırsanız telefon numaranız hesabınızdan kaldırılır.
            </p>
            {state.field === "phone" && state.error ? (
              <p className="mt-1 text-sm text-red-600">{state.error}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="profile-email" className={labelClassName}>
              E-posta
            </label>
            <input
              id="profile-email"
              type="email"
              value={email}
              readOnly
              disabled
              className={`${inputClassName} cursor-not-allowed bg-gray-50 text-gray-500`}
            />
            <p className="mt-1 text-xs text-gray-500">
              E-posta adresi değiştirilemez.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Şifre değiştirme
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Şifrenizi değiştirmek istemiyorsanız bu alanları boş bırakın.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-current-password" className={labelClassName}>
              Mevcut şifre
            </label>
            <input
              id="profile-current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClassName}
            />
            {state.field === "currentPassword" && state.error ? (
              <p className="mt-1 text-sm text-red-600">{state.error}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="profile-new-password" className={labelClassName}>
              Yeni şifre
            </label>
            <input
              id="profile-new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClassName}
            />
            <p className="mt-1 text-xs text-gray-500">En az 8 karakter.</p>
            {state.field === "newPassword" && state.error ? (
              <p className="mt-1 text-sm text-red-600">{state.error}</p>
            ) : null}
          </div>
        </div>
      </section>

      {state.error && !state.field ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      {state.done ? (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          Profiliniz güncellendi.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
      </button>
    </form>
  );
}
