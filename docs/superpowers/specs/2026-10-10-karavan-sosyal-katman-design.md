# Karavan Kiralama — Plan 2: Sosyal Katman ve Kalite Kapısı (Tasarım Ek'î)

**Tarih:** 2026-10-10
**Durum:** Taslak — kullanıcı onayı bekliyor
**Yol:** Mimari (architectural) — brainstorming çıktı
**İlişki:** Ana tasarım dokümanı `2026-10-10-karavan-kiralama-design.md`'in (Onaylandı) **delta'âısıdır**. Burada yazmayan her şey ana spec'e bağlıdır; çelişki hâlinde bu doküman Plan 2 için önceliklidir. Plan 1 (çekirdek MVP) `feature/karavan-mvp` dalında tamamlandı (PR #1); bu doküman Plan 2'yi tarif eder.

---

## 1. Kapsam ve Kararlar

**Başarı kriteri:** Tarafların mesajlaşıp birbirini değerlendirebildiği, şikayetlerin admin'de toplandığı, e-posta özetlerinin çalıştığı, CI + Playwright kapısı olan canlı site (ana spec §1 tamamlanır).

**Kullanıcı ile netleştirilen kararlar:**

| # | Karar | Seçim |
|---|---|---|
| 1 | Plan yapısı | Tek Plan 2, sıralı görevler (Plan 1 gibi) |
| 2 | Backlog | 5/5 dahil: logout UI, session-aware header, `UTApi.deleteFiles`, JWT rol donması, COMPLETED şablonu |
| 3 | CI | Tam CI: vitest + Playwright, GitHub Actions (postgres service container) |
| 4 | "Giriş doğrulama" | **Kayıt e-posta doğrulama linki** (Google otomatik doğrulanmış sayılır) |
| 5 | Yorum kapsamı | **Tam CRUD** + yazar IP kaydı + admin genel anahtar + sahip anahtarı + 1–5 yıldız |
| 6 | Sahip anahtarı seviyesi | **Hesap seviyesi** (`User.reviewsVisible` — tüm ilanları) |
| 7 | Anahtar SEMANTİKİ | **Kapalıyken: gizle + yeni yorumu engelle** (ikisi de aynı semantic) |
| 8 | JWT rol donması | **C: kısa ömürlü JWT** — somut hâli §3.1'de (claim tazeleme ile birlikte) |
| 9 | Playwright | **5 senaryo**: spec §6'nın 3'ü + mesajlaşma + yorum yazma |

**Kapsam dışı (değişmedi, ana spec §1/§8):** ödeme, harita, favoriler, SSE/Pusher, i18n, sezonluk fiyat, ek ekipman, WhatsApp, push bildirim.

---

## 2. Veri Modeli Delta'sı (Prisma / PostgreSQL)

Tablo/kolon/enum adları İngilizce; TR yalnız arayüz.

```
User                                    -- MEVCUT şemaya EK'ler
+ emailVerified: DateTime?              -- null = doğrulanmadı (kayıt doğrulama)
+ reviewsVisible: Boolean @default(true)-- sahip yorum anahtarı (HESAP seviyesi)

Conversation                             -- ana spec §3'e sadık
  id, listingId → Listing, renterId → User, ownerId → User,
  unique(listingId, renterId), createdAt
+ lastMessageAt: DateTime?              -- liste sıralaması (denormalizasyon)
+ lastMessagePreview: String? (80)      -- liste önizlemesi (N+1 yok)
+ index (renterId, lastMessageAt), index (ownerId, lastMessageAt)

Message                                  -- ana spec §3'e sadık
  id, conversationId → Conversation, senderId → User,
  content: text, readAt?: DateTime, createdAt
  index (conversationId, createdAt)     -- ana spec'te zaten var

Review                                   -- ana spec §3 + karar #5
  id, listingId → Listing, authorId → User,
  bookingId (unique) → BookingRequest,
  rating: int (1–5), comment?: text, createdAt
+ updatedAt: DateTime?                  -- tam CRUD (düzenleme)
+ ipAddress: String?                    -- yazar IP'si (moderasyon izi; §9 KVKK notu)
  -- silme: HARD DELETE (yazar veya ADMIN)

Report                                   -- ana spec §3 + updatedAt
  id, reporterId → User, targetType: LISTING | USER, targetId: string,
  reason: text, status: OPEN | REVIEWING | CLOSED, createdAt
+ updatedAt: DateTime?

Setting (YENİ)                          -- çalışma-zamanı anahtarları
  key: String @id
  value: Json
  updatedAt: DateTime
  -- "reviewsEnabled" → admin genel yorum anahtarı (satır yoksa default: true)
```

