/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { deleteListingPhotoMock, startUploadMock } = vi.hoisted(() => ({
  deleteListingPhotoMock: vi.fn(),
  startUploadMock: vi.fn(),
}));

vi.mock("@uploadthing/react", () => ({
  generateReactHelpers: () => ({
    useUploadThing: () => ({
      startUpload: startUploadMock,
      isUploading: false,
    }),
  }),
}));

vi.mock("../../src/server/listings/actions", () => ({
  deleteListingPhoto: deleteListingPhotoMock,
}));

import { PhotoUploader } from "../../src/components/PhotoUploader";

const KEY = "2e0fdb64-9957-4262-8e45-f372ba903ac8_foto.jpg";
const URL = `https://bucket.ufs.sh/f/${KEY}`;

beforeEach(() => {
  vi.clearAllMocks();
  deleteListingPhotoMock.mockResolvedValue({ ok: true, data: true });
});

describe("PhotoUploader remove", () => {
  it("'Kaldır' listeden çıkarır ve sunucu aksiyonunu key ile çağırır", async () => {
    const onChange = vi.fn();
    render(<PhotoUploader photoUrls={[URL]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Kaldır" }));

    expect(onChange).toHaveBeenCalledWith([]);
    await vi.waitFor(() =>
      expect(deleteListingPhotoMock).toHaveBeenCalledWith(KEY),
    );
  });

  it("aksiyon hatası Türkçe gösterilir (sessiz yutma yok)", async () => {
    deleteListingPhotoMock.mockResolvedValue({
      ok: false,
      error: "Fotoğraf sunucudan silinemedi, lütfen tekrar deneyin.",
    });
    const onChange = vi.fn();
    render(<PhotoUploader photoUrls={[URL]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Kaldır" }));

    expect(
      await screen.findByText(
        "Fotoğraf sunucudan silinemedi, lütfen tekrar deneyin.",
      ),
    ).toBeInTheDocument();
    // Liste yine de iyimser güncellenir.
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe("PhotoUploader imza kontrolü (istemci)", () => {
  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  // Spoof: exe bytes ("MZ…") ama png MIME iddiası.
  const exeBytes = new Uint8Array([
    0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00,
  ]);

  function selectFile(file: File) {
    // Girdi gizlidir (CSS); etikete değil doğrudan input'a yazılır.
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
  }

  it("spoof'lanmış dosyayı reddeder: yükleme BAŞLAMAZ, Türkçe hata", async () => {
    startUploadMock.mockResolvedValue([]);
    const onChange = vi.fn();
    render(<PhotoUploader photoUrls={[]} onChange={onChange} />);

    selectFile(new File([exeBytes], "sahte.png", { type: "image/png" }));

    expect(
      await screen.findByText("Dosya içeriği türüyle eşleşmiyor."),
    ).toBeInTheDocument();
    expect(startUploadMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("gerçek png'yi kabul eder: startUpload çağrılır", async () => {
    const uploadedUrl = "https://bucket.ufs.sh/f/abc123_gercek.png";
    startUploadMock.mockResolvedValue([{ ufsUrl: uploadedUrl }]);
    const onChange = vi.fn();
    render(<PhotoUploader photoUrls={[]} onChange={onChange} />);

    selectFile(new File([pngBytes], "gercek.png", { type: "image/png" }));

    await vi.waitFor(() =>
      expect(startUploadMock).toHaveBeenCalledTimes(1),
    );
    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([uploadedUrl]),
    );
  });
});
