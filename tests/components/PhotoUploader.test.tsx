/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { deleteListingPhotoMock } = vi.hoisted(() => ({
  deleteListingPhotoMock: vi.fn(),
}));

vi.mock("@uploadthing/react", () => ({
  generateReactHelpers: () => ({
    useUploadThing: () => ({ startUpload: vi.fn(), isUploading: false }),
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
