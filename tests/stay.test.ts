import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { validateStay, type StayRules } from "../src/lib/stay";
import {
  staySchema,
  type StayInput,
} from "../src/lib/validators/booking";

// Sabit "bugün": testler gerçek tarihten bağımsız çalışır.
const today = "2026-10-10";
const nightlyPrice = new Prisma.Decimal(1500);
const baseRules: StayRules = { minRentalDays: 1, capacity: 4 };

function stayInput(overrides: Partial<StayInput> = {}): StayInput {
  return { startDate: "2026-10-10", endDate: "2026-10-13", guests: 2, ...overrides };
}

describe("validateStay", () => {
  it("endDate bugün veya geçmiş → hata", () => {
    // endDate = bugün (aynı gün): endDate > startDate değil.
    const sameDay = validateStay(
      baseRules,
      stayInput({ endDate: "2026-10-10" }),
      nightlyPrice,
      today,
    );
    expect(sameDay.ok).toBe(false);
    if (!sameDay.ok) {
      expect(sameDay.field).toBe("endDate");
    }

    // endDate geçmiş: startDate = bugün kabul edilmişken endDate geriye gidiyor.
    const past = validateStay(
      baseRules,
      stayInput({ endDate: "2026-10-09" }),
      nightlyPrice,
      today,
    );
    expect(past.ok).toBe(false);
    if (!past.ok) {
      expect(past.field).toBe("endDate");
    }
  });

  it("startDate = bugün kabul edilir", () => {
    const result = validateStay(baseRules, stayInput(), nightlyPrice, today);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.nights).toBe(3);
      expect(result.data.totalPrice.equals(new Prisma.Decimal(4500))).toBe(true);
    }
  });

  it("startDate geçmiş → hata (field=startDate)", () => {
    const result = validateStay(
      baseRules,
      stayInput({ startDate: "2026-10-09" }),
      nightlyPrice,
      today,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("startDate");
    }
  });

  it("31 gece → 'en fazla 30 gece' hatası", () => {
    // 2026-10-11 → 2026-11-11 tam 31 gece.
    const result = validateStay(
      baseRules,
      stayInput({ startDate: "2026-10-11", endDate: "2026-11-11" }),
      nightlyPrice,
      today,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("en fazla 30 gece");
      expect(result.field).toBe("endDate");
    }
  });

  it("minRentalDays=3 iken 2 gece → hata; 3 gece tamam", () => {
    const rules: StayRules = { minRentalDays: 3, capacity: 4 };

    const tooShort = validateStay(
      rules,
      stayInput({ startDate: "2026-10-11", endDate: "2026-10-13" }),
      nightlyPrice,
      today,
    );
    expect(tooShort.ok).toBe(false);
    if (!tooShort.ok) {
      expect(tooShort.error).toContain("En az 3 gece");
      expect(tooShort.field).toBe("endDate");
    }

    const exact = validateStay(
      rules,
      stayInput({ startDate: "2026-10-11", endDate: "2026-10-14" }),
      nightlyPrice,
      today,
    );
    expect(exact.ok).toBe(true);
    if (exact.ok) {
      expect(exact.data.nights).toBe(3);
    }
  });

  it("guests=5, capacity=4 → hata; 4 → tamam (sınır değerleri)", () => {
    const tooMany = validateStay(
      baseRules,
      stayInput({ guests: 5 }),
      nightlyPrice,
      today,
    );
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) {
      expect(tooMany.error).toContain("En fazla 4 kişi");
      expect(tooMany.field).toBe("guests");
    }

    const exact = validateStay(
      baseRules,
      stayInput({ guests: 4 }),
      nightlyPrice,
      today,
    );
    expect(exact.ok).toBe(true);
  });

  it("geçersiz format (2026-13-40) → field=startDate hatası", () => {
    const result = validateStay(
      baseRules,
      stayInput({ startDate: "2026-13-40" }),
      nightlyPrice,
      today,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe("startDate");
    }
  });
});

describe("staySchema", () => {
  it("guests sınırı 1..16: 0 ve 17 → hata; 1 ve 16 → tamam", () => {
    expect(staySchema.safeParse(stayInput({ guests: 0 })).success).toBe(false);
    expect(staySchema.safeParse(stayInput({ guests: 17 })).success).toBe(false);
    expect(staySchema.safeParse(stayInput({ guests: 1 })).success).toBe(true);
    expect(staySchema.safeParse(stayInput({ guests: 16 })).success).toBe(true);
  });
});
