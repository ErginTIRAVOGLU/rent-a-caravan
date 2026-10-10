import { describe, expect, it, vi } from "vitest";

import type { EmailClient } from "../src/lib/email/client";
import {
  sendBookingRequested,
  sendBookingStatusChanged,
  sendListingStatusChanged,
} from "../src/lib/email/events";

// Sahte istemci: send çağrılarını yakalar; testler enjekte eder (default: resendClient).
function captureClient(): { client: EmailClient; sent: Array<{ to: string; subject: string; html: string }> } {
  const sent: Array<{ to: string; subject: string; html: string }> = [];
  const client: EmailClient = {
    async send(msg) {
      sent.push(msg);
    },
  };
  return { client, sent };
}

// Prisma `DateTime @db.Date` → UTC gece yarısı Date.
const START = new Date("2026-10-11T00:00:00.000Z");
const END = new Date("2026-10-14T00:00:00.000Z");

describe("sendBookingRequested", () => {
  it("talep olayı: kiracıya 'Karavan talebiniz alındı' konulu mail atar", async () => {
    const { client, sent } = captureClient();

    await sendBookingRequested(
      "kiraci@example.com",
      { renterName: "Ayşe Yılmaz", listingTitle: "Çamlık Karavan", startDate: START, endDate: END },
      client,
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("kiraci@example.com");
    expect(sent[0].subject).toContain("Karavan talebiniz alındı");
  });
});

describe("sendBookingStatusChanged", () => {
  it("onay olayı: 'Talebiniz onaylandı' + tarihler body'de görünür", async () => {
    const { client, sent } = captureClient();

    await sendBookingStatusChanged(
      "kiraci@example.com",
      { listingTitle: "Çamlık Karavan", startDate: START, endDate: END, status: "APPROVED" },
      client,
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain("Talebiniz onaylandı");
    expect(sent[0].html).toContain("11.10.2026");
    expect(sent[0].html).toContain("14.10.2026");
  });

  it("red olayı gerekçeyi body'ye yazar", async () => {
    const { client, sent } = captureClient();

    await sendBookingStatusChanged(
      "kiraci@example.com",
      {
        listingTitle: "Çamlık Karavan",
        startDate: START,
        endDate: END,
        status: "REJECTED",
        reason: "Tarihler uygun değil",
      },
      client,
    );

    expect(sent[0].subject).toContain("Talebiniz reddedildi");
    expect(sent[0].html).toContain("Gerekçe: Tarihler uygun değil");
  });
});

describe("sendListingStatusChanged", () => {
  it("ilan sahibine 'İlanınız yayında' haberi gider", async () => {
    const { client, sent } = captureClient();

    await sendListingStatusChanged(
      "sahip@example.com",
      { listingTitle: "Çamlık Karavan", status: "ACTIVE" },
      client,
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("sahip@example.com");
    expect(sent[0].subject).toContain("İlanınız yayında");
  });

  it("ilan redde gerekçe body'de görünür", async () => {
    const { client, sent } = captureClient();

    await sendListingStatusChanged(
      "sahip@example.com",
      { listingTitle: "Çamlık Karavan", status: "REJECTED", reason: "Fotoğraflar yetersiz" },
      client,
    );

    expect(sent[0].html).toContain("Gerekçe: Fotoğraflar yetersiz");
  });
});

describe("gönderim hatası asla ana akışı düşürmez", () => {
  it("client.send hata fırlatırsa fonksiyon yine de çözülür (reject etmez)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const throwing: EmailClient = {
      async send() {
        throw new Error("resend patladı");
      },
    };

    await expect(
      sendBookingRequested(
        "kiraci@example.com",
        { renterName: "Ayşe", listingTitle: "Karavan", startDate: START, endDate: END },
        throwing,
      ),
    ).resolves.toBeUndefined();

    await expect(
      sendBookingStatusChanged(
        "kiraci@example.com",
        { listingTitle: "Karavan", startDate: START, endDate: END, status: "APPROVED" },
        throwing,
      ),
    ).resolves.toBeUndefined();

    await expect(
      sendListingStatusChanged("sahip@example.com", { listingTitle: "Karavan", status: "PAUSED" }, throwing),
    ).resolves.toBeUndefined();

    vi.restoreAllMocks();
  });
});

describe("Türkçe şablonlar", () => {
  it("şablonlar Türkçe karakterleri bozmaz (ç, ğ, ı)", async () => {
    const { client, sent } = captureClient();

    await sendBookingRequested(
      "kiraci@example.com",
      {
        renterName: "Yağmur Çelik",
        listingTitle: "Açık Hava Karavanı — Işıklı Gece Turu",
        startDate: START,
        endDate: END,
      },
      client,
    );

    const html = sent[0].html;
    expect(html).toContain('<meta charset="utf-8"');
    expect(html).toContain("Yağmur Çelik"); // ğ, Ç
    expect(html).toContain("Açık Hava Karavanı"); // ç, ı
    expect(html).toContain("Işıklı Gece Turu"); // ı, ş
  });
});
