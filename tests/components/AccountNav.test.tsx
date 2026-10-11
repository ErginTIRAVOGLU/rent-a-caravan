/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children),
}));

import { AccountNav } from "../../src/components/AccountNav";

// Hesap menüsünde kullanılan tüm ikonlar geçerli Material Symbols adları olmalı;
// geçersiz ad font ligatürünü çözemez ve ham metin basar (örn. "CARAVAN").
const VALID_ICONS = new Set(["rv_hookup", "inbox", "chat_bubble", "star", "person"]);

describe("AccountNav ikonları", () => {
  it("tüm sekmeler geçerli Material Symbols glyph'i kullanır", () => {
    const { container } = render(<AccountNav current="mesajlar" />);
    const icons = Array.from(
      container.querySelectorAll(".material-symbols-outlined"),
    ).map((el) => el.textContent);
    expect(icons).toHaveLength(5);
    for (const icon of icons) {
      expect(VALID_ICONS.has(icon ?? "")).toBe(true);
    }
  });

  it("İlanlarım sekmesi karavan ikonunu kullanır", () => {
    const { container } = render(<AccountNav current="ilanlarim" />);
    const ilanlarim = container.querySelector('a[href="/hesap/ilanlarim"]');
    expect(ilanlarim?.querySelector(".material-symbols-outlined")?.textContent).toBe(
      "rv_hookup",
    );
  });
});
