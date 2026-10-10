# Karavan Kiralama — MVP

Türkiye genelinde karavan sahipleri ile kiracıları buluşturan peer-to-peer
kiralama platformu (Airbnb benzeri). Next.js 15 (App Router) + TypeScript
(strict) + Tailwind v4 + Prisma (PostgreSQL) + Auth.js (NextAuth v5) +
UploadThing + Resend.

Arayüz metinleri **yalnızca Türkçe**; veritabanı tablo/kolon/enum adları
**yalnızca İngilizce**.

## Gereksinimler

- **Node.js >= 20**
- **PostgreSQL** (yerel sunucu veya uzak bir veritabanı)

## Kurulum

```bash
# 1) Bağımlılıkları kurun (postinstall otomatik olarak `prisma generate`
#    çalıştırır — ayrı bir generate adımı gerekmez):
npm install

# 2) Ortam değişkenlerini tanımlayın (.env.example kopyalanır):
cp .env.example .env
#    Ardından .env içine kendi değerlerinizi yazın.

# 3) Veritabanı şemasını uygulayın:
npx prisma migrate dev

# 4) Demo verileri yükleyin:
npm run seed
```

> Worktree/checkout notu: aynı deposun başka bir checkout'unda yalnızca
> `npm install` yeterlidir; `postinstall` script'i `prisma generate`'i otomatik
> çalıştırır.

### .env değişkenleri

| Değiken | Açıklama |
| --- | --- |
| `DATABASE_URL` | Uygulamanın bağlandığı PostgreSQL adresi (dev). |
| `TEST_DATABASE_URL` | Test veritabanı. Testler `DATABASE_URL` ile **eşitlenir** ve `resetDb()` TRUNCATE eder — testler yalnızca bu DB'ye bağlanabilir. Farklı bir DB kullanın. |
| `AUTH_SECRET` | Auth.js oturum imzalama anahtarı (`openssl rand -base64 32` ile üretebilirsiniz). |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth istemci kimliği/gizli anahtarı (Google Cloud Console → OAuth client). Tanımsızsa Google ile giriş menüsü devre dışı kalır. |
| `RESEND_API_KEY` | Resend e-posta gönderim anahtarı (talep/onnay e-postaları). |
| `RESEND_FROM` | Gönderen adresi (ör. `Karavan <onboarding@resend.dev>`). Opsiyonel; varsayılan kod içinde tanımlıdır. |
| `UPLOADTHING_TOKEN` | UploadThing yükleme anahtarı (ilan fotoğrafları). |
| `CRON_SECRET` | `/api/cron/complete-bookings` cron'unun sırrı; istek `Authorization: Bearer <CRON_SECRET>` başlığı ile doğrulanır (fail-closed). |


## Demo hesaplar

`npm run seed` sonrası tüm hesapların şifresi **`demo1234`**'tür:

| E-posta | Rol |
| --- | --- |
| `admin@karavan.test` | Yönetici (moderasyon paneli `/admin`) |
| `sahip@karavan.test` | İlan sahibi |
| `ikinci-sahip@karavan.test` | İlan sahibi (ikinci) |
| `kiraci@karavan.test` | Kiracı |

## Script'ler

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu (Next.js). |
| `npm run build` | Üretim derlemesi. |
| `npm run start` | Üretim sunucusu. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run check` | Tam kapı: `prisma generate` + `next typegen` + `tsc` + `eslint` + tüm testler. |
| `npm run test` | Vitest testleri (`vitest run`). |
| `npm run seed` | Demo veri yükler (`prisma db seed`). |

## Mimari notlar

- **Service / action ayrımı:** İş kuralları `src/server/*/service.ts`
  (çekirdek fonksiyonlar, `Promise<ActionResult<T>>` döner — bkz.
  `src/lib/result.ts`), HTTP/sunucu eylemleri `src/server/*/actions.ts`
  (`"use server"`, `requireUser()`/`requireAdmin()` oturum kapıları). Eylemler
  ince sarmalayıcıdır; doğrulama (Zod, `src/lib/validators/`) service'tedir.
- **Otoriter sunucu:** İstemciden gelen `id`/`role`/`status` alanları Zod v4
  strip kuralı ile yok sayılır; hedef satır her zaman oturumdaki
  `user.id`'den gelir.
- **Şifreler:** bcrypt ile hash'lenir; düz metin asla DB'ye yazılmaz. Profil
  şifre değişimi mevcut şifrenin doğrulamasını şart koşar.
- **Test DB izolasyonu:** `vitest.config.mts` worker'larda `DATABASE_URL`'i
  `TEST_DATABASE_URL`'e eşitler; `tests/helpers/global-setup.ts` test
  başlamadan `prisma migrate deploy` çalıştırır; `resetDb()` her testte
  tabloları TRUNCATE eder. `fileParallelism: false` çünkü dosyalar aynı DB'yi
  paylaşır. `tests/helpers/db.ts` bağlantı uyuşmazlığında yalnız veritabanı
  ADINI gösterir (URL/şifre asla hata metnine yazılmaz).
- **E-posta:** Resend (`src/lib/email/`); API anahtarı yoksa gönderim
  loglanır ve atlanır (geliştirmeyi kırmaz).
- **Cron:** Vercel `vercel.json` her gün 03:00'te
  `/api/cron/complete-bookings` çağırır; rota `CRON_SECRET` başlığını
  doğrular (onaylanmış-geçmişli talepleri `COMPLETED` yapar).

## Bilinen sınırlamalar

- **Fotoğraf yükleme:** Canlı yükleme için gerçek bir `UPLOADTHING_TOKEN`
  gerekir (token yoksa yükleme adımında hata gösterilir).
- **Google ile giriş:** Dağıtımda gerçek bir OAuth `client_id`/`secret`
  (ve izin verilen redirect URI'ler) tanımlanmalıdır.
- **E-posta:** Üretimde geçerli bir `RESEND_API_KEY` gerekir; tanımsızsa
  e-postalar yalnız loglanır.
- **Cron doğrulaması:** Vercel, kendi cron'larına `Authorization` başlığını
  otomatik ekler; dağıtımda `CRON_SECRET`'ün Vercel'de tanımlı olduğunu
  doğrulayın (lokalde manuel çağrı 401 döner — beklenen davranış).
- **E-posta değiştirme:** Profil sayfasında e-posta değiştirilemez (kapsam
  dışı); şifre sıfırlama akışı plan dışıdır.
