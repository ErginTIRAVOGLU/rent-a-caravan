"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { AMENITIES } from "../lib/amenities";
import { listingSchema } from "../lib/validators/listing";
import {
  createListing,
  submitListing,
  updateListing,
} from "../server/listings/actions";
import { PhotoUploader } from "./PhotoUploader";

// Çok adımlı ilan formu — adımlar bu bileşenin state'inde tutulur.
// 1) bilgiler → 2) fotoğraflar (UploadThing, PhotoUploader) → 3) önizleme.
// Gönderim: create (DRAFT) → submit (PENDING); service sunucu otoriter kararlar.

const inputClassName =
  "mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200";

const VEHICLE_TYPE_OPTIONS = [
  { value: "TOWED_CARAVAN", label: "Çekme Karavan" },
  { value: "PANELVAN", label: "Panelvan" },
  { value: "MOTORHOME", label: "Motorkaravan" },
] as const;

const TRANSMISSION_OPTIONS = [
  { value: "MANUAL", label: "Manuel" },
  { value: "SEMI_AUTOMATIC", label: "Yarı Otomatik" },
  { value: "AUTOMATIC", label: "Otomatik" },
] as const;

const FUEL_OPTIONS = [
  { value: "DIESEL", label: "Dizel" },
  { value: "PETROL", label: "Benzin" },
  { value: "ELECTRIC", label: "Elektrik" },
  { value: "HYBRID", label: "Hibrit" },
] as const;

const LICENSE_OPTIONS = [
  { value: "B", label: "B" },
  { value: "BE", label: "BE" },
  { value: "C1", label: "C1" },
  { value: "C", label: "C" },
] as const;

const STEPS = [
  { n: 1, label: "Bilgiler" },
  { n: 2, label: "Fotoğraflar" },
  { n: 3, label: "Önizleme" },
] as const;

type Step = (typeof STEPS)[number]["n"];

/** Form değeri her zaman metin; sayı alanları gönderimde number'a çevrilir. */
type FormState = {
  title: string;
  description: string;
  city: string;
  district: string;
  nightlyPrice: string;
  capacity: string;
  vehicleType: string;
  brand: string;
  model: string;
  transmission: string;
  fuel: string;
  licenseRequired: string;
  minDriverAge: string;
  minRentalDays: string;
  year: string;
  weightKg: string;
  lengthM: string;
  amenities: string[];
  houseRules: string;
  photoUrls: string[];
};

const initialForm: FormState = {
  title: "",
  description: "",
  city: "",
  district: "",
  nightlyPrice: "",
  capacity: "4",
  vehicleType: "PANELVAN",
  brand: "",
  model: "",
  transmission: "MANUAL",
  fuel: "DIESEL",
  licenseRequired: "B",
  minDriverAge: "",
  minRentalDays: "1",
  year: "",
  weightKg: "",
  lengthM: "",
  amenities: [],
  houseRules: "",
  photoUrls: [],
};

/** Form state'ini şemanın beklediği tiplere (number/null) çevirir. */
function buildPayload(state: FormState) {
  const num = (value: string) => Number(value.trim());
  const optNum = (value: string) =>
    value.trim() === "" ? null : Number(value.trim());
  const optText = (value: string) =>
    value.trim() === "" ? null : value.trim();
  return {
    title: state.title,
    description: state.description,
    city: state.city,
    district: optText(state.district),
    nightlyPrice: num(state.nightlyPrice),
    capacity: num(state.capacity),
    vehicleType: state.vehicleType,
    brand: optText(state.brand),
    model: optText(state.model),
    transmission: state.transmission,
    fuel: state.fuel,
    licenseRequired: state.licenseRequired,
    minDriverAge: optNum(state.minDriverAge),
    minRentalDays: num(state.minRentalDays),
    year: optNum(state.year),
    weightKg: optNum(state.weightKg),
    lengthM: optNum(state.lengthM),
    amenities: state.amenities,
    houseRules: optText(state.houseRules),
    photoUrls: state.photoUrls,
  };
}

