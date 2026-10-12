# Yönetim Panelleri Yenileme — Tasarım

- **Tarih:** 2026-10-12
- **Konu:** satıcı (sahip), alıcı (kiracı) ve admin panellerinin görünüm + işlevsellik yenilemesi
- **Durum:** Uygulandı — tüm 12 görev tamam, `npm run check` 559 test yeşil, uçtan uca e2e 6/6 yeşil (dal: `feature/panels-redesign`)

## 1. Amaç ve neden

Üç panel bugün hem görünüm hem işlevsellik olarak zayıf:

- **Admin** (`/admin`): sidebar var ama Genel Bakış yalnızca 4 sayaç kartı — kuyruk özeti, son aktivite, hızlı işlem yok.
- **Sahip** ve **alıcı** (`/hesap/*`): gerçek bir panel/dashboard yok. Sayfalar `max-w-3xl` dar kolonda, düz kart listeleri hâlinde; durum sekmeleri, sayaçlar, arama/süzme, tablo görünümü, satır içi toplu bakış yok.
- Sonuç: kullanıcı "ne durumdayım, şimdi ne yapmalıyım" sorusunu tek ekranda yanıtlayamıyor.

Referans alınan estetik/davranış: **TailAdmin** (sidebar + topbar kabuğu, stat kartları, sekmeli tablolar), **CoreUI** (widget'lar, data table, breadcrumb), ThemeForest premium admin template dili. Marka kimliği bizim kalır: villasepeti paleti (turkuaz `#0F6274`, aksan turuncu `#FAA150`) ve Plus Jakarta Sans.

## 2. Hedefler

1. **Tek ortak panel kabuğu**: sol sidebar (rol bazlı menü + sayaç rozetleri + CTA), üst topbar (sayfa içi arama, bildirim rozeti, kullanıcı menüsü), breadcrumb + sayfa başlığı + sağda ana aksiyon. Admin ve `/hesap` aynı kabuğu kullanır.
2. **Her rol için gerçek "Genel Bakış"**: özet istatistik kartları + en kritik liste (sekmeli) + yan widget'lar.
3. **İşlevsellik**: durum sekmeleri + sayaç rozetleri, tablo görünümü, URL query ile sekmelere derin bağlantı, satır içi aksiyonlar (onayla/reddet/iptal/incele), boş durumlarda tek net CTA.
4. **Tutarlı görsel dil**: kartlar, rozetler, tablolar, boş durumlar tek bileşen setinden; mobilde offcanvas sidebar.

## 3. Hedef olmayanlar

- **Favoriler** — platformda favori modeli/özelliği yok; bu fazda eklenmez.
- **Ödeme / gelir grafikleri** — platform hiç para işlemiyor; "gelir" verisi yoktur, gösterilmez.
- **Global arama / bildirim altyapısı** — arama global değildir (bulunduğu listenin sunucu tarafı filtresi); bildirim ikonu e-posta/push göndermez.
- **Grafik kütüphanesi** — yeni chart dependency eklenmez; görselleştirme CSS/SVG mini barlarla.
- **Sayfalama** — bu fazda yok (listeler tam yüklenir; kriter aşağıda).
- **Dark mode**, yeni DB alanları, yeni iş kuralları.

## 4. Anti-hedefler

- Mevcut e2e akışlarını (senaryo 1–5) kırmak.
- Var olan service katmanını/transaction kurallarını yeniden yazmak.
- Native `alert`/`confirm` kullanmak (repo kuralı: modal).
- `/admin` ve `/hesap` URL'lerini değiştirmek.

## 5. Kısıtlar

- Next.js 16.4.0 (App Router, Turbopack); sunucu bileşenleriyle veri çekme öncelikli.
- Tailwind v4 `@theme` tokenları (`globals.css`) — yeni renk/spacing icat edilmez.
- Material Symbols ikonları; Plus Jakarta Sans.
- Her görevde TDD; birleşik kapı `npm run check` 0 uyarı; commit mesajları ASCII.
- Erişilebilirlik: `aria-current` aktif menü, tablo semantiği, odak halkaları, offcanvas klavye kapanışı.

## 6. Onaylanan kararlar (kullanıcı)

- **Kabuk:** "Seçenek A — ortak sidebar kabuğu". Üç panel aynı yapıyı kullanır (mockup onayı 2026-10-12).
- **`/hesap` tek panel:** Şemada "ilan sahibi" rolü yoktur (yalnız `USER`/`ADMIN`); aynı kullanıcı hem satıp hem kiralayabilir. Bu yüzden **herkes aynı süper küme menüyü** görür:
  `Genel Bakış · İlanlarım · Taleplerim · Mesajlar · Değerlendirmeler · Profil`
  (rozetler veriye göre dolar; ilanı olmayan kullanıcıda İlanlarım boş durum CTA'sı, Genel Bakış'ta "İlan ver" bloğu).
  "Sahip panosu / alıcı panosu" ayrımı = aynı panelin veriye bağlı görünümleri; iki ayrı panel DEĞİL.
- **Palet/tipografi:** villasepeti paleti + Plus Jakarta Sans korunur.
- **Sekmeler:** URL query ile (`?durum=…`, `?q=…`), sunucu tarafı filtre; geri tuşu ve paylaşılabilir link çalışır.

## 7. Tasarımcının karara bağladığı çağrılar

Bunlar builder-check sorularına verilen ve bu dokümanla sabitlenen kararlardır (kullanıcı okurken veto edebilir):

1. **Panel kabuğu site header/footer'ını kaldırır.** Onaylanan mockup'ta panel sayfalarında site başlığı/altlığı yok; sidebar + topbar tek kabuktur. Teknik yol: panel rotalarını route group'a alıp koşullu chrome (ör. `(panel)` grubu) ya da kök layout'ta koşullu render. Admin'in mevcut `lg:top-20` ofseti ve `pt-20` boşluğu buna göre sadeleşir.
2. **Testlerde DOM sözleşmesi iddiaları bilinçli güncellenir; akışlar korunur.** Şu iddialar yeni UI ile çelişecek ve aynı görevde güncellenecek: `scenario-1/2`'nin aynı anda iki bölümü (`Gelen Talepler` + `Giden Taleplerim`) ve `listitem` satırları; `scenario-3`'ün aynı anda iki admin bölümü; `tests/app/admin/page.test.tsx`'in "tam 4 `a.card`" iddiası; `tests/components/AccountNav.test.tsx` (bileşen kalkıyor). Akışların kendisi (senaryo 1–5) bozulmaz.
3. **Admin kullanıcı sekmeleri:** `Tümü · Aktif · Banlı` (sayaçlı); rol ve ban bilgisi kolon/rozet olarak korunur.
4. **Arama sunucu taraflıdır (`?q=`), sayfalama bu fazda yoktur.** Paylaşılan kabuk, sayfanın verisini göremez; bu yüzden arama kutusu her listenin kendi başlık alanında render edilir (topbar'da değil). Admin ilanlar'daki 50 kayıt sınırı kaldırılır. Listeler MVP ölçeğinde tam yüklenir; büyüme hâlinde sonraki fazda sayfalama + `?q=` zaten aynı kanalı kullanır.
5. **Sayaç tazeliği ve performans:** Sayaçlar `layout` içinde sunucuda hesaplanır (dar `count` sorguları). Mesaj rozeti mevcut `/api/messages/unread-count` (SWR) ucunu kullanır. Satır içi aksiyonlardan sonra `router.refresh()` (mevcut kalıp) ile rozetler ve listeler tazelenir.

## 8. Bilgi mimarisi ve içerik

### `/hesap` (tüm kullanıcılar — tek panel)
Menü: **Genel Bakış**, **İlanlarım** (rozet: toplam), **Taleplerim** (rozet: bekleyen), **Mesajlar** (rozet: okunmamış), **Değerlendirmeler**, **Profil**; alt CTA **+ Yeni İlan**; "Siteye dön".

- **Genel Bakış**: stat kartları (Yayında ilan, Bekleyen talep, Okunmamış mesaj, Ortalama puan) + "Gelen talepler" sekmeli tablosu (satır içi Onayla/Reddet) + yan widget'lar (ilan durum dağılımı mini barları, son mesajlar). Kullanıcının ilanı yoksa "Gelen talepler" yerine **İlan ver** CTA bloğu; buna karşılık "Taleplerim (giden)" özeti her zaman gösterilir.
- **İlanlarım**: durum sekmeleri (Tümü / Taslak / İncelemede / Yayında / Askıda / Reddedildi) sayaçlı; tablo (başlık, şehir, fiyat/gece, kapasite, durum, aksiyonlar, Geçmiş).
- **Taleplerim**: ana sekmeler **Gelen / Giden**, alt durum filtreleri (Bekleyen / Onaylı / Geçmiş…); satır içi aksiyonlar mevcut `BookingActions` (Onayla/Reddet/İptal).
- **Mesajlar / Değerlendirmeler / Profil**: içerik mevcut işlevselliğiyle kabuğa taşınır.

### `/admin`
Menü: **Genel Bakış**, **İlanlar** (rozet: bekleyen), **Kullanıcılar**, **Şikâyetler** (rozet: açık), **Ayarlar**.

- **Genel Bakış**: 4 stat kartı (Bekleyen ilan, Aktif ilan, Kullanıcı, Açık şikâyet) + "Moderasyon kuyruğu" sekmeli tablosu (İncele) + "Son aktivite" akışı + "Şikâyet kuyruğu" mini listesi.
- **İlanlar / Kullanıcılar / Şikâyetler**: durum sekmeleri + arama; mevcut detay sayfaları korunur.
- **Ayarlar**: kabuğa taşınır.

## 9. İşlevsellik envanteri (yeni/değişen)

- **Sayaç sorguları** kabukta (sunucu) bir kez; role göre dar `count` sorguları.
- **Sekmeler**: `searchParams` ile sunucu tarafı filtre; sayfalama yok (bkz. §7.4).
- **Tablolar**: masaüstünde tablo, mobilde kart listesi (tek veri, iki sunum).
- **Boş durumlar**: ikon + tek cümle + tek CTA.
- **Aksiyonlar**: mevcut server action'ları yeniden kullanılır; geri bildirim modal.
- **Offcanvas sidebar**: mobilde hamburger; klavye ile kapanır, `aria-expanded`/`aria-controls`.

## 10. Test stratejisi

- **Unit**: sekmelerin query→filtre eşlemesi, sayaç/etiket yardımcıları, boş durum dalları (saf fonksiyonlar önce kırmızıya düşürülür).
- **Bileşen**: PanelSidebar (aktif öğe + rozet), StatusTabs (sayaç + seçim), EmptyState, tablo↔kart sunumu.
- **E2E**: mevcut senaryo 1–5 **akış olarak** geçer (DOM sözleşmesi iddiaları §7.2'ye göre güncellenir). Yeni senaryo: `/hesap` Genel Bakış → Gelen talepler → satır içi "Onayla" → durum güncellenir; sekmelerin URL ile derin bağlanması.
- **Kapı**: `npm run check` 0 uyarı; `npm run build` yeşil.

## 11. İnşa için açık bırakılanlar (builder kararı)

- Bileşen dosya adları/klasörleme (örnek: `src/components/panel/…`), paylaşılan tipler.
- Route group adı ve layout yerleşimi.
- Sekme query parametre adları ve varsayılan sekmeler.
- Tablo↔kart kırılım noktaları (Tailwind breakpoint seçimi).
- Admin "son aktivite" akışının veri kaynağı (mevcut tablolardan türetilir; yeni DB alanı yok).
- **Branch/PR stratejisi**: PR #17 hâlâ açık; önerim ayrı branch + PR (base `feature/karavan-mvp`) — PR #17 kapsamı kirletilmez.

## 12. Kabul kriterleri

1. Üç panelde de ortak kabuk: sidebar (rol bazlı, sayaç rozetli, aktif işareti), topbar, breadcrumb+başlık+aksiyon.
2. `/hesap` Genel Bakış (tek panel, veriye uyarlanan sahip/alıcı blokları); admin widget'lı dashboard.
3. Listelerde sayaçlı durum sekmeleri + URL derin bağlantı; arama sunucu tarafı `?q=`.
4. Mobilde offcanvas sidebar; tablolar mobilde kart olarak okunur.
5. Boş durumlarda tek net CTA; satır içi aksiyonlar mevcut iş kurallarını kullanır.
6. Mevcut senaryo 1–5 akışları + en az bir yeni panel e2e senaryosu yeşil; `npm run check` 0 uyarı, `npm run build` yeşil.

## 13. Ek: doğrulanan bağlam (bu çalışmada öğrenildi)

- CI'da e2e kırığı birkaç commit'tir sürüyordu; iki kök neden bu çalışmada düzeltildi (ilan detay form kapısı + `Değerlendirmeler` bölüm adı). Bu iş koluna başlarken e2e'nin yeşil olduğundan emin olunmalı.
- CI'daki `validation_error` log'u sahte Resend anahtarından (401) gelir; zararsızdır.
- Yerelde e2e koşarken `npx playwright` sarmalayıcısı takılabiliyor; `node node_modules/@playwright/test/cli.js test --config tests/e2e/playwright.config.ts` güvenilir çalışıyor.
