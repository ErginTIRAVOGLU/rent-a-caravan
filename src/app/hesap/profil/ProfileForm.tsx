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
      <section className="card p-5">
        <h2 className="section-title">Profil bilgileri</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="profile-name" className="field-label">
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
              className="input"
            />
            {state.field === "name" && state.error ? (
              <p className="field-error">{state.error}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="profile-phone" className="field-label">
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
              className="input"
            />
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Boş bırakırsanız telefon numaranız hesabınızdan kaldırılır.
            </p>
            {state.field === "phone" && state.error ? (
              <p className="field-error">{state.error}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="profile-email" className="field-label">
              E-posta
            </label>
            <input
              id="profile-email"
              type="email"
              value={email}
              readOnly
              className="input bg-surface-low text-on-surface-variant cursor-not-allowed"
            />
            <p className="mt-1 text-body-sm text-on-surface-variant">
              E-posta adresi değiştirilemez.
            </p>
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="section-title">Şifre değiştirme</h2>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Şifrenizi değiştirmek istemiyorsanız bu alanları boş bırakın.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="profile-current-password" className="field-label">
              Mevcut şifre
            </label>
            <input
              id="profile-current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input"
            />
            {state.field === "currentPassword" && state.error ? (
              <p className="field-error">{state.error}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="profile-new-password" className="field-label">
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
              className="input"
            />
            <p className="mt-1 text-body-sm text-on-surface-variant">En az 8 karakter.</p>
            {state.field === "newPassword" && state.error ? (
              <p className="field-error">{state.error}</p>
            ) : null}
          </div>
        </div>
      </section>

      {state.error && !state.field ? (
        <p
          role="alert"
          className="rounded-lg bg-error-bg px-3 py-2 text-body-md text-error"
        >
          {state.error}
        </p>
      ) : null}

      {state.done ? (
        <p
          role="status"
          className="rounded-lg bg-success-bg px-3 py-2 text-body-md text-success"
        >
          Profiliniz güncellendi.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary"
      >
        {pending ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
      </button>
    </form>
  );
}