Karavan — Design System v1.0
1. Görsel tema

Özgürlük + doğa + güven. Fotoğraf öncelikli, sıcak nötr zemin (#FAF9F6) üzerindebeyaz yüzeyler. Dekorasyonsuz: gradient, glassmorphism, neon ve emoji yok.Hareket yalnızca işlevsel (hover, modal giriş, skeleton shimmer).
2. Renk tokenları (CSS değişkenleri: --forest-*, --sage-*, --orange-*, --bg, --surface, --text, --border, --success/warning/danger/info)

    Primary #234B3B (hover #2C5C49): ana CTA, aktif nav, link vurgusu
    Secondary #829985: ikonlar, ikincil bilgi, soft yüzey #EAF0EB
    Accent #E58B52: yalnızca vurgu CTA + sayısal vurgu; üzerinde koyu metin (#1B3329) kullanılır, beyaz metin kontrastı yetersiz
    Durumlar: success #22734A, warning #9A6A0B, danger #B23A2E, info #2C6486 (+ her biri -bg/-bd varyantı)
    Focus ring: #2F6B52, 2px outline + 3px soft halo

3. Tipografi — Figtree (system-ui fallback, Türkçe karakterler tam)

H1 clamp(1.9–3.4rem)/800 · H2 clamp(1.4–1.75rem)/700 · H3 1.125rem/700 ·body .9375–1rem/400 lh1.6 · small .8125–.875rem · label/button .8125–.9375rem/600–700.Fiyat/tarih/tablolarda tabular-nums.
4. Bileşen kuralları

Butonlar: primary/secondary/outline/ghost/destructive/accent (+sm 36px, lg 52px;min yükseklik 44px). Her etkileşimli bileşende default/hover/focus-visible/active/disabled/loading durumu zorunlu. Badge'ler: b-green (olumlu), b-amber (bekliyor),b-red (hata/ret), b-gray (nötr/iptal), b-sage (duraklatılmış), b-orange (vurgu).Input hata: kırmızı kenarlık + alan altında .f-err mesajı.
5. Yerleşim

Spacing: 4/8/12/16/24/32/48/64. Konteyner 1240px. Ana sayfa 3 kolon grid (mobil 1,tablet 2); arama 264px filtre + liste; detay 1fr + 380px rezervasyon paneli;formlar max ~800px. Beyaz alan içerik yoğunluğundan önce gelir.
6. Derinlik

L1 kart: 1px border + radius 16, gölgesiz · L2 (arama barı, rezervasyon kartı): --sh-md· L3 (modal/drawer/dropdown/toast): --sh-lg. Radius: 8/12/16/22. Hover'da yalnızcagölge + 2px translateY; scale/parlak yok.
7. Yap / Yapma

Yap: token kullan, tek birincil CTA/ekran, gerçek Türkçe içerik, tüm durumları tasarla,next/image + fallback. Yapma: sayfa başına farklı radius/gölge, her şeyi kartla,içerik dışı dekor, i̇şlevsiz buton, ödeme/komisyon simülasyonu (MVP talep-onay modelidir).
8. Breakpoint davranışı

360–390: tek kolon, arama dikey yığın, filtre alt çekmece, tablo→data-l kart, sabit alt CTA(detay). 768: 2 kolon, yatay galeri + dots, yatay hesap nav. 1024: filtre/rezervasyon sticky.1440+: 1240px konteyner. Dokunma ≥44px; klavye + görünür focus zorunlu.
9. Ajan kural özeti

Renkleri yalnız token'dan al · radius/shadow yalnız 4 değerden · bir ekranda tek primarybuton · Türkçe UI / İngilizce kod · server component varsayılan, "use client" yalnızetkileşimde · mock yok: mevcut server action + Prisma verisi.
Next.js'e taşıma haritası (referans dosya → gerçek proje)
Referans blok
	
Hedef
:root token'ları + temel stiller	src/app/globals.css (Tailwind v4 @theme ile eşle)
Navbar/footer, Button, Input, Badge, EmptyState, Skeleton, Pagination, Modal, Toast, Lightbox, Avatar	src/components/ui/* (delegasyon yerine normal prop'lu bileşenler)
cardHTML	ListingCard (next/image, sizes, fallback bileşeni)
pageSearch + filtersHTML	/arama server page + client SearchFilters (URL searchParams kaynağı)
f-booking + reqOverlapErr	/ilan/[id] client form → mevcut talep server action'ı; çakışma kontrolü server'da
Çok adımlı form	/hesap/ilanlarim/yeni + /duzenle/[id] (Zod şemaları adım bazlı)
Talepler/admin akışları	Mevcut server action'lar; ConfirmDialog + red gerekçesi modalı aynı korunur