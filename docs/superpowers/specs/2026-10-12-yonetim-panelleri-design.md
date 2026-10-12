# Yönetim Panelleri Yenileme — Tasarım

- **Tarih:** 2026-10-12
- **Konu:** satıcı (sahip), alıcı (kiracı) ve admin panellerinin görünüm + işlevsellik yenilemesi
- **Durum:** Kullanıcı onaylı yön (mockup: ortak sidebar kabuğu — "Seçenek A"), inşa öncesi doküman

## 1. Amaç ve neden

Üç panel bugün hem görünüm hem işlevsellik olarak zayıf:

- **Admin** (`/admin`): sidebar var ama Genel Bakış yalnızca 4 sayaç kartı — kuyruk özeti, son aktivite, hızlı işlem yok.
- **Sahip** ve **alıcı** (`/hesap/*`): gerçek bir panel/dashboard yok. Sayfalar `max-w-3xl` dar kolonda, düz kart listeleri hâlinde; durum sekmeleri, sayaçlar, arama/süzme, tablo görünümü, satır içi toplu bakış yok. Alıcı ve sahip aynı "Hesabım" gezinmesini paylaşır, roller arasında hiçbir görsel/davranışsal ayrım yok.
- Sonuç: kullanıcı "ne durumdayım, şimdi ne yapmalıyım" sorusunu tek ekranda yanıtlayamıyor.