**Migration geçişleri:**
- `User.emailVerified`: migration mevcut satırları `now()` ile **backfill** eder (Plan 1 hesapları kilitlenmesin). Yeni kayıtlar `null` başlar.
- `Setting` boş başlar; getter `?? true` ile default uygular (seed bağımlılığı yok).
- Seed hesapları `emailVerified: now()` yazılır.

---

## 3. Kimlik ve Güvenlik

### 3.1 Rol/ban tazeliği (C yaklaşımının somut hâli)

Doğrulanmış gerçek: Auth.js v5'te `callbacks.jwt` JWT stratejisinde **her sunucu tarafı `auth()` çağrısında** çalışır (`updateAge` yalnız DB stratejisi write throttling'ini etkiler — kaynak: next-auth `lib/actions/session.ts`).

1. **Claim tazeleme (asıl onarım):** `jwt` callback'inde her çağrıda DB'den `{ role, isBanned, emailVerified }` okunur → token claim'leri tazelenir. `isBanned === true` ise callback `null` döner → `auth()` null → oturum düşmüş sayılır (bir sonraki istekte banlı admin/üye yetkisiz). `role` DB'den gelir → `ADMIN→USER` değişikliği anında geçerlidir.
2. **Kısa token:** `session.maxAge = 7 gün` (varsayılan 30 günden kısa; çalıntı/idle çerez maruziyeti sınırı). Sliding yenileme Auth.js'in `/api/auth/session` çağrısında cookie'yi tazelemesiyledir; header'ın client `useSession`'a çevrilmesi bu çağrıyı periyodik tetikler (§5). Davranış E2E ile doğrulanır.
3. **Middleware:** edge'de DB yok — token claim'leri + `exp` ile erken UX kontrolü (mevcut davranış korunur). **Asıl garanti 1. maddededir.**
4. **Test edilecek garanti:** banlama sonrası bir sonraki gate'li istekte oturum düşer; rol düşürme bir sonraki istekte yetkiyi alır.

### 3.2 Kayıt e-posta doğrulama (kayıt linki)

1. E-posta+şifre kaydı → `User.emailVerified: null` + **HMAC-imzalı doğrulama linki** e-postası: payload `{email, exp}` (AUTH_SECRET ile imza, 24 saat, stateless — tablo yok).
2. `/dogrula` route'u: imza/expiry doğrular → `emailVerified: now()` → "doğrulandı, giriş yapabilirsiniz". Geçersiz → hata + yeniden gönder seçeneği. Zaten doğrulanmışsa "zaten doğrulandı" (stateless token tek kullanımlık DEĞİLDİR — emailVerified hâli idempotent korur).
3. **Giriş kapısı:** `verifyCredentials` doğrulanmamış hesapta **fail** — "E-postanız doğrulanmamış." + yeniden gönderme butonu (kayıt mailini tekrar yollar, yeni imza).
4. **Google:** sağlayıcı e-postayı doğrulanmış sayar — signin sırasında `emailVerified: null` ise `now()` ile tazelenir; `isBanned` girişi yine engeller (Plan 1).
5. Şifre sıfırlama YOK (kapsam dışı); e-posta adresi profil DEĞİŞTİRMEZ (Plan 1'de yok) — token revokasyonu gerekmez.

---

## 4. Mesajlaşma (ana spec §4.2)

- **Kapı:** `/ilan/[id]` **"Sor"** → `startConversation(listingId)`: `(listingId, renterId)` mevcutsa o sohbet, yoksa oluştur (unique yarışında P2002 → mevcudu oku). İlan sahibi kendi ilanına sohbet başlatamaz; giriş yoksa `/giris?next=…`.
- **Liste:** `/hesap/mesajlar` — konuşmalarım (`renterId = ben OR ownerId = ben`), `lastMessageAt`'e göre azalan, okunmamış sayı: `Message(groupBy conversationId, senderId ≠ ben, readAt null)`. Önizleme `lastMessagePreview`. Sayfa SWR ile **15 sn**'de bir tazelenir.
- **Thread:** `/hesap/mesajlar/[id]` — başlıkta ilan adı + varsa talep durum rozeti (ana spec §4.2). Mesajlar kronolojik (MVP: tam liste; büyüme olursa sayfalama backlog). **SWR 5 sn polling** (ana spec §4.2).
- **Okundu:** thread açılınca `senderId ≠ ben AND readAt IS NULL → readAt: now` (updateMany).
- **Gönderim:** `sendMessage` server action — Zod `1..2000` karakter; **rate-limit `MESSAGE_LIMIT` (20/60 sn — T11 pini)**; üyelik kontrolü (conversation'ın renter/owner'ı); optimistic UI + **SWR 5 sn polling** (ana spec §4.2 — SSE yok).
- **E-posta yok** per mesaj — yalnız günlük özet (§7.1).
- Mimarî: `src/server/messages/{service.ts, actions.ts}` (Plan 1 konvansiyonu: core + thin action, `ActionResult<T>`).

---

## 5. Header (session-aware + çıkış)

- Header client bileşeni `useSession` kullanır: **girişli** → menü: Taleplerim, İlanlarım, Mesajlar [okunmamış rozet], Değerlendirmeler, Profil + **"Çıkış"** (`signOut` → `/`); **değil** → "Giriş Yap" / "Kayıt ol".
- Aynı bileşen §3.1.2'de tarif edilen sliding cookie tazelemesini tetikler (periyodik `/api/auth/session`).
- Sunucu tarafı ilk render'da flash yok; okunmamış rozet hafif bir aksiyon çağrısıyla **15 sn** SWR polling ile tazelenir (thread içi 5 sn'den ayrı, daha ucuz).

