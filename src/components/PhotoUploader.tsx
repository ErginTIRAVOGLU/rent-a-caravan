"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { generateReactHelpers } from "@uploadthing/react";

import type { OurFileRouter } from "../app/api/uploadthing/route";
import {
  ALLOWED_TYPES,
  MAX_FILE_BYTES,
  MAX_PHOTOS,
  validatePhotoFiles,
  extractFileKey,
} from "../lib/upload";
import { deleteListingPhoto } from "../server/listings/actions";

// Adım 2 (Fotoğraflar) yükleyicisi: UploadThing ile çoklu yükleme,
// önizleme ve silme. photoUrls state'i formun kendisinde (ListingForm)
// tutulur; bu bileşen value + onChange ile yazar.

const { useUploadThing } = generateReactHelpers<OurFileRouter>({
  url: "/api/uploadthing",
});

const ACCEPT_ATTR = ALLOWED_TYPES.join(",");
const MAX_MB = MAX_FILE_BYTES / (1024 * 1024);

export function PhotoUploader({
  photoUrls,
  onChange,
  onUploadingChange,
}: {
  photoUrls: string[];
  onChange: (urls: string[]) => void;
  /** Yükleme durumunu forma bildirir (adım butonlarını kilitlemek için). */
  onUploadingChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Yükleme sürerken-listede silme yapılabildiği için en güncel listeyi ref'te tut.
  const urlsRef = useRef(photoUrls);
  urlsRef.current = photoUrls;

  const { startUpload, isUploading } = useUploadThing("imageUploader", {
    onUploadError: (uploadError) => {
      // UploadThing hataları kaynaktan İngilizce gelebilir ("Invalid token" vb.);
      // arayüz yalnız Türkçe olduğu için detay konsola yazılır, kullanıcıya
      // Türkçe yedek mesaj gösterilir.
      console.error("UploadThing yükleme hatası:", uploadError);
      setError("Fotoğraf yüklenemedi. Lütfen tekrar deneyin.");
    },
  });

  useEffect(() => {
    onUploadingChange?.(isUploading);
  }, [isUploading, onUploadingChange]);

  const atLimit = photoUrls.length >= MAX_PHOTOS;
  const disabled = isUploading || atLimit;

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    // Aynı dosya ikinci kez seçilebilsin diye input değeri hemen sıfırlanır.
    event.target.value = "";
    if (picked.length === 0) {
      return;
    }
    setError(null);
    // Yüklemeden önce doğrula: adet (mevcut fotoğraflarla), boyut, tür.
    const check = validatePhotoFiles(picked, urlsRef.current.length);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    try {
      const uploaded = await startUpload(picked);
      if (uploaded && uploaded.length > 0) {
        onChange([...urlsRef.current, ...uploaded.map((file) => file.ufsUrl)]);
      }
    } catch {
      // SDK bazı hataları (ör. UploadAbortedError) yeniden fırlatır; normal
      // yükleme hataları onUploadError'a düşer. Unhandled rejection bırakma.
      setError("Yükleme tamamlanamadı. Lütfen tekrar deneyin.");
    }
    // Hata durumunda startUpload yanıt vermez; mesaj onUploadError'ta ayarlanır.
  }

  async function removePhoto(url: string) {
    setError(null);
    // Liste iyimser güncellenir; sunucu silme hatası kullanıcıya gösterilir.
    onChange(urlsRef.current.filter((existing) => existing !== url));

    const key = extractFileKey(url);
    if (!key) {
      return;
    }
    const result = await deleteListingPhoto(key);
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 sm:p-6">
      <p className="text-sm font-semibold text-gray-800">
        Fotoğraflar ({photoUrls.length}/{MAX_PHOTOS})
      </p>
      <p className="mt-1 text-xs text-gray-500">
        JPG, PNG veya WebP; dosya başına en fazla {MAX_MB} MB. İlanı göndermek
        için en az 1 fotoğraf gerekir.
      </p>

      <div className="mt-3">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          onChange={(event) => void handleFileSelect(event)}
          className="hidden"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="min-h-11 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {isUploading
            ? "Yükleniyor…"
            : atLimit
              ? "Fotoğraf sınırına ulaştınız"
              : "Fotoğraf seç"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photoUrls.map((url, index) => (
          <li
            key={url}
            className="relative overflow-hidden rounded-lg border border-gray-200 bg-white"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`İlan fotoğrafı ${index + 1}`}
              className="h-24 w-full object-cover"
            />
            <button
              type="button"
              onClick={() => void removePhoto(url)}
              disabled={isUploading}
              className="absolute right-1 top-1 rounded bg-black/60 px-2 py-1 text-xs font-semibold text-white hover:bg-black/80 disabled:opacity-60"
            >
              Kaldır
            </button>
          </li>
        ))}
        {photoUrls.length === 0 ? (
          <li className="col-span-full py-2 text-sm text-gray-500">
            Henüz fotoğraf eklenmedi.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