Referans alınan estetik/davranış: **TailAdmin** (sidebar + topbar kabuğu, stat kartları, sekmeli tablolar), **CoreUI** (widget'lar, data table, breadcrumb), ThemeForest premium admin template dili. Marka kimliği bizim kalır: villasepeti paleti (turkuaz `#0F6274`, aksan turuncu `#FAA150`) ve Plus Jakarta Sans.

## 2. Hedefler

1. **Tek ortak panel kabuğu**: sol sidebar (rol bazlı menü + sayaç rozetleri + CTA), üst topbar (sayfa içi arama, bildirim rozeti, kullanıcı menüsü), breadcrumb + sayfa başlığı + sağda ana aksiyon. Admin ve `/hesap` aynı kabuğu kullanır; yalnız menü ve içerik role göre değişir.
2. **Her rol için gerçek "Genel Bakış"**: özet istatistik kartları + en kritik liste (sekmeli) + yan widget'lar.
3. **İşlevsellik**: durum sekmeleri + sayaç rozetleri, tablo görünümü, URL query ile sekmelere derin bağlantı, satır içi aksiyonlar (onayla/reddet/iptal/incele), boş durumlarda tek net CTA.
4. **Tutarlı görsel dil**: kartlar, rozetler, tablolar, boş durumlar tek bileşen setinden; mobilde offcanvas sidebar.

## 3. Hedef olmayanlar

- **Favoriler** — platformda favori modeli/özelliği yok; bu fazda eklenmez (kullanıcı isterse ayrı iş).
- **Ödeme / gelir grafikleri** — platform hiç para işlemiyor; "gelir" verisi yoktur, gösterilmez.
- **Global arama / bildirim altyapısı** — topbar araması global arama yapmaz; bildirim ikonu e-posta/push göndermez (ikon ilgili listeye sayaçla bağlanır).
- **Grafik kütüphanesi** — yeni chart dependency eklenmez; gereken görselleştirme CSS/SVG mini barlarla yapılır.
- **Dark mode**, yeni DB alanları, yeni iş kuralları, ödeme/mesajlaşma mantığına dokunma.

## 4. Anti-hedefler

- Mevcut e2e akışlarını (senaryo 1–5) kırmak.
- Var olan service katmanını/transaction kurallarını yeniden yazmak.
- Native `alert`/`confirm` kullanmak (repo kuralı: modal).
- `/admin` ve `/hesap` URL'lerini değiştirmek (dış linkler/yer imleri korunur).

## 5. Kısıtlar

- Next.js 16.4.0 (App Router, Turbopack); sunucu bileşenleriyle veri çekme tercih edilir.
- Tailwind v4 `@theme` tokenları (`globals.css`) — yeni renk/spacing icat edilmez.
- Material Symbols ikonları; Plus Jakarta Sans.
- Her görevde TDD; birleşik kapı `npm run check` (prisma generate + typegen + tsc + eslint + vitest) 0 uyarı ile geçer; commit mesajları ASCII.
- Erişilebilirlik: `aria-current` aktif menü, tablo semantiği (`th`/`scope`), odak halkaları, offcanvas için klavye kapanışı.

## 6. Onaylanan kararlar

- **Kabuk:** "Seçenek A — ortak sidebar kabuğu" (mockup onayı, 2026-10-12). Üç panel de aynı yapıyı kullanır.
- **Palet/tipografi:** villasepeti paleti + Plus Jakarta Sans korunur.
- **Genel Bakış sayfaları:** sahip ve alıcı için yeni `/hesap` dashboard'u; admin dashboard'u widget'larla genişletilir.
- **Sekmeler:** URL query ile (örn. `?durum=pending`), sunucu tarafında filtre; geri tuşu ve paylaşılabilir link çalışır.
- **Bildirim ikonu:** rozet + ilgili listeye link (dropdown yok).
- **Topbar araması:** bulunduğu listenin sayfa-içi (istemci) filtresi; global arama yok.

## 7. Bilgi mimarisi (rol bazlı menü ve içerik)

### Sahip (satıcı) — `/hesap`
Menü: **Genel Bakış**, **İlanlarım** (rozet: toplam), **Taleplerim** (rozet: bekleyen gelen), **Mesajlar** (rozet: okunmamış), **Değerlendirmeler**, **Profil**; alt CTA **+ Yeni İlan**; "Siteye dön".

- Genel Bakış: stat kartları (Yayında ilan, Bekleyen talep, Okunmamış mesaj, Ortalama puan) + "Gelen talepler" sekmeli tablosu (satır içi Onayla/Reddet) + yan widget'lar (ilan durum dağılımı barları, son mesajlar).
- İlanlarım: durum sekmeleri (Tümü / Taslak / İncelemede / Yayında / Askıda / Reddedildi) sayaçlı; tablo (başlık, şehir, fiyat/gece, kapasite, durum, aksiyonlar, Geçmiş).
- Taleplerim: ana sekmeler **Gelen / Giden**, alt durum filtreleri; satır içi aksiyonlar mevcut `BookingActions` ile (Onayla/Reddet/İptal).
- Mesajlar / Değerlendirmeler / Profil: içerik mevcut işlevselliğiyle kabuğa taşınır.

### Alıcı (kiracı) — `/hesap`
Menü: **Genel Bakış**, **Taleplerim** (rozet: bekleyen), **Mesajlar** (rozet: okunmamış), **Değerlendirmeler**, **Profil**; alt CTA **Karavan Ara** (`/arama`).

- Genel Bakış: stat kartları (Giden talep, Onaylanan, Bekleyen yanıt, Okunmamış mesaj) + "Taleplerim" sekmeli tablosu (İptal / Mesajlaş) + Mesajlar + "Yaklaşan konaklama" kartı (onaylı, en yakın başlangıç).
- Taleplerim: durum sekmeleri (Bekleyen / Onaylı / Geçmiş).
- Diğer sayfalar kabuğa taşınır.

### Admin — `/admin`
Menü: **Genel Bakış**, **İlanlar** (rozet: bekleyen), **Kullanıcılar**, **Şikâyetler** (rozet: açık), **Ayarlar**.

- Genel Bakış: 4 stat kartı (Bekleyen ilan, Aktif ilan, Kullanıcı, Açık şikâyet) + "Moderasyon kuyruğu" sekmeli tablosu (İncele) + "Son aktivite" akışı + "Şikâyet kuyruğu" mini listesi.
- İlanlar / Kullanıcılar / Şikâyetler: durum sekmeleri + sayfa içi arama; mevcut detay sayfaları korunur.
- Ayarlar: kabuğa taşınır.

## 8. İşlevsellik envanteri (yeni/değişen)

- **Sayaç sorguları** kabukta (sunucu) bir kez çalışır; role göre dar kapsamlı `count` sorguları.
- **Sekmeler**: `searchParams` ile sunucu tarafı filtre; sayfalama varsa korunur.
- **Tablolar**: masaüstünde tablo, mobilde kart listesi (tek veri, iki sunum).
- **Boş durumlar**: ikon + tek cümle + tek CTA.
- **Aksiyonlar**: mevcut server action'ları yeniden kullanılır; geri bildirim modal (native değil).
- **Offcanvas sidebar**: mobilde hamburger; klavye ile kapanır, `aria-expanded`/`aria-controls`.

## 9. Test stratejisi

- **Unit**: sekmelerin query→filtre eşlemesi, sayaç/etiket yardımcıları, boş durum dalları (saf fonksiyonlar önce kırmızıya düşürülür).
- **Bileşen**: PanelSidebar (aktif öğe + rozet), StatusTabs (sayaç + seçim), EmptyState, tablo↔kart responsive davranışı (semantik/sınıf iddiası).
- **E2E**: mevcut senaryo 1–5 **bozulmadan** geçer (regresyon yok). En az bir yeni senaryo: sahip panelinden Genel Bakış → Gelen talepler sekmesi → satır içi "Onayla" → durum güncellenir; ayrıca sekmelerin URL ile derin bağlanması.
- **Kapı**: `npm run check` 0 uyarı; `npm run build` yeşil.

## 10. İnşa için açık bırakılanlar (builder kararı)

- Bileşen dosya adları/klasörleme (örnek: `src/components/panel/…`), paylaşılan tipler.
- `/hesap` için route group kullanımı ve layout yerleşimi (mevcut `AccountNav` kaldırılır/shell'e dahil edilir).
- Sekme query parametre adları ve varsayılan sekmeler.
- Tablo↔kart kırılım noktaları (Tailwind breakpoint seçimi).
- Admin "son aktivite" akışının veri kaynağı (hangi tablolardan türetileceği) — yeni DB alanı eklenmez.
- **Branch/PR stratejisi**: PR #17 (villasepeti redesign) hâlâ açık; önerim bu iş için ayrı bir branch + PR (base `feature/karavan-mvp`), böylece PR #17 kapsamı kirletilmez.

## 11. Kabul kriterleri

1. Üç panelde de ortak kabuk: sidebar (rol bazlı, sayaç rozetli, aktif işareti), topbar, breadcrumb+başlık+aksiyon.
2. Sahip ve alıcı `/hesap` Genel Bakış sayfaları; admin widget'lı dashboard.
3. Sahip/alıcı/admin listelerinde sayaçlı durum sekmeleri + URL derin bağlantı.
4. Mobilde offcanvas sidebar; tablolar mobilde kart olarak okunur.
5. Boş durumlarda tek net CTA; satır içi aksiyonlar mevcut iş kurallarını kullanır.
6. Mevcut tüm testler + en az bir yeni panel e2e senaryosu yeşil; `npm run check` 0 uyarı, `npm run build` yeşil.
