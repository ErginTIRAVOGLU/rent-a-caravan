"use client";

import Link from "next/link";
import { useState } from "react";

import { calculateNights } from "../../../lib/pricing";
import { createBooking } from "../../../server/bookings/actions";

// Rezervasyon talebi formu — istemci önizlemesi YALNIZCA tahminidir
// ("Tahmini toplam"); kesin totalPrice her zaman createBookingCore'de
// DB.nightlyPrice üzerinden sunucuda hesaplanır (T4). Kurallar sunucuda
// tekrar uygulanır; buradaki mesajlar T4 ile AYNI metinlerdir.

type Props = {
  listingId: string;
  minRentalDays: number;
  capacity: number;
  nightlyPrice: number;
};

const inputClassName =
  "mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200";

type FieldError = { message: string; field?: string };

/** T4 ile aynı kural sırası/ileti — yalnız önizleme; sunucu yeniden doğrular. */
function quote(
  startDate: string,
  endDate: string,
  guests: number,
  rules: { minRentalDays: number; capacity: number; nightlyPrice: number },
): { nights: number; total: number } | FieldError {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (!startDate || !endDate) {
    return { message: "Tarih seçin." };
  }
  if (startDate < todayIso) {
    return { message: "Başlangıç tarihi bugünden önce olamaz.", field: "startDate" };
  }
  if (endDate <= startDate) {
    return {
      message: "Bitiş tarihi başlangıç tarihinden sonra olmalıdır.",
      field: "endDate",
    };
  }
  const nights = calculateNights(startDate, endDate);
  if (nights > 30) {
    return {
      message: "Konaklama süresi en fazla 30 gece olabilir.",
      field: "endDate",
    };
  }
  if (nights < rules.minRentalDays) {
    return {
      message: `En az ${rules.minRentalDays} gece konaklanabilir.`,
      field: "endDate",
    };
  }
  if (!Number.isInteger(guests) || guests < 1 || guests > 16) {
    return { message: "Kişi sayısı 1 ile 16 arasında olmalıdır.", field: "guests" };
  }
  if (guests > rules.capacity) {
    return {
      message: `En fazla ${rules.capacity} kişi kabul edilir.`,
      field: "guests",
    };
  }
  return { nights, total: nights * rules.nightlyPrice };
}

export function BookingRequestForm({
  listingId,
  minRentalDays,
  capacity,
  nightlyPrice,
}: Props) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [guests, setGuests] = useState("2");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FieldError | null>(null);
  const [success, setSuccess] = useState(false);

  const rules = { minRentalDays, capacity, nightlyPrice };
  const preview = quote(startDate, endDate, Number(guests), rules);
  const hasPreview = "nights" in preview;
  const liveError: FieldError | null = "nights" in preview ? null : preview;
  // Alan hataları: önce sunucu sonucu, yoksa canlı önizleme (T4 aynı metin).
  const startDateError =
    error?.field === "startDate"
      ? error
      : liveError?.field === "startDate"
        ? liveError
        : null;
  const endDateError =
    error?.field === "endDate"
      ? error
      : liveError?.field === "endDate"
        ? liveError
        : null;
  const guestsError =
    error?.field === "guests"
      ? error
      : liveError?.field === "guests"
        ? liveError
        : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);
    const result = await createBooking({
      listingId,
      startDate,
      endDate,
      guests: Number(guests),
      message: message.trim() ? message.trim() : undefined,
    });
    setPending(false);
    if (!result.ok) {
      setError({ message: result.error, field: result.field });
      return;
    }
    setSuccess(true);
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Rezervasyon Talebi</h2>

      {success ? (
        <div className="mt-3 space-y-2 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          <p>
            Talebiniz gönderildi. İlan sahibi onayladığında size haber
            vereceğiz.
          </p>
          <Link
            href="/hesap/taleplerim"
            className="inline-block font-semibold text-emerald-700 hover:underline"
          >
            Taleplerinizi görüntüleyin →
          </Link>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-3 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="startDate"
                className="block text-sm font-medium text-gray-700"
              >
                Giriş
              </label>
              <input
                id="startDate"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClassName}
              />
              {startDateError ? (
                <p className="mt-1 text-sm text-red-600">{startDateError.message}</p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="endDate"
                className="block text-sm font-medium text-gray-700"
              >
                Çıkış
              </label>
              <input
                id="endDate"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClassName}
              />
              {endDateError ? (
                <p className="mt-1 text-sm text-red-600">{endDateError.message}</p>
              ) : null}
            </div>
          </div>

          <div>
            <label
              htmlFor="guests"
              className="block text-sm font-medium text-gray-700"
            >
              Kişi sayısı
            </label>
            <input
              id="guests"
              type="number"
              min={1}
              max={16}
              required
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              className={inputClassName}
            />
            <p className="mt-1 text-xs text-gray-500">
              En fazla {capacity} kişi kabul edilir.
            </p>
            {guestsError ? (
              <p className="mt-1 text-sm text-red-600">{guestsError.message}</p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="message"
              className="block text-sm font-medium text-gray-700"
            >
              Mesaj (opsiyonel)
            </label>
            <textarea
              id="message"
              rows={3}
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="İlan sahibine notunuz…"
              className={inputClassName}
            />
          </div>

          <div className="rounded-lg bg-gray-50 px-3 py-2">
            {hasPreview ? (
              <>
                <p className="text-sm text-gray-600">
                  {nightlyPrice} ₺ × {preview.nights} gece
                </p>
                <p className="text-sm text-gray-900">
                  <span className="text-lg font-bold">Tahmini toplam:{" "}
                    {preview.total} ₺</span>
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Kesin tutar talebiniz sunucuda kaydedilirken hesaplanır.
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-500">
                {liveError && !liveError.field
                  ? liveError.message
                  : "Tarih ve kişi seçtiğinizde tahmini tutarı görürsünüz."}
              </p>
            )}
          </div>

          {error && !error.field ? (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
            >
              {error.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="min-h-11 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {pending ? "Gönderiliyor…" : "Talebi Gönder"}
          </button>
        </form>
      )}
    </section>
  );
}