---

## 6. Yorumlar (ana spec §3/§6 + karar #5–7)

- **Ön koşul (mevcut, korunur):** yalnız `COMPLETED` + **kendi** talebi + booking başına 1 (`@unique bookingId`).
- **create:** `{ rating: 1..5 (zorunlu), comment?: ≤1000 }` (Zod). `ipAddress` **sunucuda** `headers()` → `x-forwarded-for` ilk IP olarak yazılır — istemciden gelen alan YOK sayılır (spoof koruması).
- **create engeli (anahtarlar):** `Setting("reviewsEnabled") === false` **veya** ilan sahibinin `User.reviewsVisible === false` → fail ("Bu ilan için yorumlar kapalıdır." / genel için ayrı mesaj).
- **read:** ilan detayında ortalama puan + yorum listesi; `/hesap/degerlendirmeler` iki bölüm: **Yazdıklarım** (düzenle/sil butonlu) ve **İlanlarıma yazılanlar** (yalnız görüntüleme).
- **update:** yalnız yazar (`rating`/`comment` + `updatedAt`).
- **delete:** yazar veya **ADMIN** — hard delete.
- **Gösterim guard'ı:** `reviewsEnabled === false` **veya** sahibin `reviewsVisible === false` → ilan detayda yorum bölümü + ortalama **gizlenir** (okuma serbest; gizleme display katmanında).
- **Yıldız:** tam yıldız (yarım yok) — sunucu-tarafı `StarRating` SVG bileşeni; hem formda (1–5 tıklanabilir) hem görünümde.
- **Genel anahtar UI:** `/admin/ayarlar` (requireAdmin, `Setting` write).
- **Sahip anahtarı UI:** `/hesap/profil` (`User.reviewsVisible` toggle).
- Review için ayrı rate-limit YOK (ana spec §5 yalnız mesaj+talep der; ön koşul + unique zaten kötüye kullanımı sınırlar).

---

## 7. E-postalar (ana spec §4.4 güncel hali)

Olay listesi: talep alındı/onaylandı/reddedildi · ilan onaylandı/reddedildi/duraklatıldı · **kayıt doğrulama** · **günlük mesaj özeti** · **konaklama tamamlandı**.

