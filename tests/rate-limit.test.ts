import { beforeEach, expect, it } from "vitest";

import {
  assertRateLimit,
  BOOKING_LIMIT,
  MESSAGE_LIMIT,
} from "../src/lib/rate-limit";
import { prisma } from "../src/lib/prisma";
import { resetDb } from "./helpers/db";

// DB sayaçlı hız sınırı (spec §5): RateLimitEntry satırı (key, bucket) ile
// benzersiz, `expiresAt` pencere ucunu tutar; süresi dolan satır sıfırlanır.
//
// Not: sayaç testleri dakika sınırında koşmaz — test boyunca yapılan kısa DB
// çağrıları gerçek saatte rastgele dakika sınırına (boundary) denk gelebilir
// ve testi flaky yapar. Pencere mekanizması (sınır aşımı + expiresAt sıfırlaması)
// pencere boyutundan bağımsızdır; zorunlu 5/60sn ve 20/60sn pin'leri ayrıca
// aşağıdaki pin testinde doğrulanır.

const LIMIT_ERROR = "Çok fazla istek gönderdiniz, biraz bekleyin";

/** Dakika sınırı flake'ine kapalı uzun pencere (24 saat). */
const LONG_WINDOW = 86400;

beforeEach(async () => {
  await resetDb();
});

it("5. istek geçer, 6. istek fail döner", async () => {
  for (let i = 0; i < 5; i++) {
    const result = await assertRateLimit("booking", "user-a", 5, LONG_WINDOW);
    expect(result.ok).toBe(true);
  }

  const sixth = await assertRateLimit("booking", "user-a", 5, LONG_WINDOW);

  expect(sixth.ok).toBe(false);
  if (!sixth.ok) {
    expect(sixth.error).toBe(LIMIT_ERROR);
  }
  // Sayaç istek başına artar: 6 deneme = 6 (aşım da sayılır).
  const row = await prisma.rateLimitEntry.findFirstOrThrow({
    where: { key: "user-a" },
  });
  expect(row.count).toBe(6);
});

it("pencere dolduktan sonra tekrar izin verilir (expiresAt manipülasyonu)", async () => {
  for (let i = 0; i < 5; i++) {
    const result = await assertRateLimit("booking", "user-b", 5, LONG_WINDOW);
    expect(result.ok).toBe(true);
  }
  const blocked = await assertRateLimit("booking", "user-b", 5, LONG_WINDOW);
  expect(blocked.ok).toBe(false);

  // Pencere sonunu geçmişe çek: satır "dolmuş" sayılır ve sıfırlanmalı.
  await prisma.rateLimitEntry.updateMany({
    where: { key: "user-b" },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });

  const afterExpiry = await assertRateLimit("booking", "user-b", 5, LONG_WINDOW);

  expect(afterExpiry.ok).toBe(true);
  const row = await prisma.rateLimitEntry.findFirstOrThrow({
    where: { key: "user-b" },
  });
  expect(row.count).toBe(1); // sayaç 6'da kalmadı, yeni pencerede 1'e indi
});

it("farklı key'ler bağımsız sayılır", async () => {
  for (let i = 0; i < 5; i++) {
    const result = await assertRateLimit("booking", "user-x", 5, LONG_WINDOW);
    expect(result.ok).toBe(true);
  }
  const exhaustedX = await assertRateLimit("booking", "user-x", 5, LONG_WINDOW);
  expect(exhaustedX.ok).toBe(false);

  // Yeni key etkilenmez; farklı kind (bucket) da ayrı sayılır.
  const freshY = await assertRateLimit("booking", "user-y", 5, LONG_WINDOW);
  expect(freshY.ok).toBe(true);
  const messageForX = await assertRateLimit(
    "message",
    "user-x",
    MESSAGE_LIMIT.limit,
    MESSAGE_LIMIT.windowSeconds,
  );
  expect(messageForX.ok).toBe(true);
});

it("pin'ler: BOOKING_LIMIT 5/60sn, MESSAGE_LIMIT 20/60sn", () => {
  expect(BOOKING_LIMIT).toEqual({ limit: 5, windowSeconds: 60 });
  expect(MESSAGE_LIMIT).toEqual({ limit: 20, windowSeconds: 60 });
});
