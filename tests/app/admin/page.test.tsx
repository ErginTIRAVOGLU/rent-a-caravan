// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { resetDb } from "../../helpers/db";

// Yönetim "Genel Bakış" kartları — inline <a> + block çocuklar krom
// parçalanması yapmasın diye kart linki `block` taşır (hesap/mesajlar
// ConversationList satırındaki regresyon kalıbıyla aynı).

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

beforeEach(async () => {
  await resetDb();
});

describe("/admin page (Genel Bakış)", () => {
  it("kart linkleri block'tur (inline <a> krom artefaktı regresyonu)", async () => {
    const { default: AdminDashboardPage } = await import(
      "../../../src/app/admin/page"
    );
    const { container } = render(await AdminDashboardPage());

    const cardLinks = container.querySelectorAll("a.card");
    expect(cardLinks.length).toBe(4);
    for (const link of cardLinks) {
      expect(link.classList.contains("block")).toBe(true);
    }
  });
});
