/// <reference types="@testing-library/jest-dom" />
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ListingPreviewPhotos } from "../../src/components/ListingPreviewPhotos";

// Önizleme fotoğraf ızgarası: photoUrls sırasıyla resimler + ilk fotoğrafta
// "Kapak" rozeti; boş listede bilgi metni.

describe("ListingPreviewPhotos", () => {
  it("photoUrls sırasıyla resimleri ve ilk fotoğrafta Kapak rozetini gösterir", () => {
    render(
      <ListingPreviewPhotos
        photoUrls={[
          "https://ornek.test/kapak.jpg",
          "https://ornek.test/oda.jpg",
        ]}
      />,
    );

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "https://ornek.test/kapak.jpg");
    expect(images[1]).toHaveAttribute("src", "https://ornek.test/oda.jpg");
    expect(screen.getByText("Kapak")).toBeInTheDocument();
  });

  it("boş listede bilgi metni gösterir", () => {
    render(<ListingPreviewPhotos photoUrls={[]} />);

    expect(screen.getByText("Henüz fotoğraf eklenmedi.")).toBeInTheDocument();
  });
});
