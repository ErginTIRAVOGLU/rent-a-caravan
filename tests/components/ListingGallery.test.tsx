/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ListingGallery } from "../../src/app/ilan/[id]/ListingGallery";

/**
 * Galeri regresyonu: küçük resimler tıklanabilir görünüyordu ama hiçbir
 * işleyicisi yoktu — ana görsel her zaman `photoUrls[0]`'a sabitti.
 */
const PHOTOS = [
  "https://ornek.test/1.jpg",
  "https://ornek.test/2.jpg",
  "https://ornek.test/3.jpg",
];

function mainImage(): HTMLImageElement {
  return screen.getByAltText(/Ana görsel/) as HTMLImageElement;
}

describe("ListingGallery", () => {
  it("ana görsel ilk fotoğrafı gösterir", () => {
    render(<ListingGallery photos={PHOTOS} title="Ege Turu" />);

    expect(mainImage().src).toContain("1.jpg");
  });

  it("küçük resme tıklayınca ana görsel değişir", async () => {
    const user = userEvent.setup();
    render(<ListingGallery photos={PHOTOS} title="Ege Turu" />);

    await user.click(screen.getByRole("button", { name: "Fotoğraf 2" }));
    expect(mainImage().src).toContain("2.jpg");

    await user.click(screen.getByRole("button", { name: "Fotoğraf 3" }));
    expect(mainImage().src).toContain("3.jpg");
  });

  it("seçili küçük resmi işaretler", async () => {
    const user = userEvent.setup();
    render(<ListingGallery photos={PHOTOS} title="Ege Turu" />);

    const first = screen.getByRole("button", { name: "Fotoğraf 1" });
    const second = screen.getByRole("button", { name: "Fotoğraf 2" });

    expect(first).toHaveAttribute("aria-current", "true");
    expect(second).not.toHaveAttribute("aria-current");

    await user.click(second);

    expect(second).toHaveAttribute("aria-current", "true");
    expect(first).not.toHaveAttribute("aria-current");
  });

  it("fotoğraf yoksa yer tutucu gösterir, şerit çizmez", () => {
    render(<ListingGallery photos={[]} title="Ege Turu" />);

    expect(screen.queryByAltText(/Ana görsel/)).not.toBeInTheDocument();
    expect(screen.getByText("photo_camera")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fotoğraf/ })).not.toBeInTheDocument();
  });

  it("tek fotoğrafta küçük resim şeridi gösterilmez", () => {
    render(<ListingGallery photos={[PHOTOS[0]]} title="Ege Turu" />);

    expect(mainImage().src).toContain("1.jpg");
    expect(screen.queryByRole("button", { name: /Fotoğraf/ })).not.toBeInTheDocument();
  });
});
