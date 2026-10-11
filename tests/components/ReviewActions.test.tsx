/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { refreshMock, deleteReviewMock, updateReviewMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  deleteReviewMock: vi.fn(),
  updateReviewMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
}));

vi.mock("../../src/server/reviews/actions", () => ({
  deleteReview: deleteReviewMock,
  updateReview: updateReviewMock,
}));

import { ReviewActions } from "../../src/app/hesap/degerlendirmeler/ReviewActions";

describe("ReviewActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteReviewMock.mockResolvedValue({ ok: true, data: { id: "r1" } });
  });

  it("Sil düğmesi doğrudan silmez, modal açar", async () => {
    render(<ReviewActions reviewId="r1" initialRating={5} />);

    fireEvent.click(screen.getByRole("button", { name: "Sil" }));

    // Modal açıldı, silme henüz çağrılmadı.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(deleteReviewMock).not.toHaveBeenCalled();
  });

  it("modalda Vazgeç silmeden kapatır", () => {
    render(<ReviewActions reviewId="r1" initialRating={5} />);

    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteReviewMock).not.toHaveBeenCalled();
  });

  it("modalda Onayla siler ve listeyi tazeler", async () => {
    render(<ReviewActions reviewId="r1" initialRating={5} />);

    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    // Modal içindeki "Sil" (dialog scoped).
    const dialog = screen.getByRole("dialog");
    const confirmButton = dialog.querySelector("button.btn-error") as HTMLElement;
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(deleteReviewMock).toHaveBeenCalledWith("r1");
    });
    expect(refreshMock).toHaveBeenCalled();
  });

  it("düzenleme textarea'sı geniştir (rows=5, tam genişlik)", () => {
    render(<ReviewActions reviewId="r1" initialRating={5} initialComment="Güzeldi" />);

    fireEvent.click(screen.getByRole("button", { name: "Düzenle" }));

    const textarea = screen.getByPlaceholderText("Yorumunuz…");
    expect(textarea).toHaveAttribute("rows", "5");
    expect(textarea.className).toContain("w-full");
  });
});
