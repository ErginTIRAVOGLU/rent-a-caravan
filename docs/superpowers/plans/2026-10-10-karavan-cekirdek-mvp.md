# Karavan Pazar Yeri — Çekirdek MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Karavan kiralama pazar yerinin çalışır çekirdeğini kurmak: üyelik, ilan CRUD + fotoğraf, tarihli arama, rezervasyon talebi/onom/çakışma koruması, admin moderasyonu, e-posta bildirimleri, seed ve test altyapısı.

**Architecture:** Tek Next.js (App Router) monoliti. Mutasyonlar server actions, UploadThing/cron için route handler. `src/app/` altında **Türkçe URL segmentleri** (spec Bölüm 2), iş mantığı `src/server/<domain>/service.ts` (test edilen çekirdek, explicit `user` parametresi) + `actions.ts` (Auth.js oturumuyla saran ince sarmalayıcı). Sosyal katman (mesajlaşma, değerlendirme, şikayet) **bu planda yok** — Plan 2.

**Tech Stack:** Next.js 15 (App Router, src/) · TypeScript strict · Tailwind v4 · Prisma + PostgreSQL · Auth.js v5 (Google + credentials) · Zod · Resend · UploadThing · SWR · Vitest

**Spec:** `docs/superpowers/specs/2026-10-10-karavan-kiralama-design.md` (plan argümanları bundan türetilir; uygulayan okur)

## Global Constraints

