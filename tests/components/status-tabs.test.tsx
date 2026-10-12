/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// next/link'i düz <a> olarak mock'la (StatusTabs bağımlılığı).
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { StatusTabs, type TabOption } from "../../src/components/panel/StatusTabs";

const TABS: TabOption[] = [
  { value: "all", label: "Tümü", count: 12 },
  { value: "ACTIVE", label: "Yayında", count: 7 },
  { value: "PAUSED", label: "Askıda", count: 0 },
];

function hrefOf(name: RegExp): string | null {
  return screen.getByRole("link", { name }).getAttribute("href");
}

describe("StatusTabs", () => {
  it("tüm sekmeleri etiketleri ve sayaçlarıyla render eder", () => {
    render(
      <StatusTabs basePath="/hesap/ilanlarim" param="durum" tabs={TABS} current="all" />,
    );

    expect(screen.getByRole("link", { name: /Tümü/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Yayında/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Askıda/ })).toBeInTheDocument();
    expect(screen.getByTestId("tab-count-all")).toHaveTextContent("12");
    expect(screen.getByTestId("tab-count-ACTIVE")).toHaveTextContent("7");
    expect(screen.getByTestId("tab-count-PAUSED")).toHaveTextContent("0");
  });

  it("sayaçları tabular-nums ile gösterir", () => {
    render(
      <StatusTabs basePath="/hesap/ilanlarim" param="durum" tabs={TABS} current="all" />,
    );

    expect(screen.getByTestId("tab-count-all").className).toContain("tabular-nums");
  });

  it("aktif sekmeyi aria-current=\"page\" ile işaretler", () => {
    render(
      <StatusTabs basePath="/hesap/ilanlarim" param="durum" tabs={TABS} current="ACTIVE" />,
    );

    expect(screen.getByRole("link", { name: /Yayında/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /Tümü/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("varsayılan sekmeyi query parametresi olmadan bağlar", () => {
    render(
      <StatusTabs basePath="/hesap/ilanlarim" param="durum" tabs={TABS} current="ACTIVE" />,
    );

    expect(hrefOf(/Tümü/)).toBe("/hesap/ilanlarim");
    // Varsayılan olmayan sekmeler ?param=value üretir.
    expect(hrefOf(/Yayında/)).toBe("/hesap/ilanlarim?durum=ACTIVE");
    expect(hrefOf(/Askıda/)).toBe("/hesap/ilanlarim?durum=PAUSED");
  });

  it("mevcut query parametrelerini (q) korur", () => {
    render(
      <StatusTabs
        basePath="/hesap/ilanlarim?q=ege"
        param="durum"
        tabs={TABS}
        current="all"
      />,
    );

    expect(hrefOf(/Tümü/)).toBe("/hesap/ilanlarim?q=ege");
    expect(hrefOf(/Yayında/)).toBe("/hesap/ilanlarim?q=ege&durum=ACTIVE");
  });

  it("param adını sabitlemez; verilen adı kullanır", () => {
    render(
      <StatusTabs basePath="/hesap/taleplerim" param="sekme" tabs={TABS} current="all" />,
    );

    expect(hrefOf(/Yayında/)).toBe("/hesap/taleplerim?sekme=ACTIVE");
  });
});
