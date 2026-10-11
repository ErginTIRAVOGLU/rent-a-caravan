/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ConfirmModal } from "../../src/components/ConfirmModal";

function renderModal(overrides = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmModal
      open
      title="İlanı Sil"
      description="Bu ilanı silmek istediğinize emin misiniz?"
      confirmLabel="Sil"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("kapalıyken hiçbir şey render etmez", () => {
    render(
      <ConfirmModal
        open={false}
        title="İlanı Sil"
        description="Emin misiniz?"
        confirmLabel="Sil"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("açıkken dialog başlık, açıklama ve Türkçe düğmeleri gösterir", () => {
    renderModal();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("İlanı Sil")).toBeInTheDocument();
    expect(
      screen.getByText("Bu ilanı silmek istediğinize emin misiniz?"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vazgeç" })).toBeInTheDocument();
  });

  it("Onayla eylemi çalıştırır, Vazgeç kapatır", () => {
    const { onConfirm, onCancel } = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("arka plana tıklayınca kapanır, içeriğe tıklayınca kapanmaz", () => {
    const { onCancel } = renderModal();

    fireEvent.click(screen.getByRole("dialog"));
    expect(onCancel).not.toHaveBeenCalled();

    // Backdrop = dialog'un ebeveyni.
    const backdrop = screen.getByRole("dialog").parentElement;
    if (backdrop) fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape ile kapanır", () => {
    const { onCancel } = renderModal();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("pending iken düğmeler kilitlidir", () => {
    renderModal({ pending: true, pendingLabel: "Siliniyor…" });

    expect(screen.getByRole("button", { name: "Siliniyor…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Vazgeç" })).toBeDisabled();
  });
});