- Arayüz metinleri **yalnızca Türkçe**; DB tablo/kolon/enum adları **yalnızca İngilizce**.
- Platform ödeme paraya dokunmaz: rezervasyon = talep; hiçbir ödeme kodu yazılmaz.
- Kapsam: web (responsive) + bu plan; mesajlaşma/değerlendirme/şikâyet/harita/i18n/ödeme **yok**.
- Stack zorunlu: Next.js App Router, TS strict, Tailwind, Prisma+PostgreSQL, Auth.js v5, Zod, Resend, UploadThing, Vitest. Node >= 20.
- Enum'lar (spec §3): `Listing.status: DRAFT|PENDING|ACTIVE|REJECTED|PAUSED`, `BookingRequest.status: PENDING|APPROVED|REJECTED|CANCELLED|COMPLETED`, `vehicleType: TOWED_CARAVAN|PANELVAN|MOTORHOME`, `transmission: MANUAL|SEMI_AUTOMATIC|AUTOMATIC`, `fuel: DIESEL|PETROL|ELECTRIC|HYBRID`, `licenseRequired: B|BE|C1|C`.
- Amenities sabit katalog: spec §3.1 (17 anahtar + Türkçe etiketler) — DB'de `string[]`, katalog `src/lib/amenities.ts` sabit kodu.
- Tarihler `YYYY-MM-DD` string taşınır, DB'de `DateTime @db.Date`; gece = gün farkı (UTC gece yarısı bazlı).
- Tarih kuralları: `startDate >= bugün`, `endDate > startDate`, en fazla 30 gece, `>= listing.minRentalDays`, `guests <= listing.capacity`.
- `totalPrice` **yalnızca sunucuda** hesaplanır (`nights × nightlyPrice`, Decimal); istemciden gelen `totalPrice/ownerId/status/role` alanları okunmaz.
- `MAX_PHOTOS = 10`, dosya başına 5 MB, jpg/png/webp; `submitListing` için en az 1 foto zorunlu.
- E-posta: `EmailClient` arayüzü + Resend; gönderim hatası asla ana akışı düşürmez.
- Seed: 2 ilan, 3 kullanıcı + 1 admin; demo şifre `demo1234`.
- Test DB: `TEST_DATABASE_URL` (dev `DATABASE_URL`'den ayrı DB); global setup `prisma migrate deploy` yapar, `resetDb()` testler arası truncate.
- Domain konvansiyonu: `service.ts` (çekirdek + test) / `actions.ts` (sarmalayıcı). Ortak tip: `ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; field?: string }` (`src/lib/result.ts` → `ok()`, `fail()`).
- Her task bittiğinde `npm run check` (= `tsc --noEmit && eslint . && vitest run`) yeşil ve commit atılmış olmalı.

## Review Focus

Spec'in sessiz kaldığı, bir kullanıcıyı ilk delivereda ısıtacak 5 girdi/hata sınıfı — her satırın testi ilgili task'ta:

1. **Paralel onay yarışı** — iki farklı kiracının aynı tarih aralığı için onaylanması: yalnızca biri `APPROVED` olur, diğeri "Bu tarihler artık dolu" hatası alır, DB'de tek `APPROVED` kalır → Task 9, `approveBooking paralel yarışta tek kazanan` testi.
2. **Bitişik konaklamalar** — bir kiracının çıkış günü (endDate) diğerinin giriş günü (startDate) ise **çakışma sayılmamalı**; iki konaklama da `APPROVED` olabilmeli → Task 9, `bitişik tarihler çakışma sayılmaz` testi (sınır: `startDate < end AND endDate > start`).
3. **Yetkisiz erişim** — kiracı başkasının ilanını siler, sahip olmayan talep onaylar, `role=USER` admin action'ı çağırır → hepsi kontrollü `403` hatası, veri değişmez → Task 6, 9, 10 yetki matris testleri.
4. **İstemci sahtekârlığı** — `createBookingRequest` payload'ında `totalPrice: 1`, `status: "APPROVED"`, `ownerId: başkaId` gönderilirse yok sayılır; DB'ye sunucu değerleri yazılır → Task 9, `istemciden gelen totalPrice/status yok sayılır` testi.
5. **Harici servis arızası** — Resend API hata fırlatırsa talep/onay akışı yine tamamlanır; UploadThing'siz (fotoğrafsız) form durumu bozulmaz → Task 5 `email gönderimi başarısız olsa da action ok döner` testi; Task 7 `validatePhotoFiles` hata yolları.

---

## Dosya Yapısı (bu plan boyunca oluşacak)

```
src/
├── app/
│   ├── layout.tsx, page.tsx, globals.css, error.tsx, not-found.tsx, loading.tsx
│   ├── giris/, kayit/                     — auth sayfaları
│   ├── arama/                             — arama sonuçları
│   ├── ilan/[id]/                         — ilan detayı + talep formu
│   ├── hesap/{ilanlarim,taleplerim,profil}/
│   ├── admin/{ilanlar,kullanicilar}/      — admin layout + gate
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── uploadthing/route.ts
│       └── cron/complete-bookings/route.ts
├── components/                            — UI prims + ListingCard, PhotoUploader, ListingForm
├── lib/
│   ├── prisma.ts, result.ts, auth.ts
│   ├── pricing.ts, stay.ts, availability.ts, rate-limit.ts, amenities.ts
│   ├── validators/{auth,listing,booking}.ts
│   └── email/{client,events,templates}.ts
├── server/
│   ├── users/{service,actions}.ts
│   ├── listings/{service,actions,search}.ts
│   ├── bookings/{service,actions}.ts
│   └── admin/{service,actions}.ts
prisma/{schema.prisma, seed.ts}
tests/{helpers/db.ts, *.test.ts}
```

---

### Task 1: Proje iskeleti ve araçlar

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/{layout.tsx,page.tsx,globals.css}`, `src/lib/{prisma.ts,result.ts}`
- Test: `tests/result.test.ts`

**Interfaces:**
- Produces: `ActionResult<T>`, `ok<T>(data: T): ActionResult<T>`, `fail<T>(error: string, field?: string): ActionResult<T>`, `prisma: PrismaClient`.

- [ ] **Step 1: Next.js 15 iskeletini kur**

`npx create-next-app@latest . --ts --app --src-dir --eslint --tailwind --no-import-alias` (mevcut `docs/` ve `.git/` korunur). Ek bağımlılıklar: `prisma @prisma/client zod next-auth@^5 bcryptjs swr resend @uploadthing/react uploadthing` + dev: `vitest @vitejs/plugin-react typescript-eslint`.

- [ ] **Step 2: Paylaşılan tipleri yaz (test öncesi)**

`src/lib/result.ts`: `ActionResult<T>` union tipi, `ok`, `fail`. `src/lib/prisma.ts`: `globalThis` üzerinde PrismaClient singleton export.

- [ ] **Step 3: Yazma testi — `tests/result.test.ts`**

```ts
it("ok() ok:true ve data döner", () => { expect(ok(5)).toEqual({ ok: true, data: 5 }) })
it("fail() ok:false, error ve field taşır", () => { expect(fail("Geçersiz", "email")).toEqual({ ok: false, error: "Geçersiz", field: "email" }) })
```

- [ ] **Step 4: Testin başarısız olduğunu doğrula**

Run: `npx vitest run tests/result.test.ts` → Expected: FAIL (`ok is not a function`).

- [ ] **Step 5: `result.ts` implemente et, testi geçir, `npm run check` yeşillendir**

Run: `npm run check` → Expected: tsc, eslint, vitest hepsi PASS.

- [ ] **Step 6: `.env.example` yaz ve commit et**

`DATABASE_URL`, `TEST_DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `RESEND_API_KEY`, `UPLOADTHING_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`. Commit: `feat: next.js iskeleti, result tipi, test altyapısı`.

---

### Task 2: Veri modeli, migration ve seed

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`, `tests/helpers/db.ts`, `tests/seed.test.ts`
- Modify: `.env.example` (gerekirse), `package.json` (`prisma.seed` script, `vitest.globalSetup`)

**Interfaces:**
- Produces (Prisma client metotları — sonraki tüm task'lar bunları kullanır): `prisma.user`, `prisma.listing`, `prisma.bookingRequest`, `prisma.conversation`, `prisma.message`, `prisma.review`, `prisma.report`, `prisma.rateLimitEntry`.
- Produces (test yardımcıları): `resetDb(): Promise<void>`, `makeUser(overrides?)`, `makeListing(ownerId, overrides?)` — `tests/helpers/db.ts`.

- [ ] **Step 1: Şemayı spec §3'ten yaz**

Tüm modeller, enum'lar (İngilizce adlarla), relation'lar ve indeksler (`Listing(city, status)`, `BookingRequest(listingId, status, startDate, endDate)`, `Message(conversationId, createdAt)`). Ek: `RateLimitEntry { key String, bucket String, count Int, expiresAt DateTime }` with `@@unique([key, bucket])` (spec §5 "DB sayaçlı" hız sınırı için). Kalan tarih alanları `DateTime @db.Date`.

- [ ] **Step 2: Validate + migration**

Run: `npx prisma validate && npx prisma migrate dev --name init` → Expected: "Database schema in sync".

- [ ] **Step 3: Test yardımcılarını yaz — `tests/helpers/db.ts`**

`resetDb()` tüm tabloları TRUNCATE CASCADE; `makeUser`/`makeListing` fabrika fonksiyonları (varsayılanlar: `nightlyPrice: 1500`, `capacity: 4`, `vehicleType: "PANELVAN"`, `status: "ACTIVE"`).

- [ ] **Step 4: Seed testini yaz (yazma adımı)**

`tests/seed.test.ts`:
```ts
it("seed: 4 kullanıcı (1 admin), 2 ACTIVE + 1 PENDING ilan oluşturur", async () => {
  await resetDb(); await seed();
  expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(1);
  expect(await prisma.listing.count({ where: { status: "ACTIVE" } })).toBe(2);
  expect(await prisma.listing.count({ where: { status: "PENDING" } })).toBe(1);
});
it("seed kullanıcıları demo1234 ile giriş yapabilir (hashlenmiş)", ...)
```

- [ ] **Step 5: Testin başarısız olduğunu doğrula**

Run: `npx vitest run tests/seed.test.ts` → Expected: FAIL (fonksiyon yok).

- [ ] **Step 6: `prisma/seed.ts` implemente et, testi geçir**

Kullanıcılar: `admin@karavan.test` (ADMIN), `sahip@karavan.test`, `ikinci-sahip@karavan.test`, `kiraci@karavan.test` — hepsi `demo1234`. İlanlar: sahip 2 (ACTIVE), ikinci sahip 1 (PENDING); ilanlar Türkçe içerikli, farklı şehirlerde (Antalya, İzmir, Bolu).

- [ ] **Step 7: `npm run check` + commit**

Commit: `feat: prisma veri modeli, migration, seed ve test db yardımcısı`.

---

### Task 3: Kimlik doğrulama (Auth.js v5)

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/validators/auth.ts`, `src/server/users/{service,actions}.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`, `src/app/giris/page.tsx`, `src/app/kayit/page.tsx`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `prisma`, `ActionResult/ok/fail` (Task 1), `resetDb/makeUser` (Task 2).
- Produces:
  - `auth()`, `handlers`, `signIn`, `signOut` (Auth.js)
  - `type SessionUser = { id: string; name: string; email: string; role: "USER" | "ADMIN"; isBanned: boolean }`
  - `getSessionUser(): Promise<SessionUser | null>`
  - `requireUser(): Promise<SessionUser>` — oturum yoksa `/giris`'e redirect
  - `requireAdmin(): Promise<SessionUser>` — `role !== "ADMIN"` ise `/`'e redirect
  - `verifyCredentials(email: string, password: string): Promise<SessionUser | null>` (test edilen çekirdek: invalid/banned → null)
  - `registerUser(input): Promise<ActionResult<SessionUser>>` (service) / `registerAction` (actions)

- [ ] **Step 1: Testleri yaz — `tests/auth.test.ts`**

```ts
it("geçerli e-posta + doğru şifre ile kullanıcı döner", ...)           // seed kullanıcı, bcrypt karşılaştırma
it("yanlış şifre null döner", ...)
it("isBanned=true kullanıcı null döner (giriş engeli)", ...)
it("aynı e-posta ile ikinci kayıt fail döner, field=email", ...)
it("registerUser şifreyi hash'ler (DB'de düz metin yok)", ...)
```

- [ ] **Step 2: Testleri çalıştır, hepsinin FAIL olduğunu doğrula**

Run: `npx vitest run tests/auth.test.ts` → Expected: FAIL (import yok).

- [ ] **Step 3: Implemente et**

`validators/auth.ts` (Zod: email formatı, şifre >= 8 karakter, Türkçe hata mesajları) → `users/service.ts` (`registerUser`, `verifyCredentials`: bcrypt compare + ban kontrolü) → `lib/auth.ts` (Auth.js v5 config: Google provider + Credentials, `authorize` `verifyCredentials`'i çağırır, JWT session'da `id/role` tutulur) → route handler → `middleware.ts` (matcher: `/hesap/:path*`, `/admin/:path*`).

- [ ] **Step 4: Testleri geçir**

Run: `npx vitest run tests/auth.test.ts` → Expected: PASS (5/5).

- [ ] **Step 5: Sayfaları yaz ve doğrula**

`/giris` (e-posta+şifre, Google butonu, hata mesajı alanı), `/kayit` (ad, e-posta, şifre) — Türkçe, mobil uyumlu. `requireUser()`'i sahip sayfası örneğinde bir kez kullanarak davranışını elle doğrula (girişsiz `/hesap/ilanlarim` → `/giris`).

- [ ] **Step 6: `npm run check` + commit**

Commit: `feat: üyelik, giriş (google + e-posta/şifre), ban kontrolü, middleware`.

---

### Task 4: Fiyat ve tarih kuralları (saf mantık)

**Files:**
- Create: `src/lib/pricing.ts`, `src/lib/stay.ts`, `src/lib/validators/booking.ts`
- Test: `tests/pricing.test.ts`, `tests/stay.test.ts`

**Interfaces:**
- Produces:
  - `calculateNights(startDate: string, endDate: string): number` — UTC gece yarısı gün farkı
  - `calculateTotalPrice(nights: number, nightlyPrice: Prisma.Decimal): Prisma.Decimal`
  - `staySchema` (Zod: `startDate`, `endDate` `YYYY-MM-DD`, `guests: 1..16`, `message?`)
  - `type StayRules = { minRentalDays: number; capacity: number }`
  - `type StayQuote = { nights: number; totalPrice: Prisma.Decimal }`
  - `validateStay(rules: StayRules, input: StayInput, nightlyPrice: Prisma.Decimal, today?: string): ActionResult<StayQuote>`

- [ ] **Step 1: Testleri yaz**

`tests/pricing.test.ts`:
```ts
it("10-10 → 11-10 = 1 gece", () => expect(calculateNights("2026-10-10","2026-10-11")).toBe(1))
it("30 gece hesaplanır", () => expect(calculateNights("2026-10-01","2026-10-31")).toBe(30))
it("totalPrice = nights × nightlyPrice (Decimal)", ...) // 3 × 1500 = 4500
```
`tests/stay.test.ts`:
```ts
it("endDate bugün veya geçmiş → hata", ...)             // today="2026-10-10"
it("startDate = bugün kabul edilir", ...)
it("31 gece → 'en fazla 30 gece' hatası", ...)
it("minRentalDays=3 iken 2 gece → hata; 3 gece tamam", ...)
it("guests=5, capacity=4 → hata; 4 → tamam", ...)      // sınır değerleri
it("geçersiz format (2026-13-40) → field=startDate hatası", ...)
```

- [ ] **Step 2: Testleri FAIL doğrula** → Run: `npx vitest run tests/pricing.test.ts tests/stay.test.ts`

- [ ] **Step 3: Implemente et**

`pricing.ts` saf fonksiyonlar; `stay.ts` `validateStay` (spec Bölüm 5 tarih kuralları sırasıyla uygulanır, ilk hatada `fail(msg, field)`).

- [ ] **Step 4: Testleri PASS doğrula** → Run: `npx vitest run tests/pricing.test.ts tests/stay.test.ts`

- [ ] **Step 5: `npm run check` + commit** — `feat: fiyat hesabı ve konaklama kuralı doğrulaması`.

---

### Task 5: E-posta altyapısı (Resend, Türkçe şablonlar)

**Files:**
- Create: `src/lib/email/client.ts`, `src/lib/email/templates.ts`, `src/lib/email/events.ts`
- Test: `tests/email.test.ts`

**Interfaces:**
- Consumes: `prisma` tipleri (`BookingRequest`, `Listing` ile include'lar).
- Produces:
  - `interface EmailClient { send(msg: { to: string; subject: string; html: string }): Promise<void> }`
  - `resendClient: EmailClient` (RESEND_API_KEY yoksa log+yok say)
  - `sendBookingRequested(to: string, data: { renterName; listingTitle; startDate; endDate }, client?: EmailClient): Promise<void>`
  - `sendBookingStatusChanged(to: string, data: { listingTitle; startDate; endDate; status: "APPROVED" | "REJECTED"; reason? }, client?: EmailClient): Promise<void>`
  - `sendListingStatusChanged(to: string, data: { listingTitle; status: "ACTIVE" | "REJECTED" | "PAUSED"; reason? }, client?: EmailClient): Promise<void>`

- [ ] **Step 1: Testleri yaz — `tests/email.test.ts`** (mock client `send`'i yakalar)

```ts
it("talep olayı: kiracıya 'Karavan talebiniz alındı' konulu mail atar", ...)
it("onay olayı: 'Talebiniz onaylandı' + tarihler body'de görünür", ...)
it("red olayı gerekçeyi body'ye yazar", ...)
it("client.send hata fırlatırsa fonksiyon yine de çözülür (reject etmez)", ...)
it("şablonlar Türkçe karakterleri bozmaz (ç, ğ, ı)", ...)
```

- [ ] **Step 2: FAIL doğrula** → `npx vitest run tests/email.test.ts`

- [ ] **Step 3: Implemente et** — `templates.ts` (basit HTML gövde: başlık, satır satır bilgi, Türkçe), `events.ts` (event fonksiyonları `try/catch` + `console.error`, `client` parametresi default `resendClient`).

- [ ] **Step 4: PASS doğrula** → `npx vitest run tests/email.test.ts`

- [ ] **Step 5: `npm run check` + commit** — `feat: resend e-posta altyapısı ve türkçe şablonlar`.

---

### Task 6: İlan CRUD (Zod + status + yetki)

**Files:**
- Create: `src/lib/validators/listing.ts`, `src/lib/amenities.ts`, `src/server/listings/{service,actions}.ts`, `src/app/hesap/ilanlarim/{page.tsx,yeni/page.tsx}`, `src/components/ListingForm.tsx`
- Test: `tests/listing-schema.test.ts`, `tests/listing-authz.test.ts`

**Interfaces:**
- Consumes: `ActionResult`, `SessionUser/requireUser` (T3), `resetDb/makeUser/makeListing` (T2), amenities kataloğu (spec §3.1).
- Produces:
  - `AMENITIES: ReadonlyArray<{ key: string; label: string }>` (17 kayıt, Türkçe etiketler)
  - `listingSchema` (Zod — tüm Listing alanları; `nightlyPrice > 0`, `capacity 1..16`, `minRentalDays 1..30`, `photoUrls <= 10`, enum'lar İngilizce)
  - `createListingCore(user: SessionUser, data): Promise<ActionResult<Listing>>` — her zaman `DRAFT`, `ownerId = user.id`
  - `updateListingCore(user, id, data)`, `deleteListingCore(user, id)`, `submitListingCore(user, id)` (`DRAFT|REJECTED → PENDING`, en az 1 foto)
  - `actions.ts`: `createListing/updateListing/deleteListing/submitListing` — `requireUser()` ile sarar.

- [ ] **Step 1: Şema testlerini yaz — `tests/listing-schema.test.ts`**

Geçerli tam kayıt → parse ok; `nightlyPrice: 0` → hata; `capacity: 17` → hata; `vehicleType: "KAMYON"` → hata; `photoUrls` 11 dosya → hata; `vehicleType: "TOWED_CARAVAN"` → ok (enum İngilizce).

- [ ] **Step 2: Yetki testlerini yaz — `tests/listing-authz.test.ts`**

```ts
it("createListingCore owner=user.id ve status=DRAFT yazarResult", ...)  // payload'da status: "ACTIVE" gelse bile
it("başkasının ilanını update/delete eden kullanıcı fail (403) alır, ilan değişmez", ...)
it("kendi ilanını güncelleyebilir", ...)
it("submitListing PENDING yapar; REJECTED ilan tekrar gönderilebilir", ...)
it("fotoğrafsız submit fail", ...)
```

- [ ] **Step 3: FAIL doğrula** → `npx vitest run tests/listing-*.test.ts`

- [ ] **Step 4: Implemente et** — `amenities.ts`, `validators/listing.ts`, `listings/service.ts` (yetki: `if (listing.ownerId !== user.id) return fail("Bu işlem için yetkiniz yok")`), `actions.ts`.

- [ ] **Step 5: PASS doğrula** → `npx vitest run tests/listing-*.test.ts`

- [ ] **Step 6: Form sayfalarını yaz**

`/hesap/ilanlarim` (kullanıcının ilanları + durum rozetleri TR), `/hesap/ilanlarim/yeni` — çok adımlı: 1) bilgiler 2) fotoğraflar (T7 bağlanacak) 3) önizleme + gönder. Adımlar `ListingForm` içinde state ile; gönderim `submitListing`.

- [ ] **Step 7: `npm run check` + commit** — `feat: ilan crud, zod şeması, yetki ve durum akışı`.

---

### Task 7: Fotoğraf yükleme (UploadThing)

**Files:**
- Create: `src/app/api/uploadthing/route.ts`, `src/lib/upload.ts`, `src/components/PhotoUploader.tsx`
- Modify: `src/app/hesap/ilanlarim/yeni/page.tsx` (fotoğraf adımına bağla)
- Test: `tests/upload.test.ts`

**Interfaces:**
- Consumes: `auth()` (T3), `AMENITIES`/form state (T6).
- Produces:
  - `MAX_PHOTOS = 10`, `MAX_FILE_BYTES = 5 * 1024 * 1024`, `ALLOWED_TYPES = ["image/jpeg","image/png","image/webp"]`
  - `validatePhotoFiles(files: { name: string; size: number; type: string }[], existingCount: number): ActionResult<true>` (saf, test edilir)
  - UploadThing route: `auth()` yoksa 401; `onBeforeUpload` `validatePhotoFiles` ile.

- [ ] **Step 1: Testi yaz — `tests/upload.test.ts`**

11. dosya → fail; `type: "image/gif"` → fail; 6 MB → fail; `existingCount: 9` + 2 dosya → fail; 3 geçerli dosya → ok.

- [ ] **Step 2: FAIL doğrula** → `npx vitest run tests/upload.test.ts`

- [ ] **Step 3: Implemente et** — `upload.ts` saf doğrulama; UploadThing `ourFileRouter` (imageGenerator, `maxFileCount: MAX_PHOTOS`, 5 MB, içerik tipi filtresi) + route handler.

- [ ] **Step 4: PASS doğrula** → `npx vitest run tests/upload.test.ts`

- [ ] **Step 5: `PhotoUploader` bileşenini yaz ve bağla**

Çoklu dosya seçimi, önizleme, silme, hata mesajları (TR), `photoUrls` state'ini form adımına yazar. Elle doğrula: `npm run dev` ile 3 dosya yükle/sil, 11. dosyada hata gör.

- [ ] **Step 6: `npm run check` + commit** — `feat: uploadthing fotoğraf yükleme ve doğrulama`.

---

### Task 8: Arama ve ilan detayı

**Files:**
- Create: `src/server/listings/search.ts`, `src/app/arama/page.tsx`, `src/app/ilan/[id]/page.tsx`, `src/components/{ListingCard,SearchFilters,PhotoGallery}.tsx`
- Test: `tests/search.test.ts`

**Interfaces:**
- Consumes: `prisma`, `AMENITIES` (TR etiketler), `calculateNights/calculateTotalPrice` (T4).
- Not: Tarih eleme predicate'i **her iki task'ta da birebir aynı** olmalı: `startDate < @end AND endDate > @start` (bitişik hariç). T8 Prisma ilişkisel filtresinde (`NOT/none`), T9 `findApprovedOverlap` (T9 Produces) kullanır; ikisini de bitişik-tarih testi kilitler.
- Produces:
  - `type SearchParams = { sehir?; baslangic?; bitis?; kisi?; minFiyat?; maxFiyat?; aracTipi?; sayfa? }`
  - `searchListings(params: SearchParams): Promise<{ items: Listing[]; total: number }>`

- [ ] **Step 1: Testi yaz — `tests/search.test.ts`** (fixture: 3 ACTIVE, 1 PAUSED, 1 APPROVED rezervasyonlu ilan)

```ts
it("yalnızca ACTIVE ilanlar döner (PAUSED/PENDING/REJECTED hariç)", ...)
it("tarih çakışan ilan elenir", ...)                    // ilan[10-12] APPROVED → baslangic=11 sorgusu bulmaz
it("bitişik tarih bulunur", ...)                        // baslangic=12 (giriş) o ilanı bulur
it("kisi filtresi capacity >= kisi uygular", ...)
it("aracTipi ve fiyat aralığı filtreleri", ...)
it("sayfa başına 20, toplam sayfa sayısı doğru", ...)
```

- [ ] **Step 2: FAIL doğrula** → `npx vitest run tests/search.test.ts`

- [ ] **Step 3: `searchListings` implemente et**

Prisma `findMany` + `count`; tarih filtresi: çakışan `APPROVED|COMPLETED` `BookingRequest`'leri NOT IN / NONE ile ele; `ILIKE` şehir; `orderBy: { createdAt: "desc" }`; 20/sayfa.

- [ ] **Step 4: PASS doğrula** → `npx vitest run tests/search.test.ts`

- [ ] **Step 5: Sayfaları yaz**

`/` (arama kutusu: şehir, tarih, kişi → `/arama`'ya gider, son eklenen 12 aktif ilan), `/arama` (filtreler URL query'den, `ListingCard` listesi, sayfalama), `/ilan/[id]` (galeri, marka/model, vites/yakıt, kapasite, **licenseRequired + minDriverAge rozeti**, amenities TR etiketleri, `houseRules`, `minRentalDays`, fiyat özeti `nights × nightlyPrice`, talep formu [T9 bağlanacak], yorumlar bölgesi [Plan 2 — şimdilik boş], 404 `not-found`).

- [ ] **Step 6: `npm run build` + `npm run check` + commit** — `feat: tarihli arama, filtreler ve ilan detay sayfası`.

---

### Task 9: Rezervasyon talebi — kritik akış

**Files:**
- Create: `src/lib/availability.ts`, `src/server/bookings/{service,actions}.ts`, `src/app/ilan/[id]/BookingRequestForm.tsx`, `src/app/hesap/taleplerim/page.tsx`
- Test: `tests/availability.test.ts`, `tests/booking-actions.test.ts`

**Interfaces:**
- Consumes: `validateStay/calculateTotalPrice` (T4), `requireUser` (T3), `sendBookingRequested/sendBookingStatusChanged` (T5), seed/factories (T2).
- Produces:
  - `findApprovedOverlap(db: Prisma.Client | Prisma.TransactionClient, listingId: string, startDate: string, endDate: string): Promise<{ id: string } | null>` — yalnız `APPROVED|COMPLETED`, koşul `startDate < end AND endDate > start` (bitişik hariç). T8'in Prisma filtresiyle aynı predicate.
  - `createBookingCore(user, input: { listingId; startDate; endDate; guests; message? }): Promise<ActionResult<BookingRequest>>`
  - `approveBookingCore(user, id)`, `rejectBookingCore(user, id, reason?)`, `cancelBookingCore(user, id)`
  - `actions.ts`: aynı adlar, `requireUser()` sarar; sayfa/sabitler bunları çağırır.

- [ ] **Step 1: Çakışma testini yaz — `tests/availability.test.ts`**

```ts
it("üst üste binen APPROVED aralıkta findApprovedOverlap kayıt döner", ...)
it("bitişik tarihler (çıkış=giriş) findApprovedOverlap null döner", ...)
it("REJECTED/CANCELLED kayıtlar çakışma sayılmaz", ...)
```

- [ ] **Step 2: Akış testlerini yaz — `tests/booking-actions.test.ts`** (Review Focus 1,2,4,5 burada)

```ts
it("create: sunucu fiyatını yazar — payload'daki totalPrice:1 yok sayılır", ...)
it("create: status/ownerId payload alanları yok sayılır, status her zaman PENDING", ...)
it("create: aynı kiracı aynı ilana ikinci PENDING talep oluşturamaz", ...)
it("create: minRentalDays/kapasite ihlali fail döner (T4 kuralları)", ...)
it("create: başarılı olunca sendBookingRequested çağrılır (mock)", ...)
it("approve: paralel yarışta tek kazanan — Promise.all iki onay, DB'de tek APPROVED, diğeri hata", ...)
it("approve: bitişik tarihler ikinci onayı da başarılı", ...)
it("approve: sahip olmayan kullanıcı fail(403), durum değişmez", ...)
it("approve: email client hata fırlatsa da kayıt APPROVED kalır", ...)
it("reject: gerekçe kaydedilir, REJECTED + mail", ...)
it("cancel: kiracı yalnız PENDING/APPROVED iptal edebilir; COMPLETED edemez", ...)
```

- [ ] **Step 3: FAIL doğrula** → `npx vitest run tests/availability.test.ts tests/booking-actions.test.ts`

- [ ] **Step 4: `availability.ts` + `bookings/service.ts` implemente et**

`approveBookingCore` mantığı (spec §4.1): `$transaction` içinde önce **ilan bazlı advisory lock** — raw `SELECT pg_advisory_xact_lock(hashtext(${listingId}))` (var olmayan satırları kilitleyemeyen `FOR UPDATE` yerine doğru mekanizma; iki eşzamanlı onayı sıraya sokar), sonra `findApprovedOverlap` ile çakışma kontrolü → kayıt varsa `fail("Bu tarihler artık dolu, farklı tarih seçin")`; yoksa `APPROVED` güncelle → transaction commit **sonrası** e-posta. E-posta ve hız sınırı hatası action'ı düşürmez (`try/catch`).

- [ ] **Step 5: PASS doğrula** → aynı komut, 12/12.

- [ ] **Step 6: UI'ı bağla**

`BookingRequestForm` (tarih + kişi + mesaj; istemcide `totalPrice` gösterimi sunucudan gelen quote ile, hatalar alan bazında TR), `/hesap/taleplerim` (gelen: onayla/reddet + gerekçe; giden: iptal; durum rozetleri TR: Bekliyor/Onaylandı/Reddedildi/İptal/Tamamlandı).

- [ ] **Step 7: `npm run check` + commit** — `feat: rezervasyon talebi akışı, atomik çakışma koruması`.

---

### Task 10: Admin moderasyonu

**Files:**
- Create: `src/server/admin/{service,actions}.ts`, `src/app/admin/{layout.tsx,page.tsx,ilanlar/page.tsx,kullanicilar/page.tsx}`
- Test: `tests/admin.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` (T3), `sendListingStatusChanged` (T5), factories (T2).
- Produces:
  - `approveListingCore(admin, id)`, `rejectListingCore(admin, id, reason)`, `pauseListingCore(admin, id)`, `setUserBannedCore(admin, userId, banned)`
  - `admin/actions.ts` sarmalayıcıları.

- [ ] **Step 1: Testleri yaz — `tests/admin.test.ts`**

```ts
it("role=USER approveListing çağırırsa fail(403) ve ilan PENDING kalır", ...)
it("approve: PENDING → ACTIVE, REDDEDILDI → tekrar ACTIVE (yeniden gönderim), email gider", ...)
it("reject: gerekçe REJECTED'a yazılır + email", ...)
it("pause: ACTIVE → PAUSED, aramada görünmez (search.test kapsamı)", ...)
it("ban: isBanned=true → verifyCredentials null döner (giriş kapanır)", ...)
it("ban aç: kullanıcı tekrar giriş yapabilir", ...)
```

- [ ] **Step 2: FAIL doğrula** → `npx vitest run tests/admin.test.ts`

- [ ] **Step 3: Implemente et** — service (durum geçiş matrisi: yalnız `PENDING→ACTIVE|REJECTED`, `ACTIVE→PAUSED`, `REJECTED|PAUSED→PENDING` submit ile [geniş inceleme düzeltmesi: PAUSED için tek çıkış sahip submit'i — bkz. progress.md]), actions, admin layout (`requireAdmin()`), sayfalar (TR).

- [ ] **Step 4: PASS doğrula** → `npx vitest run tests/admin.test.ts`

- [ ] **Step 5: `npm run check` + commit** — `feat: admin moderasyonu, ilan onay/red ve kullanıcı ban`.

---

### Task 11: Hız sınırı ve günlük cron

**Files:**
- Create: `src/lib/rate-limit.ts`, `src/app/api/cron/complete-bookings/route.ts`, `vercel.json`
- Modify: `src/server/bookings/service.ts` (create çekirdeğine sınır uygula)
- Test: `tests/rate-limit.test.ts`, `tests/cron.test.ts`

**Interfaces:**
- Consumes: `prisma.rateLimitEntry` (T2), `sendBookingStatusChanged` (T5).
- Produces:
  - `assertRateLimit(kind: "booking" | "message", key: string, limit: number, windowSeconds: number): ActionResult<true>` — DB sayaçlı; limit aşımında `fail("Çok fazla istek gönderdiniz, biraz bekleyin")`.
  - Pin'ler: `BOOKING_LIMIT = 5 / 60sn` (T11'de bağlanır), `MESSAGE_LIMIT = 20 / 60sn` (Plan 2).
  - `completeDueBookings(now?: Date): Promise<number>` — `APPROVED` ve `endDate < today` → `COMPLETED`, dönen kayıt sayısı.
  - Cron route: `Authorization: Bearer ${CRON_SECRET}` yoksa 401.

- [ ] **Step 1: Testleri yaz**

`tests/rate-limit.test.ts`:
```ts
it("5. istek geçer, 6. istek fail döner", ...)
it("pencere dolduktan sonra tekrar izin verilir (expiresAt manipülasyonu)", ...)
it("farklı key'ler bağımsız sayılır", ...)
```
`tests/cron.test.ts`:
```ts
it("bitiş tarihi geçen APPROVED kayıtları COMPLETED yapar, sayıyı döner", ...)
it("endDate'i bugün/ileri olan APPROVED kayıtlarına dokunmaz", ...)
it("yanlış/eksik CRON_SECRET → 401", ...)
```

- [ ] **Step 2: FAIL doğrula** → `npx vitest run tests/rate-limit.test.ts tests/cron.test.ts`

- [ ] **Step 3: Implemente et** — `rate-limit.ts` (upsert sayaç, `expiresAt` pencere sonu; pencere dolmuşsa sıfırla), cron route + `completeDueBookings`, `vercel.json` cron (`"0 3 * * *"` günlük 03:00).

- [ ] **Step 4: Sınırı talep akışına uygula**

`createBookingCore` başında `assertRateLimit("booking", user.id, BOOKING_LIMIT, 60)` — test: `booking-actions.test.ts`'e `it("dakikada 5. sonrası fail", ...)` ekle.

- [ ] **Step 5: PASS doğrula + `npm run check`** → tüm testler yeşil.

- [ ] **Step 6: Commit** — `feat: db tabanlı hız sınırı ve günlük tamamlama cron'u`.

---

### Task 12: Hata sayfaları, UI cilası ve README

**Files:**
- Create: `src/app/{error.tsx,not-found.tsx,loading.tsx}`, `src/app/hesap/profil/page.tsx`, `README.md`
- Modify: `src/app/globals.css` (varsa taşma/contrast düzeltmeleri), `src/app/page.tsx` (son rötuş), `src/server/users/service.ts` + `actions.ts`
- Test: `tests/profile.test.ts`

**Interfaces:**
- Consumes: tüm sayfalar (T3, T6-T10).
- Produces: Türkçe `error.tsx` ("Bir şeyler ters gitti — tekrar dene" + buton), `not-found.tsx` ("Bu ilan bulunamadı veya kaldırıldı"), `loading.tsx` iskeletleri; `updateProfileCore(user, { name?, phone?, newPassword? }): Promise<ActionResult<true>>` (şifre değişimi bcrypt ile, eski şifre zorunlu).

- [ ] **Step 1: Hata/yükleme sayfalarını yaz** (Türkçe, responsive, inline SVG ikon — ek bağımlılık yok).

- [ ] **Step 2: Profil sayfası + testi**

`tests/profile.test.ts`:
```ts
it("kendi adını/telefonunu günceller", ...)
it("yeni şifre hash'lenerek yazılır, düz metin DB'ye girmez", ...)
it("başkasının profilini değiştiremez (yok sayılır — id oturumdan gelir)", ...)
```
Run: `npx vitest run tests/profile.test.ts` → FAIL → `updateProfileCore` + action'ı implemente et → PASS. `/hesap/profil` sayfasını yaz (ad, telefon, şifre değiştirme formu; alan bazlı TR hatalar).

- [ ] **Step 3: Responsive kontrol**

`npm run dev` ile 360px / 768px / 1280px genişliklerde: `/`, `/arama`, `/ilan/[id]`, `/hesap/ilanlarim`, `/hesap/taleplerim`, `/admin/ilanlar` — yatay taşma yok, dokunma hedefleri >= 40px. Bulguları `globals.css`/sayfalarda düzelt.

- [ ] **Step 4: README yaz**

Kurulum (`.env` değişkenleri, `prisma migrate dev`, `npm run seed`), demo hesaplar (`admin@karavan.test`, `sahip@karavan.test`, `kiraci@karavan.test` / `demo1234`), script'ler (`check`, `test`, `build`), mimari notu (service/actions ayrımı, TEST_DATABASE_URL).

- [ ] **Step 5: Final doğrulama**

Run: `npm run check && npm run build` → Expected: hepsi PASS. Manuel: kayıt → ilan oluştur → gönder → admin onayla → aramada gör → talep oluştur akışı tek seferde hatasız.

- [ ] **Step 6: Commit** — `feat: hata sayfaları, profil, responsive cila ve readme`.

---

## Plan 2 (sonraki — bu plan tamamlanınca yazılacak)

Mesajlaşma (Conversation/Message + 5 sn polling), değerlendirmeler (`COMPLETED` ön koşulu), şikayetler (Report + admin), mesajlara hız sınırı, günlük özet e-postası, giriş doğrulama (e-posta) akışı, Playwright 3 senaryo kabul testi, CI (GitHub Actions: tsc+eslint+vitest+build).