### 7.1 Günlük mesaj özeti (digest)
- Route `/api/cron/digest`, **Vercel cron 09:00 UTC (12:00 TR)** (`vercel.json`'a ekle), `CRON_SECRET` **fail-closed** (mevcut cron kalıbı).
- Kapsam: kullanıcı başına bana gelen, `readAt: null` **ve** `createdAt` 7 günden yeni mesajlar → **tek** e-posta: en fazla 5 konuşma (önizleme + okunmamış sayı) + "Mesajları gör" linki.
- **Okunana kadar ertesi gün tekrar gider, 7 gün sonra susar** — yeni state kolonu gerekmez (`readAt` yeterli). Boşta e-posta gitmez. Cron düşerse 7 günden eskiler atlanır (kabul).
- Kullanıcı başına günde en fazla 1 özet (gönderim koşulundan doğar).

### 7.2 Konaklama tamamlandı (backlog kapanışı)
- Yeni `bookingCompletedTemplate`: "konaklama tamamlandı — deneyiminizi değerlendirin" + ilan linki.
- `completeDueBookings` cron'u bu şablonu kullanır; T5'teki `status: "APPROVED"` pini **şablon ayrıştırılarak** güncellenir (mevcut test davranışı kasten değiştirilir, not düşülür).

---

## 8. Şikayetler

- **Bildir:** `/ilan/[id]` ve profil sayfasında "Bildir" (dialog: `reason` 5–500). Aynı kullanıcı aynı hedefe **OPEN şikayeti varken** tekrar bildiremez (check-then-act; yarış riski MVP'de kabul — not).
- **Hedef:** `targetType: LISTING | USER` — hedef silinmişse "hedef bulunamadı" (kırık link yok).
- **Admin:** `/admin/sikayetler` kuyruğu — rozet, hedefe link, gerekçe, bildiren, tarih. Geçiş matrisi service'te: `OPEN → REVIEWING → CLOSED` (CLOSED geri açılmaz; `updateMany + count===0` kalıbı).
- **Otomatik aksiyon YOK** — admin gerekirse mevcut `/admin/ilanlar` duraklat veya `/admin/kullanicilar` ban araçlarını kullanır (kuyruk satırında pratik link).

---

## 9. Backlog (Plan 1 → Plan 2)

| # | Madde | Çözüm |
|---|---|---|
| 1 | Logout UI yok | §5 header "Çıkış" (`signOut`) |
| 2 | Statik "Giriş Yap" header | §5 session-aware header |
| 3 | PhotoUploader "Kaldır" storage'ı silmiyor | taze yüklenen dosyada `UTApi.deleteFiles([key])`; hata → sessiz yut (best-effort); yerelde token placeholder → testler mock; eski URL'den key türetilir (plan görevi) |
| 4 | JWT rol donması | §3.1 |
| 5 | COMPLETED e-postası APPROVED şablonunu kullanıyor | §7.2 |
| 6 | (README) KVKK notu | `Review.ipAddress` saklama amacını açıklar; retention/temizlik backlog |

---

## 10. Test Stratejisi ve CI (ana spec §6 genişletmesi)

### 10.1 Vitest ekleri (Plan 1 kapısının üstüne)
- **Mesaj:** `MESSAGE_LIMIT` rate-limit; üyelik dışı erişim fail; `(listingId, renterId)` P2002 yarışı; okundu işareti yalnız karşı taraf için; `lastMessageAt/Preview` yazımı.
- **Yorum:** ön koşul (COMPLETED + kendi talebi + unique); **IP sunucuda `headers()`'ten yazılır, istemci payload'ı yok sayılır**; yetki matrisi (yazar update/delete, yabancı fail, admin delete); anahtarlar OFF → create fail; display guard (service/DTO seviyesi); Zod `1..5`/`≤1000`.
- **Şikayet:** duplicate OPEN engeli; hedef doğrulama; durum matrisi (matriste olmayan geçiş fail, mutation yok); yetki.
- **Doğrulama:** imza/expiry/red; Google otomatik doğrulama; doğrulanmadan giriş fail + yeniden gönderme.
- **Auth:** banlama → sonraki `auth()` gate'inde oturum düşer; rol düşürme → yetki kaybı.
- **Ayarlar:** `Setting` yazma `requireAdmin`.

### 10.2 Playwright — 5 senaryo
1. Kiracı: ara → detay → talep gönder → panoda "Bekliyor" (spec §6)
2. Sahip: talebi onayla → karşı tarafta "Onaylandı" (spec §6)
3. Admin: yeni ilanı onayla → aramada görünür (spec §6)
4. Mesajlaşma: ilan detayda "Sor" → mesaj gönder → sahip tarafında görünür + okundu
5. Yorum: COMPLETED fixture → yorum + 1–5 yıldız → ilan detayda görünür

### 10.3 GitHub Actions CI (`.github/workflows/ci.yml`)
- **`check`:** npm ci → `prisma generate` → `tsc --noEmit` → eslint → `vitest run` (service: `postgres:16`, `TEST_DATABASE_URL`, global setup migrate) → `next build`.
- **`e2e`** (`needs: check`): build → `next start` → Playwright (chromium) → 5 senaryo.
- Trigger: push `main` + tüm PR'lar. Vercel preview deploy Vercel tarafı (deploy-time).

### 10.4 Kabul kriteri (ana spec §6 tamamlanır)
`npm run check` yeşil + `npm run build` yeşil + Playwright 5/5 yeşil + CI yeşil — **hiçbiri olmadan "bitti" denmez.**

---

## 11. Açık Notlar / Riskler

- **Sliding cookie** davranışı (§3.1.2) Auth.js'in iç davranışıdır — implementasyonda E2E ile doğrulanır; beklenen sonuç çıkmazsa eklenen client dokunuş (header `useSession`) yeterlidir, ek mekanizma kurulmaz.
- **digest tekrarı** (okunana kadar günlük) bilinçli tercihtir — kullanıcı review'unda değiştirilebilir.
- **IP retention** temizliği MVP'de yok (README notu + backlog).
- **Şikayet check-then-act** yarışı kabul edildi (düşük hacim).
- Dev DB'deki mevcut kullanıcılar `emailVerified` backfill ile kilitlenmez; `designs/` klasörü kapsam dışıdır (root tsconfig/eslint dışı — PR #1, `7b01bca`).
