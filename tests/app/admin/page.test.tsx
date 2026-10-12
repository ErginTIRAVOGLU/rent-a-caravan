// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, within } from "@testing-library/react";

import { prisma } from "../../../src/lib/prisma";
import { makeUser, makeListing, resetDb } from "../../helpers/db";

// Yönetim "Genel Bakış" — stat kartları + moderasyon/şikâyet kuyruğu + son
// aktivite. Stat kartları tıklanabilir block bağlantıdır (inline <a> + block
// çocuklar krom parçalanması yapmasın diye `block` taşır; hesap/mesajlar
// ConversationList satırındaki regresyon kalıbıyla aynı).

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
}));

beforeEach(async () => {
  await resetDb();
});

async function renderDashboard() {
  const { default: AdminDashboardPage } = await import(
    "../../../src/app/admin/page"
  );
  return render(await AdminDashboardPage());
}

/** Etiketin bulunduğu stat kartının metnini döner (etiket + değer + ikon). */
function statText(container: HTMLElement, label: string): string {
  const card = within(container).getByText(label).closest(".card");
  return card?.textContent ?? "";
}

describe("/admin page (Genel Bakış)", () => {
  it("4 stat kartı gerçek sayıları gösterir ve block bağlantıdır", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    for (let i = 0; i < 4; i += 1) {
      await prisma.user.create({ data: makeUser() });
    }
    await prisma.listing.create({
      data: makeListing(owner.id, { status: "PENDING" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { status: "PENDING" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    await prisma.listing.create({
      data: makeListing(owner.id, { status: "ACTIVE" }),
    });
    await prisma.report.create({
      data: {
        reporterId: owner.id,
        targetType: "LISTING",
        targetId: "hedef",
        reason: "Uygunsuz içerik.",
      },
    });

    const { container } = await renderDashboard();

    expect(statText(container, "Bekleyen ilan")).toContain("2");
    expect(statText(container, "Aktif ilan")).toContain("3");
    expect(statText(container, "Kullanıcı")).toContain("5");
    expect(statText(container, "Açık şikâyet")).toContain("1");

    const cardLinks = container.querySelectorAll("a.card");
    expect(cardLinks.length).toBe(4);
    for (const link of cardLinks) {
      expect(link.classList.contains("block")).toBe(true);
    }
  });

  it("sıfır veride 4 stat 0 gösterir ve üç widget başlığı görünür", async () => {
    const { container } = await renderDashboard();

    expect(statText(container, "Bekleyen ilan")).toContain("0");
    expect(statText(container, "Aktif ilan")).toContain("0");
    expect(statText(container, "Kullanıcı")).toContain("0");
    expect(statText(container, "Açık şikâyet")).toContain("0");

    expect(within(container).getByText("Moderasyon kuyruğu")).toBeInTheDocument();
    expect(within(container).getByText("Son aktivite")).toBeInTheDocument();
    expect(within(container).getByText("Şikâyet kuyruğu")).toBeInTheDocument();
  });

  it("Moderasyon kuyruğu en yeni 3 PENDING ilanı /admin/ilanlar/[id] linkiyle gösterir", async () => {
    const owner = await prisma.user.create({ data: makeUser() });
    const titles = ["En yeni", "İkinci", "Üçüncü", "En eski"];
    for (let i = 0; i < titles.length; i += 1) {
      await prisma.listing.create({
        data: makeListing(owner.id, {
          status: "PENDING",
          title: titles[i],
          createdAt: new Date(Date.UTC(2026, 0, 10 - i)),
        }),
      });
    }

    const { container } = await renderDashboard();
    const queue = within(container)
      .getByText("Moderasyon kuyruğu")
      .closest("section");
    expect(queue).not.toBeNull();

    expect(within(queue as HTMLElement).getByText("En yeni")).toBeInTheDocument();
    expect(within(queue as HTMLElement).getByText("İkinci")).toBeInTheDocument();
    expect(within(queue as HTMLElement).getByText("Üçüncü")).toBeInTheDocument();
    expect(within(queue as HTMLElement).queryByText("En eski")).toBeNull();

    const links = (queue as HTMLElement).querySelectorAll(
      'a[href^="/admin/ilanlar/"]',
    );
    expect(links.length).toBe(3);
  });

  it("Şikâyet kuyruğu en yeni 2 OPEN şikâyeti admin yüzeyine linkler", async () => {
    const reporter = await prisma.user.create({
      data: makeUser({ name: "Bildiren Kişi" }),
    });
    const base = {
      reporterId: reporter.id,
      targetId: "hedef",
    };
    await prisma.report.create({
      data: {
        ...base,
        targetType: "LISTING",
        reason: "En yeni şikâyet",
        status: "OPEN",
        createdAt: new Date(Date.UTC(2026, 0, 12)),
      },
    });
    await prisma.report.create({
      data: {
        ...base,
        targetType: "USER",
        reason: "İkinci şikâyet",
        status: "OPEN",
        createdAt: new Date(Date.UTC(2026, 0, 11)),
      },
    });
    await prisma.report.create({
      data: {
        ...base,
        targetType: "LISTING",
        reason: "Üçüncü şikâyet",
        status: "OPEN",
        createdAt: new Date(Date.UTC(2026, 0, 10)),
      },
    });
    await prisma.report.create({
      data: {
        ...base,
        targetType: "LISTING",
        reason: "Kapanmış şikâyet",
        status: "CLOSED",
        createdAt: new Date(Date.UTC(2026, 0, 13)),
      },
    });

    const { container } = await renderDashboard();
    const queue = within(container)
      .getByText("Şikâyet kuyruğu")
      .closest("section");
    expect(queue).not.toBeNull();

    expect(
      within(queue as HTMLElement).getByText("En yeni şikâyet"),
    ).toBeInTheDocument();
    expect(
      within(queue as HTMLElement).getByText("İkinci şikâyet"),
    ).toBeInTheDocument();
    expect(
      within(queue as HTMLElement).queryByText("Üçüncü şikâyet"),
    ).toBeNull();
    expect(
      within(queue as HTMLElement).queryByText("Kapanmış şikâyet"),
    ).toBeNull();

    const links = (queue as HTMLElement).querySelectorAll(
      'a[href="/admin/sikayetler"]',
    );
    expect(links.length).toBeGreaterThanOrEqual(2);
  });

  it("Son aktivite en yeni olayları (ilan, şikâyet, kullanıcı, onay) gösterir", async () => {
    const user = await prisma.user.create({
      data: makeUser({ name: "Yeni Kullanıcı" }),
    });
    const listing = await prisma.listing.create({
      data: makeListing(user.id, { status: "PENDING", title: "Başvuru İlanı" }),
    });
    await prisma.report.create({
      data: {
        reporterId: user.id,
        targetType: "USER",
        targetId: user.id,
        reason: "Şikâyet",
      },
    });
    await prisma.listingStatusHistory.create({
      data: {
        listingId: listing.id,
        fromStatus: "PENDING",
        toStatus: "ACTIVE",
        actorId: "admin",
      },
    });

    const { container } = await renderDashboard();
    const activity = within(container).getByText("Son aktivite").closest("section");
    expect(activity).not.toBeNull();

    expect(
      within(activity as HTMLElement).getByText("Yeni ilan başvurusu"),
    ).toBeInTheDocument();
    expect(
      within(activity as HTMLElement).getByText("Şikâyet açıldı"),
    ).toBeInTheDocument();
    expect(
      within(activity as HTMLElement).getByText("Yeni kullanıcı"),
    ).toBeInTheDocument();
    expect(
      within(activity as HTMLElement).getByText("İlan onaylandı"),
    ).toBeInTheDocument();
  });
});
