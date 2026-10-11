import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailClient, EmailMessage } from "../../../src/lib/email/client";
import { sendDailyDigest } from "../../../src/lib/email/events";
import { prisma } from "../../../src/lib/prisma";
import { makeListing, makeUser, resetDb } from "../../helpers/db";

// Günlük mesaj özeti (T9): okunmamış mesajı olan kullanıcılara günde bir
// e-posta. Testler GERÇEK PostgreSQL + sahte e-posta istemcisiyle koşar
// (client parametresi enjekte edilir; resend'a hiç dokunulmaz).
//
// Sorgu semantiği: okunmamış = readAt NULL ∧ senderId != alıcı; pencere =
// son 7 gün; kullanıcı başına TEK e-posta, en fazla 5 sohbet.

/** Sahte istemci: gönderilen mailleri yakalar. */
function captureClient(): {
  client: EmailClient;
  sent: EmailMessage[];
} {
  const sent: EmailMessage[] = [];
  const client: EmailClient = {
    async send(msg) {
      sent.push(msg);
    },
  };
  return { client, sent };
}

type From = "owner" | "renter";

interface MessageSpec {
  from: From;
  content: string;
  /** Kaç saat önce yazıldı (varsayılan: 1 saat önce). */
  hoursAgo?: number;
  /** Okundu işaretli mi (varsayılan: okunmamış). */
  read?: boolean;
}

/** Mevcut sohbete mesaj yazar; createdAt explicit verilir (pencere testleri). */
async function writeMessages(
  conversationId: string,
  ids: { ownerId: string; renterId: string },
  specs: MessageSpec[],
): Promise<void> {
  for (const spec of specs) {
    await prisma.message.create({
      data: {
        conversationId,
        senderId: spec.from === "owner" ? ids.ownerId : ids.renterId,
        content: spec.content,
        createdAt: new Date(Date.now() - (spec.hoursAgo ?? 1) * 60 * 60 * 1000),
        readAt: spec.read ? new Date() : null,
      },
    });
  }
}

/** Sahip + kiracı + ilan + sohbet; verilen mesajlarla. */
async function seedConversation(specs: MessageSpec[]) {
  const owner = await prisma.user.create({
    data: makeUser({ name: "Sahip Ayşe" }),
  });
  const renter = await prisma.user.create({
    data: makeUser({ name: "Kiracı Mehmet" }),
  });
  const listing = await prisma.listing.create({
    data: makeListing(owner.id, { title: "Antalya Karavanı" }),
  });
  const conversation = await prisma.conversation.create({
    data: { listingId: listing.id, renterId: renter.id, ownerId: owner.id },
  });
  await writeMessages(
    conversation.id,
    { ownerId: owner.id, renterId: renter.id },
    specs,
  );
  return { owner, renter, listing, conversation };
}

/** Kiracı + sahip + N sohbet; her sohbette sahipten bir okunmamış mesaj. */
async function seedRenterConversations(count: number) {
  const owner = await prisma.user.create({
    data: makeUser({ name: "Sahip Ayşe" }),
  });
  const renter = await prisma.user.create({
    data: makeUser({ name: "Kiracı Mehmet" }),
  });
  for (let i = 1; i <= count; i += 1) {
    const listing = await prisma.listing.create({
      data: makeListing(owner.id, { title: `İlan ${i}` }),
    });
    const conversation = await prisma.conversation.create({
      data: { listingId: listing.id, renterId: renter.id, ownerId: owner.id },
    });
    // i saat önce → i=1 en yeni, i=count en eski (sıralama testi için).
    await writeMessages(
      conversation.id,
      { ownerId: owner.id, renterId: renter.id },
      [{ from: "owner", content: `Mesaj ${i}`, hoursAgo: i }],
    );
  }
  return { owner, renter };
}

/** Girilen e-postayı yakalar; bulamazsa test zaten fail olur. */
function mailTo(sent: EmailMessage[], email: string): EmailMessage {
  const mail = sent.find((msg) => msg.to === email);
  expect(mail, `${email} adresine e-posta bekleniyordu`).toBeDefined();
  return mail as EmailMessage;
}

beforeEach(async () => {
  await resetDb();
});

