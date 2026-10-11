import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailClient } from "../src/lib/email/client";
import { resendClient } from "../src/lib/email/client";
import {
  sendBookingCompleted,
  sendBookingRequested,
  sendBookingStatusChanged,
  sendListingStatusChanged,
} from "../src/lib/email/events";
import { bookingCompletedTemplate } from "../src/lib/email/templates";
import { prisma } from "../src/lib/prisma";
import { makeListing, makeUser, resetDb } from "./helpers/db";

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

// console.error mock'ları her testten sonra temizlenir; aksi halde assertion
// patlarsa mock sonraki testlere sızar ve hata çıktısını susturur.
afterEach(() => {
  vi.restoreAllMocks();
});

// Tamamlanan konaklama testleri GERÇEK PostgreSQL kullanır (sendBookingCompleted
// ilan başlığını DB'den okur); diğerleri saf fonksiyon testleridir.
beforeEach(async () => {
  await resetDb();
});

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
  });
});

describe("RESEND_API_KEY yoksa", () => {
  it("resendClient.send loglayıp çözülür (throw etmez)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("RESEND_API_KEY", "");

    await expect(
      resendClient.send({ to: "a@b.com", subject: "Konu", html: "<p>x</p>" }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();

    vi.unstubAllEnvs();
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

// ---------------------------------------------------------------------------
// Tamamlanan konaklama → değerlendirme daveti (Backlog #5)
// ---------------------------------------------------------------------------

describe("bookingCompletedTemplate", () => {
  const data = {
    listingTitle: "Fethiye Karavanı",
    listingUrl: "http://localhost:3000/ilan/ckaravanckaravanckaravan",
  };

  it("konu ve gövde tamamlanma + değerlendirme davetini içerir", () => {
    const msg = bookingCompletedTemplate("kiraci@example.com", data);

    expect(msg.to).toBe("kiraci@example.com");
    expect(msg.subject).toContain("Konaklama tamamlandı");
    expect(msg.subject).toContain("değerlendirin");
    expect(msg.html).toContain("Konaklama tamamlandı");
    expect(msg.html).toContain("değerlendir");
  });

  it("ilan başlığını ve ilan bağlantısını (/ilan/{id}) gösterir", () => {
    const msg = bookingCompletedTemplate("kiraci@example.com", data);

    expect(msg.html).toContain("Fethiye Karavanı");
    expect(msg.html).toContain(`<a href="${data.listingUrl}"`);
  });

  it("ilan başlığını kaçırır — HTML enjeksiyonu geçmez", () => {
    const msg = bookingCompletedTemplate("kiraci@example.com", {
      ...data,
      listingTitle: 'Kötü <script>alert("x")</script> & "tırnak"',
    });

    expect(msg.html).not.toContain("<script>");
    expect(msg.html).toContain("&lt;script&gt;");
    expect(msg.html).toContain("&amp;");
  });
});

describe("sendBookingCompleted", () => {
  /** Sahip + ilan; ilan başlığı e-postada görünür. */
  async function seedListing(title = "Fethiye Karavanı") {
    const owner = await prisma.user.create({ data: makeUser() });
    return prisma.listing.create({ data: makeListing(owner.id, { title }) });
  }

  it("tamamlanan konaklamada kiracıya ilan bağlantısıyla değerlendirme daveti gider", async () => {
    const listing = await seedListing();
    const { client, sent } = captureClient();

    await sendBookingCompleted("kiraci@example.com", listing.id, client);

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("kiraci@example.com");
    expect(sent[0].subject).toContain("Konaklama tamamlandı");
    expect(sent[0].html).toContain("Fethiye Karavanı");
    expect(sent[0].html).toContain(`/ilan/${listing.id}`);
  });

  it("bağlantı NEXT_PUBLIC_APP_URL tabanını kullanır", async () => {
    const listing = await seedListing();
    const { client, sent } = captureClient();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://karavan.example.com");

    await sendBookingCompleted("kiraci@example.com", listing.id, client);
    vi.unstubAllEnvs();

    expect(sent[0].html).toContain(
      `https://karavan.example.com/ilan/${listing.id}`,
    );
  });

  it("client.send hata fırlatırsa yine de çözülür (reject etmez)", async () => {
    const listing = await seedListing();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const throwing: EmailClient = {
      async send() {
        throw new Error("resend patladı");
      },
    };

    await expect(
      sendBookingCompleted("kiraci@example.com", listing.id, throwing),
    ).resolves.toBeUndefined();
  });

  it("ilan bulunamazsa mail atmaz, hata sızmaz", async () => {
    const { client, sent } = captureClient();
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendBookingCompleted(
        "kiraci@example.com",
        "ckaravanbulunamyor0000001",
        client,
      ),
    ).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });
});
