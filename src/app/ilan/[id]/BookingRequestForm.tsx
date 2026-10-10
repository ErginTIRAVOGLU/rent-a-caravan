"use client";

import Link from "next/link";
import { useState } from "react";

import { calculateNights } from "../../../lib/pricing";
import { formatTRY } from "../../../lib/format";
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

const inputClassName = "input min-h-11 py-3";

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
    try {
      const result = await createBooking({
        listingId,
        startDate,
        endDate,
        guests: Number(guests),
        message: message.trim() ? message.trim() : undefined,
      });
      if (!result.ok) {
        setError({ message: result.error, field: result.field });
        return;
      }
      setSuccess(true);
    } catch {
      // Server action'ın reddedilmesi (ağ hatası/serileştirme/sunucu throw):
      // buton kilitli kalmaz, kullanıcı Türkçe uyarı görür.
      setError({ message: "Beklenmeyen bir hata oluştu, lütfen tekrar deneyin." });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-4">
      <h2 className="text-title-md font-bold text-primary">Rezervasyon Talebi</h2>

      {success ? (
        <div className="mt-3 space-y-2 rounded-lg bg-success-bg px-3 py-3 text-sm text-success">
          <p>
            Talebiniz gönderildi. İlan sahibi onayladığında size haber
            vereceğiz.
          </p>
          <Link
            href="/hesap/taleplerim"
            className="inline-block font-semibold underline hover:opacity-80"
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
                className="field-label"
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
                <p className="field-error">{startDateError.message}</p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="endDate"
                className="field-label"
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
                <p className="field-error">{endDateError.message}</p>
              ) : null}
            </div>
          </div>

          <div>
            <label
              htmlFor="guests"
              className="field-label"
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
            <p className="mt-1 text-body-sm text-on-surface-variant">
              En fazla {capacity} kişi kabul edilir.
            </p>
            {guestsError ? (
              <p className="field-error">{guestsError.message}</p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="message"
              className="field-label"
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

          <div className="rounded-lg bg-surface-low px-3 py-2.5">
            {hasPreview ? (
              <>
                <p className="text-body-md text-on-surface-variant">
                  {formatTRY(nightlyPrice)} × {preview.nights} gece
                </p>
                <p className="text-body-md text-on-surface">
                  <span className="text-price text-primary">Tahmini toplam:{" "}
                    {formatTRY(preview.total)}</span>
                </p>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  Kesin tutar talebiniz sunucuda kaydedilirken hesaplanır.
                </p>
              </>
            ) : (
              <p className="text-body-sm text-on-surface-variant">
                {liveError && !liveError.field
                  ? liveError.message
                  : "Tarih ve kişi seçtiğinizde tahmini tutarı görürsünüz."}
              </p>
            )}
          </div>

          {error && !error.field ? (
            <p
              role="alert"
              className="rounded-lg bg-error-bg px-3 py-2 text-body-md text-error"
            >
              {error.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="btn btn-accent w-full py-3"
          >
            {pending ? "Gönderiliyor…" : "Talebi Gönder"}
          </button>
        </form>
      )}
    </section>
  );
}
