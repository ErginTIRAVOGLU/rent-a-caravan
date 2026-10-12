import { describe, expect, it } from "vitest";

import { reconcileOptimistic } from "../../../src/lib/messages/optimistic";

function makeOpt(
  overrides: Partial<{
    id: string;
    senderId: string;
    content: string;
    createdAt: Date;
  }> = {},
) {
  return {
    id: "opt-1",
    senderId: "u1",
    content: "merhaba",
    createdAt: new Date("2026-10-12T10:00:00.000Z"),
    ...overrides,
  };
}

function makeServer(
  overrides: Partial<{
    id: string;
    senderId: string;
    content: string;
    createdAt: Date;
  }> = {},
) {
  return {
    id: "msg-1",
    senderId: "u1",
    content: "merhaba",
    createdAt: new Date("2026-10-12T10:00:01.000Z"),
    ...overrides,
  };
}

describe("reconcileOptimistic", () => {
  it("sunucu listesinde görünen optimistic mesajı listeden çıkarır", () => {
    const result = reconcileOptimistic([makeOpt()], [makeServer()]);
    expect(result).toEqual([]);
  });

  it("sunucu mesajı id eşleşmesiyle yakalar (içerik farklı olsa bile)", () => {
    const result = reconcileOptimistic(
      [makeOpt({ content: "değişti" })],
      [makeServer({ id: "opt-1", content: "bambaşka" })],
    );
    expect(result).toEqual([]);
  });

  it("sunucu listesi boşken optimistic mesajları korur", () => {
    const opt = makeOpt();
    expect(reconcileOptimistic([opt], [])).toEqual([opt]);
  });

  it("optimistic liste boşken aynı referansı döner (gereksiz render yok)", () => {
    const empty: never[] = [];
    expect(reconcileOptimistic(empty, [makeServer()])).toBe(empty);
  });

  it("sunucuda görünmeyen optimistic mesajları korur", () => {
    const mine = makeOpt();
    const other = makeOpt({
      id: "opt-2",
      senderId: "u2",
      content: "başka konuşma",
      createdAt: new Date("2026-10-12T10:05:00.000Z"),
    });
    const result = reconcileOptimistic(
      [mine, other],
      [makeServer({ content: "sunucuda bambaşka" })],
    );
    expect(result).toEqual([mine, other]);
  });

  it("aynı içerikten iki kez gönderildiyse yalnız yankılanan kadar silinir", () => {
    const first = makeOpt({
      id: "opt-1",
      createdAt: new Date("2026-10-12T10:00:00.000Z"),
    });
    const second = makeOpt({
      id: "opt-2",
      createdAt: new Date("2026-10-12T10:04:00.000Z"),
    });
    // Tek sunucu yankısı: yalnız zaman penceresine uyan ilk optimistic silinir.
    const result = reconcileOptimistic(
      [first, second],
      [makeServer({ createdAt: new Date("2026-10-12T10:00:30.000Z") })],
    );
    expect(result).toEqual([second]);
  });

  it("aynı içerikli eski geçmiş mesajı optimistic'i silmez (1 sn penceresi)", () => {
    const opt = makeOpt({ createdAt: new Date("2026-10-12T10:10:00.000Z") });
    const oldServer = makeServer({
      createdAt: new Date("2026-10-12T09:00:00.000Z"),
    });
    const result = reconcileOptimistic([opt], [oldServer]);
    expect(result).toEqual([opt]);
  });

  it("eşleşen optimistic yoksa aynı referansı döner (gereksiz render yok)", () => {
    const list = [makeOpt({ senderId: "u1" })];
    const result = reconcileOptimistic(
      list,
      [makeServer({ senderId: "u2", content: "farklı" })],
    );
    expect(result).toBe(list);
  });
});
