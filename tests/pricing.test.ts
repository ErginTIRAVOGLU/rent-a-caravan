import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { calculateNights, calculateTotalPrice } from "../src/lib/pricing";

describe("calculateNights", () => {
  it("10-10 → 11-10 = 1 gece", () => {
    expect(calculateNights("2026-10-10", "2026-10-11")).toBe(1);
  });

  it("30 gece hesaplanır", () => {
    expect(calculateNights("2026-10-01", "2026-10-31")).toBe(30);
  });
});

describe("calculateTotalPrice", () => {
  it("totalPrice = nights × nightlyPrice (Decimal)", () => {
    const totalPrice = calculateTotalPrice(3, new Prisma.Decimal(1500));
    expect(totalPrice).toBeInstanceOf(Prisma.Decimal);
    expect(totalPrice.equals(new Prisma.Decimal(4500))).toBe(true);
    expect(totalPrice.toString()).toBe("4500");
  });
});
