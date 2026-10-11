/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ListingHistoryList } from "../../src/components/ListingHistoryList";

// İlan geçmişi listesi: kronolojik satırlar (tarih + eski→yeni rozet + kim +
// gerekçe); boş geçmişte bilgi metni.

const ENTRIES = [
  {
    id: "c111111111111111111111111",
    fromStatus: "PENDING" as const,
    toStatus: "ACTIVE" as const,
    actorLabel: "Yönetici",
    reason: null as string | null,
    createdAt: new Date("2026-10-01T10:00:00.000Z"),
  },
  {
    id: "c222222222222222222222222",
    fromStatus: "PENDING" as const,
    toStatus: "REJECTED" as const,
    actorLabel: "Yönetici",
    reason: "Fotoğraflar yetersiz.",
    createdAt: new Date("2026-10-02T10:00:00.000Z"),
  },
];

describe("ListingHistoryList", () => {
  it("geçiş satırlarını tarih + eski→yeni + kim + gerekçeyle gösterir", () => {
    render(<ListingHistoryList entries={ENTRIES} />);

    expect(screen.getByText("İncelemede → Yayında")).toBeInTheDocument();
    expect(screen.getByText("İncelemede → Reddedildi")).toBeInTheDocument();
    expect(screen.getAllByText("Yönetici")).toHaveLength(2);
    expect(screen.getByText("Fotoğraflar yetersiz.")).toBeInTheDocument();
  });

  it("boş geçmişte bilgi metni gösterir", () => {
    render(<ListingHistoryList entries={[]} />);

    expect(
      screen.getByText("Bu ilan için henüz durum geçmişi yok."),
    ).toBeInTheDocument();
  });
});
