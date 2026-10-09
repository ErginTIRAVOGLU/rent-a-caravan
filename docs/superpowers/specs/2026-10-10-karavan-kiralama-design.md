# Karavan Kiralama Platformu — Tasarım Dokümanı

**Tarih:** 2026-10-10
**Durum:** Onaylandı
**Yol:** Mimari (architectural) — brainstorming çıktı

---

## 1. Amaç ve Kapsam

Türkiye pazarına yönelik, gerçek karavan sahipleri ile kiracıları buluşturan, iki taraflı (peer-to-peer) bir pazar yeri MVP'si. Airbnb deneyimi, karavan dikeyine uyarlanmış.

**Başarı kriteri:** Bir sahip ilanını çıkarabildiği, bir kiracının tarihli arama yapıp talep gönderebildiği, sahibin onaylayabildiği, tarafların birbiriyle mesajlaşıp birbirini değerlendirebildiği ve admin'in kötü ilanları kaldırabildiği canlı site.

**Referans site:** [letsgocamper.com](https://www.letsgocamper.com/) — Antalya merkezli filo kiralama şirketi (pazar yeri değil, tek lokasyon). İlan alan iskeleti (marka/model, vites, ölçüler, donanım), ehliyet/yaş kuralı, depozito ve ev kuralları gerçekleri için incelendi (2026-10-10).

**Doğrulanmış kararlar (kullanıcı ile netleştirilen):**

| Karar | Seçim |
|---|---|
| Amaç | Gerçek iş fikri, yayına alınabilir MVP |
| Ödeme | Platform ödeme paraya dokunmaz — rezervasyon talebi + dışarıdan ödeme (elden/IBAN) |
| Platform | Sadece web, mobil uyumlu responsive |
| Kapsam | Paket 2: çekirdek + mesajlaşma + değerlendirme + admin moderasyonu |
| Stack | Next.js (App Router) + TypeScript + Tailwind + Prisma + PostgreSQL |
| Altyapı | Vercel (hosting) · UploadThing/S3 (fotoğraf) · Resend (e-posta) · NextAuth/Auth.js (Google + e-posta/şifre) |
| Dil | Sadece Türkçe (arayüz); veritabanı adları İngilizce |
| Kazanç | İlk sürümde yok (komisyon/üyelik ücreti sonra) |
| Mimari yaklaşım | Saf modül monoliti (domain klasörleri, server actions, polling mesajlaşma) |

**Kapsam dışı (MVP'de yok):**
- Online ödeme / komisyon / iade takvimi
- Harita görünümü, favoriler, sahip müsaitlik takvimi (sonraki sürüm)
- Çoklu dil (i18n), native mobil uygulama, push bildirim
- Kampanya/indirim kodu, öne çıkan ilanlar, PostGIS arama
- Plaka/TC gibi sahip kimlik doğrulama bilgileri
- **Sezonluk fiyat tablosu** (ay bazlı fiyat — referans: letsgocamper.com; MVP'de tek `nightlyPrice`)
- Ek ekipman kiralama (masa, mangal…), araç bazlı FAQ, WhatsApp butonu, TR/EN değiştirici

---

## 2. Site Yapısı ve Roller

### Genel (girişsiz gezilebilir)
- `/` — ana sayfa: tarih + şehir + kişi sayısı arama kutusu, son eklenen aktif ilanlar
- `/arama` — sonuçlar + filtreler (şehir, tarih aralığı, kişi, fiyat, araç tipi)
- `/ilan/[id]` — detay: fotoğraflar, fiyat özeti (gece × gün), marka/model, vites/yakıt, kapasite, **ehliyet gereksinimi + min yaş**, donanım etiketleri, ev kuralları, min kiralama süresi, sahip profili, müsaitlik kontrolü, "Talep gönder", yorumlar
- `/giris`, `/kayit`

### Giriş yapmış kullanıcı (tek panel — kiracı/sahip ayrımı yok)
- `/hesap/taleplerim` — gönderdiğim talepler ve bana gelen talepler (durum rozetleriyle)
- `/hesap/ilanlarim` — ilan CRUD'u (çok adımlı form: bilgiler → fotoğraflar → yayın)
- `/hesap/mesajlar` — sohbet listesi + mesaj ekranı
- `/hesap/degerlendirmeler` — yazdığım/yazılan yorumlar
- `/hesap/profil`

### Admin (`/admin`, sadece `role=ADMIN`)
- `/admin/ilanlar` — bekleyen ilan moderasyonu (onay/red, gerekçeli)
- `/admin/kullanicilar` — kullanıcı listesi, ban/aç
- `/admin/sikayetler` — şikayet kuyruğu

### Roller
- **Tek hesap, iki rol:** Her kullanıcı hem kiracı hem sahip olabilir (Airbnb modeli). Panelde sekmeler. Ayrı hesap tipi seçimi yok.
- **Admin:** `User.role: USER | ADMIN`; ilk admin DB'ye elle eklenir.
- **Ban:** `User.isBanned` — girişte engellenir.

---

## 3. Veri Modeli (Prisma / PostgreSQL)

Tablo, kolon ve enum adları **İngilizce**; Türkçe metin yalnızca arayüzde.

```
User
  id, name, email (unique), passwordHash?, googleId?, avatarUrl?,
  phone?, role: USER | ADMIN, isBanned: bool, createdAt

Listing
  id, ownerId → User,
  title, description,
  city, district?, lat?, lng?,
  nightlyPrice (TL, Decimal), capacity: int,
  vehicleType: TOWED_CARAVAN | PANELVAN | MOTORHOME,
  brand?, model?,
  transmission: MANUAL | SEMI_AUTOMATIC | AUTOMATIC,
  fuel: DIESEL | PETROL | ELECTRIC | HYBRID,
  licenseRequired: B | BE | C1 | C,     -- sahip beyanı, ilanda gösterilir
  minDriverAge?: int,                   -- örn. 21
  minRentalDays: int (default 1),
  year?, weightKg?, lengthM?,
  amenities: string[] (sabit katalog — bkz. 3.1),
  houseRules?: text,                    -- "Evcil hayvan yok", "Sigara yasak" vb.
  photoUrls: string[],
  status: DRAFT | PENDING | ACTIVE | REJECTED | PAUSED,
  rejectionReason?, createdAt

BookingRequest
  id, listingId → Listing, renterId → User,
  startDate, endDate, guests: int,
  totalPrice (Decimal, sunucuda hesaplanır),
  message?,
  status: PENDING | APPROVED | REJECTED | CANCELLED | COMPLETED,
  createdAt

Conversation
  id, listingId → Listing, renterId → User, ownerId → User,
  unique(listingId, renterId), createdAt

Message
  id, conversationId → Conversation, senderId → User,
  content: text, readAt?: DateTime, createdAt

Review
  id, listingId → Listing, authorId → User,
  bookingId (unique) → BookingRequest,
  rating: int (1–5), comment?, createdAt

Report
  id, reporterId → User,
  targetType: LISTING | USER, targetId: string,
  reason: text, status: OPEN | REVIEWING | CLOSED, createdAt
```

### 3.1 Amenities kataloğu (sabit kod listesi — DB'de kolon değil)

```
AIR_CONDITIONING | WC | SHOWER | SOLAR_PANEL | AWNING | HEATING |
TV | HOT_WATER | STOVE | FRIDGE | BEDDING | COOKWARE | GPS |
BIKE_RACK | REAR_CAMERA | INVERTER | WIFI
```
Arayüzde Türkçe etiketler: Klima, WC, Duş, Güneş Paneli, Tente, Isıtma, TV, Sıcak Su, Ocak, Buzdolabı, Yatak Takımı, Mutfak Takımı, GPS, Bisiklet Taşıyıcı, Kamera, İnvertör, WiFi.

**İndeksler:**
- `Listing(city, status)`
- `BookingRequest(listingId, status, startDate, endDate)`
- `Message(conversationId, createdAt)`

---

## 4. Akışlar

### 4.1 Rezervasyon talebi (çekirdek akış)
1. Kiracı ilan detayında tarih + kişi seçer → sunucu doğrular: `endDate - startDate >= listing.minRentalDays`, `guests <= capacity`, tarih kuralları → `totalPrice`'ı `nights × nightlyPrice` olarak hesaplar → `PENDING` talep + sahibe e-posta.
2. Sahip panelde onaylar/reddeder (+ gerekçe):
   - **Onayda:** `$transaction` içinde üst üste binme kontrolü — `startDate < other.endDate AND endDate > other.startDate`, yalnız `APPROVED`/`COMPLETED` kayıtlarına karşı. Çakışıyorsa kontrollü hata ("Bu tarihler artık dolu"), uyuşuyorsa `APPROVED` + kiracıya e-posta. Yarış koşulu için raw SQL `SELECT ... FOR UPDATE` — onay atomik.
   - **Redde:** `REJECTED` + gerekçe + e-posta.
3. Kiracı iptal edebilir (`CANCELLED`). Tarihler geçince günlük cron ile `COMPLETED` → yorum açılır.

### 4.2 Mesajlaşma
- İlan detayında "Sor" → varsa mevcut sohbet, yoksa yeni `Conversation` (kiracı+sahip+ilan, eşsiz).
- Panel: liste + mesaj ekranı. **Polling 5 sn** (`useSWR`), `unreadCount` rozeti.
- Gönderim: server action + optimistic UI.
- Talep öncesi serbest soru; talep onaylanınca sohbet başlığında durum rozeti.

### 4.3 Moderasyon
- İlan kaydedilince `PENDING` → admin kuyruğunda önizleme + onay/red.
- Red: gerekçeli e-posta; sahip düzeltip tekrar gönderebilir.
- Admin ayrıca ilanı `PAUSED` alabilir, kullanıcıyı banlayabilir.
- Her ilan/kullanıcı kartında "Bildir" → `Report` → admin listesi.

### 4.4 E-posta olayları (Resend, şablonlar Türkçe)
- Talep alındı / onaylandı / reddedildi
- Yeni mesaj → günlük özet (her mesajda değil; spam önleme)
- İlan onaylandı / reddedildi
- Giriş doğrulama

E-posta gönderimi `try/catch` içinde; başarısızlık log'a yazılır, ana akışı asla kilitlemez.

### 4.5 Arama
- PostgreSQL `ILIKE` + tarih çakışma alt sorgusu + filtreler; `OFFSET` sayfalama, sayfa başına 20 ilan.
- Filtreler: şehir, tarih aralığı (çakışan `APPROVED` kayıtları eler), kişi sayısı, fiyat aralığı, araç tipi.

---

## 5. Güvenlik ve Hata Yönetimi

### Yetkilendirme
- Her server action / route handler başında sunucu tarafı kontrol: oturum var mı, kaynak sahibi mi (`listing.ownerId === session.user.id`), admin mi.
- İstemciden gelen `ownerId`, `price`, `status`, `role` alanları **asla okunmaz** — hep oturumdan türetilir.
- `/admin/**` ve sahip paneli middleware ile erken koruma; asıl garanti action içinde.
- `isBanned` kullanıcılar girişte engellenir.

### Girdi doğrulama
- Tüm formlar **Zod** ile (tek şema kaynağı, istemci + sunucu). Hatalar alan bazında.
- Tarih kuralları: `startDate >= bugün`, `endDate > startDate`, en fazla 30 gece, `endDate - startDate >= listing.minRentalDays`, `guests <= listing.capacity`
- Fotoğraf: sadece jpg/png/webp, max 10 dosya (`MAX_PHOTOS = 10`), dosya başına ~5 MB (UploadThing config).

### Hata yüzeyi
- `error.tsx` / `not-found.tsx` Türkçe, zarif.
- Beklenen hatalar (yetki yok, çakışan tarih, kaldırılmış ilan) kontrollü sonuç döner, throw etmez → net Türkçe mesaj.
- Beklenmeyen hatalar: konsol + Vercel izleme.
- Kritik aksiyonlarda (talep onayı) hata → transaction rollback; yarım kayıt kalmaz.

### Spam / istismar
- Mesaj ve talep için kullanıcı başına dakikalık hız sınırı (DB sayaçlı, ek servis yok).
- Şifre hashing (NextAuth bcrypt/scrypt). CSRF: NextAuth varsayılanı. Güvenli çerez (`httpOnly`, `secure`).

### Performans
- `next/image` (UploadThing Optimized); sayfa başına 20 ilan.
- Arama ve ilan detayında kısa `revalidate`; yalnız mesajlar poll eder.
- DB indeksleri: bkz. Bölüm 3.

---

## 6. Test Stratejisi

**Kapsama hedefi: MVP ölçeğinde, YAGNI.**

1. **Birim/entegrasyon — Vitest + gerçek test Postgres'i:**
   - Fiyat hesabı (`nights × nightlyPrice`, gece sınırı)
   - **Çift rezervasyon koruması** — üst üste binen onay reddedilir, transaction atomiktir (kritik test)
   - Yorum ön koşulu (yalnız `COMPLETED` + kendi talebi)
   - Yetki testleri — başkasının kaynağına erişim → 403
   - Zod şemaları (geçersiz tarih, negatif fiyat, fazla foto, min kiralama süresi ihlali, kapasite aşımı)
   - Arama filtresi sorguları (tarih çakışması eleme)
2. **API/server action entegrasyon:** talep → onay → e-posta tetiklenir (Resend mock'lanır); moderasyon akışı.
3. **Playwright smoke (3 senaryo):**
   - Kiracı: ara → detay → talep gönder → panoda "Bekliyor"
   - Sahip: talebi onayla → karşı tarafta "Onaylandı"
   - Admin: yeni ilanı onayla → aramada görünür
4. **Yapısal kalite:** `tsc --noEmit` + ESLint CI'da; Vercel preview deploy her PR'da.
5. **Seed script:** 2 ilan, 3 kullanıcı, 1 admin — hem test hem demo.

**Kabul kriteri:** 1–2 yeşil, Playwright 3 senaryosu yeşil — bunlar olmadan "bitti" denmez.

---

## 7. Teknik Altyapı Özeti

- **Uygulama:** Next.js (App Router) + TypeScript + Tailwind, tek deploy (Vercel)
- **Veritabanı:** PostgreSQL (Prisma ORM), migration'lar Prisma migrate
- **Kimlik:** NextAuth/Auth.js — Google + e-posta/şifre
- **Fotoğraf:** UploadThing (veya S3/R2) — `MAX_PHOTOS = 10`
- **E-posta:** Resend, Türkçe şablonlar
- **API biçimi:** Server actions (mutasyon), route handler gerekli yerlerde
- **Gerçek zamanlı:** yok — mesajlar 5 sn polling (sonradan SSE/Pusher'a yükseltilebilir; domain sınırı belli)
- **Dizin yapısı:** `app/` altında domain klasörleri — `listings`, `bookings`, `messages`, `reviews`, `admin`, `users`
- **Zamanlanmış iş:** Vercel Cron (günlük) — bitiş tarihi geçen `APPROVED` kayıtlarını `COMPLETED` yapar (yorum açılışı)

---

## 8. Sonraki Sürüm Yol Haritası (MVP dışı, şimdi yapılmayacak)

1. Online ödeme (iyzico/PayTR) + kazanç modeli
2. Harita arama (PostGIS), favoriler
3. Sahip müsaitlik takvimi (tarih kapama)
4. Gerçek zamanlı mesajlaşma (SSE/Pusher)
5. İ18n (EN), native mobil/PWA push
6. **Sezonluk fiyat tablosu** (ay bazlı — referans: letsgocamper.com)
7. Ek ekipman kiralama (masa, mangal…), WhatsApp butonu
8. Ehliyet/yaş belge doğrulama (şimdilik sadece sahip beyanı)