describe("sendDailyDigest", () => {
  it("karşı tarafın okunmamış mesajı varsa kullanıcıya tek özet maili atar", async () => {
    const { renter, conversation } = await seedConversation([
      { from: "owner", content: "İlan hâlâ müsait, tarihler uygun mu?" },
    ]);
    const { client, sent } = captureClient();

    const count = await sendDailyDigest(client);

    expect(count).toBe(1); // kullanıcı sayısı (sohbet sayısı değil)
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(renter.email);
    expect(sent[0].subject).toContain("Günlük mesaj özetiniz");
    expect(sent[0].html).toContain("Antalya Karavanı"); // ilan başlığı
    expect(sent[0].html).toContain("İlan hâlâ müsait, tarihler uygun mu?"); // önizleme
    expect(sent[0].html).toContain("1 okunmamış mesaj"); // sohbet başına okunmamış
    expect(sent[0].html).toContain("Mesajları gör");
    expect(sent[0].html).toContain(`/hesap/mesajlar/${conversation.id}`);
    expect(sent[0].html).toContain("Kiracı Mehmet"); // hitaben
  });

  it("kendi gönderdiği okunmamış mesaj alıcının özetini tetiklemez", async () => {
    const { owner, renter } = await seedConversation([
      { from: "renter", content: "Kiracının kendi okunmamış mesajı" },
    ]);
    const { client, sent } = captureClient();

    const count = await sendDailyDigest(client);

    // Okunmamışlık ALICIYA göredir: kiracı kendi mesajını saymaz (mail yok),
    // sahip aynı mesajı okumadığı için özet alır.
    expect(count).toBe(1);
    expect(sent.map((m) => m.to)).toEqual([owner.email]);
    expect(sent.some((m) => m.to === renter.email)).toBe(false);
  });

  it("7 günden eski okunmamış mesajlar özeti tetiklemez", async () => {
    await seedConversation([
      { from: "owner", content: "Geçen haftaki mesaj", hoursAgo: 24 * 8 },
    ]);
    const { client, sent } = captureClient();

    const count = await sendDailyDigest(client);

    expect(count).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("pencere içindeki eski mesajlar (6 gün) özete girer", async () => {
    const { renter } = await seedConversation([
      { from: "owner", content: "Altı gün önceki mesaj", hoursAgo: 24 * 6 },
    ]);
    const { client, sent } = captureClient();

    const count = await sendDailyDigest(client);

    expect(count).toBe(1);
    expect(sent[0].to).toBe(renter.email);
    expect(sent[0].html).toContain("Altı gün önceki mesaj");
  });

  it("okunmamış sayısını sohbet başına doğru toplar", async () => {
    await seedConversation([
      { from: "owner", content: "Birinci mesaj" },
      { from: "owner", content: "İkinci mesaj", hoursAgo: 2 },
      { from: "renter", content: "Kendi mesajım", hoursAgo: 3, read: true },
    ]);
    const { client, sent } = captureClient();

    const count = await sendDailyDigest(client);

    expect(count).toBe(1); // tek kullanıcı (kiracı), tek mail
    expect(sent[0].html).toContain("2 okunmamış mesaj"); // kiracı için 2
  });

  it("aynı gönderenin birden çok okunmamış mesajında önizleme EN YENİ olandır", async () => {
    const { renter } = await seedConversation([
      { from: "owner", content: "Eski okunmamış mesaj", hoursAgo: 5 },
      { from: "owner", content: "En yeni okunmamış mesaj", hoursAgo: 1 },
    ]);
    const { client, sent } = captureClient();

    await sendDailyDigest(client);

    // last-write-wins regresyonu: eski mesaj yeninin üstüne yazılmamalı.
    const mail = mailTo(sent, renter.email);
    expect(mail.html).toContain("En yeni okunmamış mesaj");
    expect(mail.html).not.toContain("Eski okunmamış mesaj");
    expect(mail.html).toContain("2 okunmamış mesaj");
  });

  it("önizleme en son gelen KARŞI TARAF mesajıdır", async () => {
    const { owner, renter } = await seedConversation([
      { from: "owner", content: "Eski mesaj", hoursAgo: 5 },
      { from: "renter", content: "Kendi son mesajım", hoursAgo: 2 },
      { from: "owner", content: "Sahibin yeni mesajı", hoursAgo: 1 },
    ]);
    const { client, sent } = captureClient();

    await sendDailyDigest(client);

    // Kiracı: sahibin İKİ okunmamış mesajı — önizleme en yeni olan.
    const toRenter = mailTo(sent, renter.email);
    expect(toRenter.html).toContain("Sahibin yeni mesajı");
    expect(toRenter.html).not.toContain("Eski mesaj");
    expect(toRenter.html).not.toContain("Kendi son mesajım"); // kendi mesajı sayılmaz
    expect(toRenter.html).toContain("2 okunmamış mesaj");
    // Sahip: kiracının okunmamış mesajı.
    const toOwner = mailTo(sent, owner.email);
    expect(toOwner.html).toContain("Kendi son mesajım");
    expect(toOwner.html).toContain("1 okunmamış mesaj");
  });

  it("aynı sohbette hem kiracı hem sahip birer özet alır", async () => {
    const { owner, renter } = await seedConversation([
      { from: "owner", content: "Sahip mesajı" },
      { from: "renter", content: "Kiracı mesajı", hoursAgo: 1 },
    ]);
    const { client, sent } = captureClient();

    const count = await sendDailyDigest(client);

    expect(count).toBe(2); // iki ayrı kullanıcı, iki ayrı mail
    expect(sent.map((m) => m.to).sort()).toEqual(
      [owner.email, renter.email].sort(),
    );
  });

  it("kullanıcı başına tek mail ve en fazla 5 sohbet listeler", async () => {
    const { owner, renter } = await seedRenterConversations(6);
    const { client, sent } = captureClient();

    const count = await sendDailyDigest(client);

    // Kiracı 6 sohbette okunmamış görür ama tek mail, 5 sohbet.
    expect(count).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(renter.email);
    const links = sent[0].html.match(/Mesajları gör/g) ?? [];
    expect(links).toHaveLength(5);
    expect(sent[0].html).toContain("Mesaj 1"); // en yeni sohbet listede
    expect(sent[0].html).not.toContain("Mesaj 6"); // en eski (6.) kesildi
    expect(sent[0].html).not.toContain("İlan 6");
    // Sahibin okunmamışı yok (mesajları kendi attı) → mail yok.
    expect(sent.some((m) => m.to === owner.email)).toBe(false);
    void renter;
  });

  it("HTML kaçırma ve Türkçe karakterler bozulmaz", async () => {
    const { renter } = await seedConversation([
      { from: "owner", content: 'Şahane bir <b>karavan</b> & "şarj" aygıtı' },
    ]);
    const { client, sent } = captureClient();

    await sendDailyDigest(client);

    const html = mailTo(sent, renter.email).html;
    expect(html).toContain('<meta charset="utf-8"');
    expect(html).toContain("Antalya Karavanı"); // ı, ş
    expect(html).toContain("Şahane bir");
    expect(html).toContain("&lt;b&gt;karavan&lt;/b&gt;"); // kötü niyetli içerik kaçırıldı
    expect(html).toContain("&amp;");
    expect(html).not.toContain("<b>karavan</b>"); // ham etiket asla geçmez
  });

  it("hiç okunmamış mesaj yoksa 0 döner ve mail atılmaz", async () => {
    const { client, sent } = captureClient();

    const count = await sendDailyDigest(client);

    expect(count).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("bir kullanıcının maili hata alsa diğerleri yine denenir", async () => {
    await seedConversation([
      { from: "owner", content: "Sahip mesajı" },
      { from: "renter", content: "Kiracı mesajı", hoursAgo: 1 },
    ]);
    const sent: EmailMessage[] = [];
    const failing: EmailClient = {
      async send(msg) {
        sent.push(msg);
        throw new Error("resend kapalı");
      },
    };
    vi.spyOn(console, "error").mockImplementation(() => {});

    const count = await sendDailyDigest(failing);

    expect(count).toBe(0); // ikisi de başarısız ama reject etmez
    expect(sent).toHaveLength(2); // ilk hatadan sonra durmaz
  });

  it("kullanıcı başına bir kez gönderir ve sayıyı döner", async () => {
    const sent: EmailMessage[] = [];
    const flaky: EmailClient = {
      async send(msg) {
        sent.push(msg);
      },
    };
    await seedConversation([
      { from: "owner", content: "Sahip mesajı" },
      { from: "renter", content: "Kiracı mesajı", hoursAgo: 1 },
    ]);

    const count = await sendDailyDigest(flaky);

    expect(sent).toHaveLength(2); // her kullanıcıya yalnız bir kez
    expect(count).toBe(2);
  });
});