/** Alan etiketini saran basit düzen yardımcısı. */
function Field({
  htmlFor,
  label,
  hint,
  children,
  className = "",
}: {
  htmlFor: string;
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function Select({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClassName}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function ListingForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Oluşturulmuş DRAFT id'si: gönderim hatasında yeniden create yerine
  // update + submit yapılır (aynı taslak ikiye katlanmaz).
  const [createdId, setCreatedId] = useState<string | null>(null);

  function setField<K extends keyof FormState>(name: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function toggleAmenity(key: string) {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(key)
        ? prev.amenities.filter((a) => a !== key)
        : [...prev.amenities, key],
    }));
  }

  /** Adım 1 doğrulaması: aynı Zod şeması istemcide de çalışır (Türkçe hata). */
  function validateStep1(): boolean {
    const parsed = listingSchema.safeParse(buildPayload(form));
    if (parsed.success) {
      setStepError(null);
      return true;
    }
    const issue = parsed.error.issues[0];
    setStepError(issue ? issue.message : "Lütfen formu kontrol edin.");
    return false;
  }

  function goToStep(next: Step) {
    setStepError(null);
    setStep(next);
  }

  async function handleSubmit() {
    setPending(true);
    setSubmitError(null);
    try {
      const payload = buildPayload(form);
      let id = createdId;
      if (id) {
        const updated = await updateListing(id, payload);
        if (!updated.ok) {
          setSubmitError(updated.error);
          return;
        }
      } else {
        const created = await createListing(payload);
        if (!created.ok) {
          setSubmitError(created.error);
          return;
        }
        id = created.data.id;
        setCreatedId(id);
      }
      // Sunucu otoriter: DRAFT → PENDING yalnız buradan geçer.
      const submitted = await submitListing(id);
      if (!submitted.ok) {
        setSubmitError(submitted.error);
        return;
      }
      router.push("/hesap/ilanlarim");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
      {/* Adım göstergesi */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
        {STEPS.map((s, index) => (
          <li key={s.n} className="flex items-center gap-2">
            {index > 0 ? (
              <span className="text-gray-300" aria-hidden="true">
                —
              </span>
            ) : null}
            <span
              className={
                step === s.n
                  ? "font-semibold text-emerald-700"
                  : step > s.n
                    ? "text-emerald-600"
                    : "text-gray-400"
              }
            >
              {s.n}. {s.label}
            </span>
          </li>
        ))}
      </ol>

      {/* 1 — BİLGİLER */}
      {step === 1 ? (
        <div className="mt-5 space-y-4">
          <Field htmlFor="title" label="İlan başlığı">
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="Örn. Çift kişilik çekme karavan — Antalya"
              className={inputClassName}
            />
          </Field>

          <Field htmlFor="description" label="Açıklama">
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={5}
              placeholder="Karavanınızı, donanımını ve teslim koşullarını anlatın."
              className={inputClassName}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field htmlFor="city" label="Şehir">
              <input
                id="city"
                type="text"
                value={form.city}
                onChange={(e) => setField("city", e.target.value)}
                placeholder="Antalya"
                className={inputClassName}
              />
            </Field>
            <Field htmlFor="district" label="İlçe" hint="İsteğe bağlı">
              <input
                id="district"
                type="text"
                value={form.district}
                onChange={(e) => setField("district", e.target.value)}
                placeholder="Konyaaltı"
                className={inputClassName}
              />
            </Field>

            <Field htmlFor="nightlyPrice" label="Gece fiyatı (₺)">
              <input
                id="nightlyPrice"
                type="number"
                min={1}
                step="0.01"
                value={form.nightlyPrice}
                onChange={(e) => setField("nightlyPrice", e.target.value)}
                placeholder="1500"
                className={inputClassName}
              />
            </Field>
            <Field htmlFor="capacity" label="Kapasite (kişi)">
              <input
                id="capacity"
                type="number"
                min={1}
                max={16}
                value={form.capacity}
                onChange={(e) => setField("capacity", e.target.value)}
                className={inputClassName}
              />
            </Field>

            <Field htmlFor="vehicleType" label="Araç tipi">
              <Select
                id="vehicleType"
                value={form.vehicleType}
                options={VEHICLE_TYPE_OPTIONS}
                onChange={(v) => setField("vehicleType", v)}
              />
            </Field>
            <Field htmlFor="minRentalDays" label="Minimum kiralama (gün)">
              <input
                id="minRentalDays"
                type="number"
                min={1}
                max={30}
                value={form.minRentalDays}
                onChange={(e) => setField("minRentalDays", e.target.value)}
                className={inputClassName}
              />
            </Field>

            <Field htmlFor="brand" label="Marka" hint="İsteğe bağlı">
              <input
                id="brand"
                type="text"
                value={form.brand}
                onChange={(e) => setField("brand", e.target.value)}
                placeholder="Ford"
                className={inputClassName}
              />
            </Field>
            <Field htmlFor="model" label="Model" hint="İsteğe bağlı">
              <input
                id="model"
                type="text"
                value={form.model}
                onChange={(e) => setField("model", e.target.value)}
                placeholder="Trans"
                className={inputClassName}
              />
            </Field>

            <Field htmlFor="transmission" label="Vites">
              <Select
                id="transmission"
                value={form.transmission}
                options={TRANSMISSION_OPTIONS}
                onChange={(v) => setField("transmission", v)}
              />
            </Field>
            <Field htmlFor="fuel" label="Yakıt">
              <Select
                id="fuel"
                value={form.fuel}
                options={FUEL_OPTIONS}
                onChange={(v) => setField("fuel", v)}
              />
            </Field>

            <Field htmlFor="licenseRequired" label="Ehliyet sınıfı">
              <Select
                id="licenseRequired"
                value={form.licenseRequired}
                options={LICENSE_OPTIONS}
                onChange={(v) => setField("licenseRequired", v)}
              />
            </Field>
            <Field
              htmlFor="minDriverAge"
              label="Minimum sürücü yaşı"
              hint="İsteğe bağlı (en az 18)"
            >
              <input
                id="minDriverAge"
                type="number"
                min={18}
                max={99}
                value={form.minDriverAge}
                onChange={(e) => setField("minDriverAge", e.target.value)}
                placeholder="21"
                className={inputClassName}
              />
            </Field>

            <Field htmlFor="year" label="Üretim yılı" hint="İsteğe bağlı">
              <input
                id="year"
                type="number"
                min={1900}
                max={2100}
                value={form.year}
                onChange={(e) => setField("year", e.target.value)}
                placeholder="2021"
                className={inputClassName}
              />
            </Field>
            <Field htmlFor="weightKg" label="Ağırlık (kg)" hint="İsteğe bağlı">
              <input
                id="weightKg"
                type="number"
                min={1}
                max={10000}
                value={form.weightKg}
                onChange={(e) => setField("weightKg", e.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field htmlFor="lengthM" label="Uzunluk (m)" hint="İsteğe bağlı">
              <input
                id="lengthM"
                type="number"
                min={1}
                max={30}
                step="0.1"
                value={form.lengthM}
                onChange={(e) => setField("lengthM", e.target.value)}
                className={inputClassName}
              />
            </Field>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-gray-700">
              Olanaklar
            </legend>
            <p className="mt-1 text-xs text-gray-500">
              İlanınızda bulunan donanımları seçin ({form.amenities.length}{" "}
              seçili).
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AMENITIES.map((amenity) => (
                <label
                  key={amenity.key}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 hover:border-emerald-400"
                >
                  <input
                    type="checkbox"
                    checked={form.amenities.includes(amenity.key)}
                    onChange={() => toggleAmenity(amenity.key)}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  {amenity.label}
                </label>
              ))}
            </div>
          </fieldset>

          <Field htmlFor="houseRules" label="Ev kuralları" hint="İsteğe bağlı">
            <textarea
              id="houseRules"
              value={form.houseRules}
              onChange={(e) => setField("houseRules", e.target.value)}
              rows={3}
              placeholder="Örn. Evcil hayvan kabul edilmez, sigara yasaktır."
              className={inputClassName}
            />
          </Field>

          {stepError ? (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {stepError}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              if (validateStep1()) {
                goToStep(2);
              }
            }}
            className="min-h-11 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 sm:w-auto"
          >
            Devam — Fotoğraflar
          </button>
        </div>
      ) : null}

      {/* 2 — FOTOĞRAFLAR */}
      {step === 2 ? (
        <div className="mt-5 space-y-4">
          <PhotoUploader
            photoUrls={form.photoUrls}
            onChange={(urls) => setField("photoUrls", urls)}
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => goToStep(1)}
              className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              ← Geri
            </button>
            <button
              type="button"
              onClick={() => goToStep(3)}
              className="min-h-11 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Önizleme →
            </button>
          </div>
        </div>
      ) : null}

      {/* 3 — ÖNİZLEME */}
      {step === 3 ? (
        <div className="mt-5 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {form.title || "İsimsiz ilan"}
          </h2>

          <dl className="divide-y divide-gray-100 rounded-xl border border-gray-100">
            {[
              ["Şehir", form.city],
              ["İlçe", form.district],
              ["Gece fiyatı", form.nightlyPrice ? `${form.nightlyPrice} ₺` : ""],
              ["Kapasite", form.capacity ? `${form.capacity} kişi` : ""],
              [
                "Araç tipi",
                VEHICLE_TYPE_OPTIONS.find((o) => o.value === form.vehicleType)
                  ?.label ?? "",
              ],
              ["Marka / Model", [form.brand, form.model].filter(Boolean).join(" ")],
              [
                "Vites",
                TRANSMISSION_OPTIONS.find((o) => o.value === form.transmission)
                  ?.label ?? "",
              ],
              [
                "Yakıt",
                FUEL_OPTIONS.find((o) => o.value === form.fuel)?.label ?? "",
              ],
              ["Ehliyet", form.licenseRequired],
              ["Minimum kiralama", `${form.minRentalDays} gün`],
              ["Minimum sürücü yaşı", form.minDriverAge],
              ["Üretim yılı", form.year],
              ["Ağırlık", form.weightKg ? `${form.weightKg} kg` : ""],
              ["Uzunluk", form.lengthM ? `${form.lengthM} m` : ""],
              [
                "Olanaklar",
                form.amenities
                  .map(
                    (key) => AMENITIES.find((a) => a.key === key)?.label ?? key,
                  )
                  .join(", "),
              ],
              ["Ev kuralları", form.houseRules ?? ""],
              ["Fotoğraflar", `${form.photoUrls.length} adet`],
            ]
              .filter(([, value]) => value !== "" && value != null)
              .map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 px-4 py-2.5"
                >
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="max-w-[60%] text-right text-sm font-medium text-gray-900">
                    {value}
                  </dd>
                </div>
              ))}
          </dl>

          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            İlan önce <strong>taslak</strong> olarak kaydedilir ve{" "}
            <strong>incelemeye gönderilir</strong>; yayın onayı sonrası aramada
            görünür.
          </p>

          {submitError ? (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => goToStep(2)}
              disabled={pending}
              className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              ← Geri
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={pending}
              className="min-h-11 flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {pending
                ? "Gönderiliyor…"
                : createdId
                  ? "Göndermeyi Dene"
                  : "İlanı Oluştur ve Gönder"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
