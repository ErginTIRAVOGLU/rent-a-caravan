# Yönetim Panelleri Yenileme — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sahip/alıcı (`/hesap`) ve admin (`/admin`) panellerini ortak bir sidebar+topbar kabuğuna taşımak; her birine gerçek bir "Genel Bakış" dashboard'u, sayaçlı durum sekmeleri, sunucu taraflı arama ve tablo görünümü kazandırmak.

**Architecture:** Panel rotaları ortak bir `PanelShell` (sidebar + topbar + içerik) kullanır; site header/footer panel rotalarında gizlenir. Liste sayfaları durum/arama durumunu URL `searchParams`'ından okur (sunucu bileşeni, istemci durum yok). Sayaçlar tek yerde (`layout`) hesaplanır, satır içi aksiyonlardan sonra `router.refresh()` ile tazelenir. Tüm eylemler mevcut `src/server/*` service katmanını ve server action'ları yeniden kullanır — yeni iş kuralı yok.

**Tech Stack:** Next.js 16.4.0 (App Router, Turbopack), React 19 server components, Tailwind CSS v4 (`@theme` tokenları), Prisma 7, Vitest + Testing Library, Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-10-12-yonetim-panelleri-design.md`

## Global Constraints

- Next.js 16.4.0 App Router; veri çekme sunucu bileşenlerinde. İstemci bileşeni yalnız etkileşim gerektiğinde.
- Tailwind v4 `@theme` tokenları kullanılır; **yeni renk/spacing/gölge değeri icat edilmez**. Mevcut yardımcı sınıflar: `.card`, `.btn`, `.btn-primary`, `.btn-outline`, `.btn-sm`, `.badge`, `.badge-primary|success|error|warning|info|neutral`, `.eyebrow`, `.section-title`, `text-price`, `text-headline-lg`, `text-title-md`, `text-body-md`, `text-body-sm`, `text-label-lg`, `bg-surface-low|mid|lowest`, `text-primary|accent|on-surface|on-surface-variant|outline`.
- İkonlar Material Symbols (`<span className="material-symbols-outlined">`), font Plus Jakarta Sans. Yeni dependency eklenmez.
- Native `alert`/`confirm` yok — mevcut modal kalıbı.
- Her görevde TDD: önce kırmızı test, sonra minimal kod. Görev sonunda `npm run check` (prisma generate + next typegen + tsc + eslint + vitest) 0 uyarı; commit mesajları ASCII.
- URL'ler korunur: `/hesap`, `/hesap/ilanlarim`, `/hesap/taleplerim`, `/hesap/mesajlar`, `/hesap/degerlendirmeler`, `/hesap/profil`, `/admin/*` değişmez. Eklenen query parametreleri: `durum`, `q`, `sekme` (isimler görevlerde sabitlenmiştir).
- Test yerleşimi: sayfa testleri `tests/app/...`, bileşen testleri `tests/components/...`, saf mantık testleri `tests/lib/...` veya `tests/server/...`. Mevcut örnekler: `tests/app/admin/page.test.tsx`, `tests/components/SiteHeader.test.tsx`.

## Review Focus

Spec'in ima ettiği ama hiçbir görevin testi doğrudan kapsamadığı, kullanıcıyı en çok ısıracak beş girdi/durum — her biri ilgili görevin testine eklenmiştir:

1. **Oturumsuz/banlı kullanıcı panel rotasında** → `/giris`'e yönlenir, panel iskeleti (sayaç sorguları dâhil) hiç çalışmaz. (Task 5, 9)
2. **Geçersiz/eksik `?durum=` veya `?sekme=` değeri, ve `?q=` içinde `<`, `%`, çok uzun girdi** → varsayılan sekmeye düşer, sorgu parametresi olduğu gibi filtrelenir, hata yok. (Task 3, 6)
3. **Sıfır ilan + sıfır talep olan yepyeni hesap** → dashboard iki boş durumu da doğru CTA ile gösterir; sidebar rozetleri sıfır için gizlenir ("0" görünmez). (Task 2, 5)
4. **Mobil genişlik (<640px)** → sidebar offcanvas'a döner, tablolar kart olarak okunur, yatay taşma olmaz. (Task 2, 6)
5. **Satır içi aksiyondan sonra aynı sayfada kalma** (onayla/reddet/iptal) → liste ve sayaçlar `router.refresh()` sonrası tutarlı; red gerekçesi satırda görünür. (Task 7, 11)

---

### Task 1: Panel rotalarında site chrome'unu kaldır

**Files:**
- Create: `src/components/ChromeGate.tsx`
- Modify: `src/app/layout.tsx:45-60`
- Modify: `src/app/admin/layout.tsx:33-36` (ofset sadeleşir)
- Test: `tests/components/ChromeGate.test.tsx`

**Interfaces:**
- Consumes: yok.
- Produces: `ChromeGate({ children }: { children: React.ReactNode })` — istemci bileşeni; `usePathname()` `/hesap` veya `/admin` ile başlıyorsa yalnız `{children}` render eder (header/footer/padding yok), aksi hâlde `SiteHeader` + `pt-20` sarmalayıcı + `SiteFooter`.
- Produces: `isPanelPath(pathname: string): boolean` (aynı dosyada export, saf; testte doğrudan çağrılır).

- [ ] **Step 1: Write the failing test**

`tests/components/ChromeGate.test.tsx` (`// @vitest-environment jsdom`):

```tsx
it("panel rotalarında site header/footer gizlenir", () => {
  mockPathname.mockReturnValue("/hesap/taleplerim");
  const { queryByTestId } = render(<ChromeGate><p>panel</p></ChromeGate>);
  expect(queryByTestId("site-header")).toBeNull();
  expect(queryByTestId("site-footer")).toBeNull();
  expect(queryByTestId("panel").textContent).toBe("panel");
});
it("panel olmayan rotalarda site header/footer görünür", () => { mockPathname.mockReturnValue("/arama"); /* site-header ve site-footer mevcut */ });
it("isPanelPath sınır durumları", () => {
  expect(isPanelPath("/hesap")).toBe(true);
  expect(isPanelPath("/admin/ilanlar")).toBe(true);
  expect(isPanelPath("/hesaplar")).toBe(false); // önek tuzağı
  expect(isPanelPath("/")).toBe(false);
});
```

Not: `SiteHeader`/`SiteFooter`'a `data-testid` eklemek gerekiyorsa Task 1 kapsamında ekle (üretim davranışı değişmez).
`SiteHeader` mevcut testleri (`tests/components/SiteHeader.test.tsx`) etkilenmemeli.

- [ ] **Step 2: Run test to verify it fails** — `npx vitest run tests/components/ChromeGate.test.tsx` → FAIL (modül yok).

- [ ] **Step 3: Implement** — `ChromeGate` istemci bileşeni; `isPanelPath` `pathname === "/hesap" || pathname.startsWith("/hesap/") || pathname === "/admin" || pathname.startsWith("/admin/")`. `src/app/layout.tsx`'te `SiteHeader`/`pt-20`/`SiteFooter` blokları `ChromeGate` içine alınır (children sunucu bileşeni olarak prop geçtiği için SSR korunur). `admin/layout.tsx`: `lg:top-20` → `lg:top-0`, `lg:h-[calc(100vh-5rem)]` → `lg:h-dvh`.

- [ ] **Step 4: Run tests** — ChromeGate + SiteHeader testleri PASS; `npm run check` 0 uyarı.

- [ ] **Step 5: Commit** — `feat(panel): hide site chrome on panel routes`

---

### Task 2: Panel primitives + navigasyon config'i

**Files:**
- Create: `src/components/panel/nav.ts`
- Create: `src/components/panel/PanelSidebar.tsx`
- Create: `src/components/panel/PanelTopbar.tsx`
- Create: `src/components/panel/PanelShell.tsx`
- Create: `src/components/panel/PageHeader.tsx`
- Create: `src/components/panel/StatCard.tsx`
- Create: `src/components/panel/PanelCard.tsx`
- Create: `src/components/panel/EmptyState.tsx`
- Test: `tests/lib/panel-nav.test.ts`, `tests/components/panel-sidebar.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type PanelNavItem = { href: string; label: string; icon: string; badge?: number; exact?: boolean };
  export type AccountCounts = { listings: number; pendingIncoming: number; unreadMessages: number };
  export type AdminCounts = { pendingListings: number; openReports: number };
  export function accountNavItems(counts: AccountCounts): PanelNavItem[]; // Tümü, İlanlarım, Taleplerim, Mesajlar, Değerlendirmeler, Profil + cta
  export function adminNavItems(counts: AdminCounts): PanelNavItem[];
  export function isPanelItemActive(pathname: string, item: PanelNavItem): boolean;
  export function navBadge(value: number): number | undefined; // 0 → undefined
  ```
- `accountNavItems` sırası sabit: Genel Bakış (`/hesap`, exact), İlanlarım (`/hesap/ilanlarim`, badge=listings), Taleplerim (`/hesap/taleplerim`, badge=pendingIncoming), Mesajlar (`/hesap/mesajlar`, badge=unreadMessages), Değerlendirmeler, Profil.
- `adminNavItems`: Genel Bakış (`/admin`, exact), İlanlar (`/admin/ilanlar`, badge=pendingListings), Kullanıcılar, Şikâyetler (`/admin/sikayetler`, badge=openReports), Ayarlar.
- `PanelShell({ items, cta, children })`: `cta?: { href: string; label: string }`; sidebar (masaüstü sabit, mobil offcanvas) + topbar + `<main>`.
- `PanelTopbar()`: panel içi arama kutusu YOK (bkz. Spec §7.4) — bildirim rozeti (mevcut SWR `unread-count`) + kullanıcı menüsü (`SiteHeader`'daki mevcut desen yeniden kullanılır).
- `PageHeader({ eyebrow?, title, description?, actions? })`, `StatCard({ label, value, hint?, icon, tone, href? })` (tone: `primary|accent|success|error|info`), `PanelCard({ title, action?, children })`, `EmptyState({ icon, title, description?, action? })`.

- [ ] **Step 1: Write failing tests** — `tests/lib/panel-nav.test.ts`: badge 0 → gizli; sıra ve yollar; `isPanelItemActive("/hesap/ilanlarim/yeni", İlanlarım) === true`, exact öğede `"/hesap/foo"` false. `tests/components/panel-sidebar.test.tsx`: aktif öğede `aria-current="page"`, rozetli öğede sayı metni, rozetsiz öğede sayı yok, offcanvas tetikleyicisinde `aria-expanded`.

- [ ] **Step 2: Run to fail** — `npx vitest run tests/lib/panel-nav.test.ts tests/components/panel-sidebar.test.tsx` → FAIL.

- [ ] **Step 3: Implement** — saf config + bileşenler. Mobil offcanvas: `PanelShell` içinde küçük bir istemci parçası (`"use client"`, `useState`) hamburger + sidebar; `aria-expanded`/`aria-controls`, Escape ile kapanır, rota değişiminde kapanır (`usePathname` efekti). Masaüstü: `lg:` sabit sidebar.

- [ ] **Step 4: Run tests** — PASS; `npm run check`.

- [ ] **Step 5: Commit** — `feat(panel): add shared panel shell and nav primitives`

---

### Task 3: Durum sekmeleri (StatusTabs) + query yardımcıları

**Files:**
- Create: `src/components/panel/tabs.ts`
- Create: `src/components/panel/StatusTabs.tsx`
- Test: `tests/lib/panel-tabs.test.ts`, `tests/components/status-tabs.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type TabOption = { value: string; label: string; count: number };
  export function parseTabValue(raw: string | string[] | undefined, allowed: readonly string[], fallback: string): string;
  export function tabHref(basePath: string, current: URLSearchParams | Record<string, string | undefined>, param: string, value: string): string;
  export function StatusTabs({ basePath, param, tabs, current }: { basePath: string; param: string; tabs: TabOption[]; current: string }): JSX.Element;
  ```
- `StatusTabs` bağlantı tabanlıdır (istemci durumu yok), aktif sekmede `aria-current="page"`, sayaç `tabular-nums`; varsayılan olmayan sekme linki `?param=value`, varsayılan sekme parametreyi düşürür.
- `tabHref` mevcut query'yi korur (yalnız ilgili parametreyi değiştirir), `q` gibi diğer parametreler korunur.

- [ ] **Step 1: Write failing tests** — geçersiz/eksik/çok değerli `durum` → fallback; `tabHref("/hesap/ilanlarim", {q:"ege", durum:"active"}, "durum", "paused")` → `/hesap/ilanlarim?q=ege&durum=paused`; varsayılan değer → `durum` düşer; aktif sekmede `aria-current`; sayaçlar.

- [ ] **Step 2: Run to fail** → FAIL.

- [ ] **Step 3: Implement** — saf yardımcılar + bileşen.

- [ ] **Step 4: Run tests** — PASS; `npm run check`.

- [ ] **Step 5: Commit** — `feat(panel): add counted status tabs`

---

### Task 4: Panel sayaç sorguları (sunucu)

**Files:**
- Create: `src/server/panel/counts.ts`
- Test: `tests/server/panel-counts.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export async function getAccountCounts(userId: string): Promise<AccountCounts>; // Prisma count: listings(ownerId), bekleyen GELEN talep, okunmamış mesaj
  export async function getAdminCounts(): Promise<AdminCounts>; // PENDING ilan, OPEN şikâyet
  ```
- Okunmamış mesaj sayımı: mevcut mesaj modeli/`unread-count` ucundaki kuralla **aynı** filtre (mesaj service'inde kullanılan kuralı oku ve birebir uygula).

- [ ] **Step 1: Write failing test** — DB destekli test (mevcut DB test kalıbı; `TEST_DATABASE_URL`): kullanıcı+ilan+bekleyen gelen talep+okunmamış mesaj kur → `getAccountCounts` beklenen sayıları döndürür; ilgisiz kayıtlar sayılmaz (başka sahibin talebi, okunmuş mesaj).

- [ ] **Step 2: Run to fail** → FAIL.

- [ ] **Step 3: Implement** — yalnız `count` sorguları; `Promise.all`.

- [ ] **Step 4: Run tests** — PASS; `npm run check`.

- [ ] **Step 5: Commit** — `feat(panel): add server-side panel counts`

---

### Task 5: `/hesap` layout + Genel Bakış

**Files:**
- Create: `src/app/hesap/layout.tsx`
- Create: `src/app/hesap/page.tsx`
- Test: `tests/app/hesap/dashboard.test.tsx`

**Interfaces:**
- Consumes: `requireUser` (`src/lib/auth.ts`, oturum yoksa `/giris`'e redirect), `getAccountCounts`, `accountNavItems`, `PanelShell`, `PageHeader`, `StatCard`, `PanelCard`, `EmptyState`.
- Produces: `/hesap` rotası (Genel Bakış). `metadata: { title: "Genel Bakış" }`.
- İçerik: stat kartları — Yayında ilan (`status ACTIVE`, ownerId=user), Bekleyen talep (gelen PENDING), Okunmamış mesaj, Ortalama puan (kullanıcının ilanlarına gelen yorumların ortalaması; yorum yoksa "—"). "Gelen talepler" `PanelCard` (en yeni 5, sekmeli değil; satır içi Onayla/Reddet mevcut `BookingActions` ile) — kullanıcının ilanı yoksa yerine `EmptyState` + "İlan ver" CTA. "Giden talepler" özeti (en yeni 3) her zaman görünür; boşsa CTA'lı `EmptyState`.

- [ ] **Step 1: Write failing test** — `tests/app/hesap/dashboard.test.tsx` (mevcut `tests/app/admin/page.test.tsx` kalıbını izle: prisma/auth mock'la): (a) oturumsuz → `redirect("/giris")` çağrılır; (b) yalnız ilanlı kullanıcıda "Gelen talepler" kartı ve stat değerleri; (c) yalnız kiracıda "İlan ver" boş durumu görünür ve "Giden talepler" satırları var; (d) sıfır veri → iki boş durum + sayfada "0" rozeti yok.

- [ ] **Step 2: Run to fail** → FAIL.

- [ ] **Step 3: Implement** — layout `requireUser()` + `getAccountCounts` + `PanelShell`; sayfa sorguları + JSX.

- [ ] **Step 4: Run tests** — PASS; `npm run check`.

- [ ] **Step 5: Commit** — `feat(hesap): add panel shell and overview dashboard`

---

### Task 6: `/hesap/ilanlarim` — durum sekmeleri + arama + tablo

**Files:**
- Modify: `src/app/hesap/ilanlarim/page.tsx` (mevcut kart listesi → sekme+tablo)
- Create: `src/app/hesap/ilanlarim/ListingTable.tsx`
- Test: `tests/app/hesap/ilanlarim.test.tsx`

**Interfaces:**
- Consumes: `PageHeader`, `StatusTabs`, `parseTabValue`, `tabHref`, `EmptyState`, mevcut `ListingActions`, `STATUS_LABELS`/`STATUS_BADGES` kalıbı (mevcut sayfadan taşınır).
- Produces: `ListingTable({ listings }: { listings: Listing[] })` — masaüstü `<table>` (başlık, şehir, fiyat, kapasite, durum, aksiyonlar, Geçmiş), mobilde kart. Sayfa `searchParams` okur: `durum` ∈ `all|DRAFT|PENDING|ACTIVE|PAUSED|REJECTED` (varsayılan `all`), `q` (başlıkta `contains`, `mode: "insensitive"`).
- Sekme sayaçları: durum başına `count` (kullanıcı kapsamlı, `q` uygulanmadan — sekmeler tüm durum dağılımını gösterir).

- [ ] **Step 1: Write failing tests** — (a) `durum=ACTIVE` → yalnız ACTIVE satırlar; (b) `durum=gecersiz` → `all` davranışı; (c) `q=ege` → yalnız başlıkta eşleşenler; (d) sayaçlar durum dağılımını gösterir; (e) boş sonuç → tek CTA'lı boş durum; (f) her satırın masaüstü tablo hücresi **ve** mobil kart sunumu aynı veriyi taşır (kart markup'ı DOM'da var).

- [ ] **Step 2: Run to fail** → FAIL.

- [ ] **Step 3: Implement** — sorgu `where`'i sekmeye ve `q`'ya göre kur; tablo + kart sunumu; "Yeni İlan" aksiyonu `PageHeader`'da.

- [ ] **Step 4: Run tests** — PASS; `npm run check`.

- [ ] **Step 5: Commit** — `feat(hesap): add status tabs and search to my listings`

---

### Task 7: `/hesap/taleplerim` — Gelen/Giden + durum sekmeleri + tablo

**Files:**
- Modify: `src/app/hesap/taleplerim/page.tsx`
- Test: `tests/app/hesap/taleplerim.test.tsx`

**Interfaces:**
- Consumes: `StatusTabs`, `parseTabValue`, `tabHref`, `EmptyState`, `PageHeader`, mevcut `BookingActions`.
- Produces: sayfa `searchParams` okur: `sekme` ∈ `incoming|outgoing` (varsayılan `incoming`) ve `durum` ∈ `all|PENDING|APPROVED|REJECTED|CANCELLED|COMPLETED` (varsayılan `all`). İçerik tek seferde **tek** liste render eder (iki bölüm aynı anda DEĞİL). Satır: ilan başlığı, kiracı adı (gelen) / ilan durumu (giden), tarih aralığı, kişi, tutar, durum rozeti, mesaj önizlemesi, aksiyonlar (`decide`/`cancel` mevcut mod). Giden'de reddedilen kayıtta red gerekçesi satır altında görünür.

- [ ] **Step 1: Write failing tests** — (a) varsayılan `incoming` listesi ve sayaçlı sekmeler; (b) `sekme=outgoing&durum=REJECTED` → yalnız reddedilen gidenler + gerekçe metni; (c) her iki liste aynı anda DOM'da değil; (d) boş durumlarda ilgili CTA (gelen: yok, giden: "Karavan Ara").

- [ ] **Step 2: Run to fail** → FAIL.

- [ ] **Step 3: Implement** — iki sorgu yerine seçili sekmeye göre tek sorgu + durum sayacı sorguları; tablo/kart sunumu. Aksiyonlar mevcut `BookingActions` (server action + `router.refresh()` kalıbı) — onay/red/iptalden sonra liste satırı ve sayaçlar aynı sayfada tazelenir; reddedilen kayıtta gerekçe satır altında kalır.

- [ ] **Step 4: Run tests** — PASS; `npm run check`.

- [ ] **Step 5: Commit** — `feat(hesap): tabbed requests list with status filters`

---

### Task 8: Hesap sayfalarını kabuğa taşı, `AccountNav`'ı kaldır

**Files:**
- Modify: `src/app/hesap/mesajlar/page.tsx`, `src/app/hesap/mesajlar/[id]/page.tsx`, `src/app/hesap/degerlendirmeler/page.tsx`, `src/app/hesap/profil/page.tsx`, `src/app/hesap/ilanlarim/yeni/page.tsx`, `src/app/hesap/ilanlarim/[id]/gecmis/page.tsx`
- Delete: `src/components/AccountNav.tsx`, `tests/components/AccountNav.test.tsx`
- Modify (tests): `tests/app/hesap/*` mevcut testler (AccountNav iddiaları → shell/nav iddiaları)

**Interfaces:**
- Consumes: `PageHeader`; kabuk artık `layout`'ta olduğu için sayfalar yalnız içerik render eder.
- Produces: Bu sayfalar `max-w-3xl` sarmalayıcısını ve `AccountNav` çağrısını bırakır; başlıklar `PageHeader`'a taşınır. İş mantığı/işlevsellik değişmez.

- [ ] **Step 1: Write/adjust failing tests** — mevcut hesap sayfa testlerinde `AccountNav` referansları kaldırılır; her sayfa için "PageHeader başlığı görünür" iddiası eklenir (biri kırmızı olacak şekilde önce güncelle).

- [ ] **Step 2: Run to fail** → FAIL.

- [ ] **Step 3: Implement** — sayfaları sadeleştir; `AccountNav` + testini sil; `grep -r AccountNav src tests` boş kalmalı.

- [ ] **Step 4: Run tests** — PASS; `npm run check`.

- [ ] **Step 5: Commit** — `refactor(hesap): move account pages into the panel shell`

---

### Task 9: Admin kabuğu + widget'lı dashboard

**Files:**
- Modify: `src/app/admin/layout.tsx` (AdminNav yerine `PanelShell`)
- Delete: `src/app/admin/AdminNav.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `tests/app/admin/page.test.tsx`
- Test: `tests/app/admin/layout.test.tsx` (yeni)

**Interfaces:**
- Consumes: `requireAdmin`, `getAdminCounts`, `adminNavItems`, `PanelShell`, `PageHeader`, `StatCard`, `PanelCard`.
- Produces: Admin dashboard'u: 4 `StatCard` + "Moderasyon kuyruğu" (en yeni 3 PENDING ilan, "İncele" → `/admin/ilanlar/[id]`) + "Son aktivite" (son 4 olay: yeni ilan başvurusu, açılan şikâyet, yeni kullanıcı, onaylanan ilan — mevcut tablolardan `createdAt`/`updatedAt` ile türetilir, yeni alan yok) + "Şikâyet kuyruğu" (en yeni 2 OPEN şikâyet).
- `tests/app/admin/page.test.tsx`'teki "tam 4 `a.card`" iddiası, yeni yapıya göre güncellenir (stat kartları + widget başlıkları).

- [ ] **Step 1: Write failing tests** — layout: ADMIN olmayan → `/`'e redirect; dashboard: 4 stat değeri, kuyruk satırı `/admin/ilanlar/[id]` linki, aktivite ve şikâyet widget başlıkları.

- [ ] **Step 2: Run to fail** → FAIL.

- [ ] **Step 3: Implement** — layout'u `PanelShell`'e geçir; dashboard widget'larını ekle; `AdminNav` sil (`grep -r AdminNav src tests` boş).

- [ ] **Step 4: Run tests** — PASS; `npm run check`.

- [ ] **Step 5: Commit** — `feat(admin): panel shell and widget dashboard`

---

### Task 10: Admin listelerinde sekmeler + arama

**Files:**
- Modify: `src/app/admin/ilanlar/page.tsx` (dört bölüm → sekmeli tek liste; `take: 50` sınırı kalkar)
- Modify: `src/app/admin/kullanicilar/page.tsx`
- Modify: `src/app/admin/sikayetler/page.tsx`
- Test: `tests/app/admin/ilanlar.test.tsx`, `tests/app/admin/kullanicilar.test.tsx`, `tests/app/admin/sikayetler.test.tsx`

**Interfaces:**
- Consumes: `StatusTabs`, `parseTabValue`, `tabHref`, `PageHeader`, `EmptyState`.
- Produces:
  - İlanlar: `durum` ∈ `PENDING|ACTIVE|PAUSED|REJECTED` (varsayılan `PENDING`), `q` (başlık, insensitive). Sekme sayaçları `count`.
  - Kullanıcılar: `durum` ∈ `all|active|banned` (varsayılan `all`), `q` (ad veya e-posta, insensitive). Rol/ban rozetleri kolonda korunur.
  - Şikâyetler: `durum` ∈ `OPEN|REVIEWING|CLOSED` (varsayılan `OPEN`), `q` (hedef/başlık, insensitive; mevcut alanlarla sınırlı).

- [ ] **Step 1: Write failing tests** — her sayfa için: varsayılan sekme, geçersiz `durum` → varsayılan, `q` filtresi, sekme sayaçları, boş durum CTA'sı.

- [ ] **Step 2: Run to fail** → FAIL.

- [ ] **Step 3: Implement** — sorgular sekmeye + `q`'ya göre; sayaçlar ayrı `count`; mevcut aksiyonlar (`AdminListingActions`) korunur.

- [ ] **Step 4: Run tests** — PASS; `npm run check`.

- [ ] **Step 5: Commit** — `feat(admin): tabs and search for admin lists`

---

### Task 11: E2E — sözleşme güncellemeleri + panel senaryosu

**Files:**
- Modify: `tests/e2e/scenario-1-renter-booking-request.spec.ts`, `tests/e2e/scenario-2-owner-approval.spec.ts`, `tests/e2e/scenario-3-admin-listing-approval.spec.ts`
- Create: `tests/e2e/scenario-6-panel.spec.ts`
- Modify (gerekirse): `tests/e2e/helpers/ui.ts` (yeni yardımcılar: sekme seç, arama doldur)

**Interfaces:**
- Consumes: mevcut `login`, `settle`, `waitForHydration`, seed fixture'ları.
- Produces: `scenario-6-panel.spec.ts` — sahip girişi → `/hesap` Genel Bakış'ta stat kartları ve "Gelen talepler" görünür → Taleplerim → `sekme=incoming&durum=PENDING` derin linki → satır içi "Onayla" → durum rozeti "Onaylandı" olur; ayrıca `/hesap/ilanlarim?durum=ACTIVE` linkinin doğrudan o sekmeyi açtığı doğrulanır.
- Senaryo 1/2: `Giden Taleplerim` başlığına bağlı iddialar, yeni `sekme=outgoing` görünümüne göre güncellenir (akış korunur: talep gönderir → listede "Bekliyor" görür). Senaryo 2: onay akışı satır içi aksiyonla aynı kalır. Senaryo 3: `/admin/ilanlar` varsayılan `PENDING` sekmesinde kuyruk satırını görür.

- [ ] **Step 1: Spec'leri yeni DOM sözleşmesine göre güncelle (önce kırmızı)** — `node node_modules/@playwright/test/cli.js test --config tests/e2e/playwright.config.ts` → ilgili senaryolar FAIL.

- [ ] **Step 2: Yardımcıları ekle ve testleri yeşile getir** — `npx … scenario-1/2/3` PASS.

- [ ] **Step 3: Yeni senaryoyu ekle** — `scenario-6` PASS (tam süit: 6 senaryo).

- [ ] **Step 4: Tam e2e + `npm run check`** — tam süit PASS; check 0 uyarı.

- [ ] **Step 5: Commit** — `test(e2e): panel scenario and updated DOM contracts`

---

### Task 12: PR ve kapanış

**Files:**
- Modify: `README.md` (panel/hesap gezinme bölümü kısaca güncellenir), `docs/superpowers/specs/2026-10-12-yonetim-panelleri-design.md` (durum satırı: uygulandı)

- [ ] **Step 1:** `npm run check` + `npm run build` yeşil; tam e2e yeşil.
- [ ] **Step 2:** Branch: `feature/panels-redesign` (`feature/karavan-mvp` tabanlı). `git push -u origin feature/panels-redesign`.
- [ ] **Step 3:** PR aç (base `feature/karavan-mvp`) — başlık: "Panel redesign: shared shell, dashboards, counted tabs". PR'ı `session.link` ile oturuma bağla.
- [ ] **Step 4:** CI check run'ları yeşile dönene kadar izle; kırmızıysa kök nedeni düzelt (e2e dahil).

---

## Notlar

- **Başlamadan önce:** e2e süitinin yeşil olduğu doğrulanmalı (bu çalışmada ilan detay form kapısı + `Değerlendirmeler` bölüm adı düzeltildi; yerelde 5/5 geçti). Yerelde koşarken `npx playwright` sarmalayıcısı takılabilir — `node node_modules/@playwright/test/cli.js test --config tests/e2e/playwright.config.ts` kullan.
- Sıra bağımlılığı: Task 1 → 2 → (3, 4 paralel) → 5 → (6, 7 paralel) → 8 → 9 → 10 → 11 → 12. Task 2 ve 3 bağımsız değil (StatusTabs, PanelShell'in stillerini paylaşır) — 3'ü 2'den sonra başlat.
- Task 4 olmadan 5/9 sayaçları boş kalır; 4 erken bitmeli.
- Her görev kendi commit'i; görev arası `npm run check`.
