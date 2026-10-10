# Karavan Design System

## 1. Visual Theme & Atmosphere
**Modern açık hava seyahat editoryali** ile seçkin konaklama pazaryeri arasında duran; doğaya yakın, özenli ve sakin bir arayüz. Fotoğraf ana hikâyeyi taşır, metin ise güven için gerekli somut bilgileri sade biçimde sunar. Hedef atmosfer: yola çıkmadan önce haritaya bakılan, acele ettirmeyen ama seçimi kolaylaştıran bir Karavan deneyimi. Emojisiz, yüksek okunabilirlikli Türkçe arayüz.

Üç ana ilke: (1) Önce gerçekçi fotoğraf ve açıklayıcı ilan verisi, sonra dekorasyon. (2) Güven kanıtlanmamış rozetlerle değil; araç, kural, fiyat ve talep sürecinin şeffaflığıyla kurulur. (3) Her ekranda birincil eylem belirgindir; görsel boşluk işlevseldir. Dördüncü kontrol ilkesi: bütün arayüzler klavye, dokunma ve azaltılmış hareket tercihine saygılıdır.

## 2. Color Palette & Roles
| Token | Değer | Kullanım |
|---|---|---|
| Forest / primary | `#234B3B` | Ana CTA, logo, seçili durum, koyu yüzey |
| Forest deep | `#18382C` | Hover ve en koyu marka yüzeyi |
| Sage | `#829985` | İkincil doğa tonu; dekoratif arka plan |
| Sage pale | `#EDF2EC` | Seçili/ikincil yüzey, ikon alanı |
| Amber | `#E58B52` | Az kullanılan sıcak ikon/nokta vurgusu; küçük metinde tek başına değil |
| Amber deep | `#8F4F20` | Amber yumuşak yüzeyi üzerindeki vurgu metni |
| Paper | `#FAF9F6` | Ana sayfa zemini |
| White | `#FFFFFF` | Kart ve form yüzeyleri |
| Ink | `#202722` | Ana metin |
| Muted | `#66716A` | Yardımcı metin ve label |
| Faint | `#89918C` | Dekoratif/düşük öncelikli metin; anlam taşımayan tek gösterge olmamalı |
| Border | `#E4E7E3` | Ayırıcı ve form kenarı |
| Success | `#21643D` / `#E8F4EB` | Başarı etiketi: koyu metin / yumuşak yüzey |
| Warning | `#8A5600` / `#FFF4D8` | Bekleyen/uyarı durumu |
| Error | `#B42318` / `#FDECEA` | Hata/yıkıcı eylem |
| Info | `#245B83` / `#EAF3FA` | Bilgilendirme |
| Disabled | `#929B94` / `#F0F2EF` | Pasif kontrol; disabled niteliği ve metinle desteklenir |
| Focus | `#2563EB` | 2px görünür klavye odak halkası |

Renk tek başına anlam taşımaz; durumlarda metin/ikon da bulunur. `#E58B52` küçük beyaz metin zemini değildir. Birincil CTA'da forest üzerine beyaz metin kullan. Error/success gibi durum metinleri, ilgili açık tonlu yüzey üzerinde koyu semantik renkle eşleşir. Odak halkası arka plan ve bileşen ayrımını görünür kılacak şekilde 2px ve offset kullanır.

## 3. Typography Rules
Yerel `@fontsource-variable/manrope` paketinden **Manrope Variable 400–800**. Başlık ve gövde aynı ailede; belirgin hiyerarşi ağırlık, ölçü ve satır yüksekliğiyle kurulur. `ui-sans-serif, system-ui, sans-serif` fallback Türkçe karakterleri destekler.

| Stil | Desktop | Mobile | Ağırlık / kullanım |
|---|---:|---:|---|
| Display/H1 | 60–70 / 1.04 | 42–48 / 1.08 | 800, yalnız hero/ana başlık |
| H1 sayfa başlığı | 40–48 / 1.12 | 32–36 / 1.15 | 800 |
| H2 | 30–32 / 1.2 | 26–28 / 1.25 | 700–800 |
| H3 | 20–22 / 1.3 | 18–20 / 1.35 | 700 |
| Body | 16 / 1.65 | 15–16 / 1.6 | 400–500 |
| Small | 14 / 1.5 | 14 / 1.5 | 400–600 |
| Caption / label | 12 / 1.5 | 12 / 1.5 | 600–800; kısa, okunur |
| Button | 14 / 1.4 | 14 / 1.4 | 700; cümle biçiminde |

Fiyat ve adetlerde tabular-number kullan. Bir paragrafta 65–75 karakter civarında satır uzunluğu hedefle. Gerekmedikçe büyük harfli uzun cümleler veya tracking kullanma.

## 4. Component Stylings & States
- **Button:** pill radius; primary forest/white, secondary sage pale/forest, outline white/border, ghost nötr, destructive error. Dokunma alanı en az 44px. Hover renk değişimi 150ms; disabled hem soluk hem gerçekten devre dışı.
- **Input/select/date/textarea:** beyaz yüzey, 1px `line`, 12px radius; label kalıcı görünür, placeholder tek başına label değildir. Focus forest kenar + düşük yoğunluklu ring; hata label altında kısa Türkçe açıklama ve `aria-invalid`; success/info mesajı form sonrası görünür.
- **Checkbox/radio:** native klavye davranışı korunur; seçilme şekli yalnız renkle değil işaretle de görünür.
- **ListingCard:** köşeler 22–24px; 4:3'e yakın crop; demo etiketi; şehir, kapasite, yatak, araç tipi ve gecelik fiyat. Rating/review iddiası kullanılmaz.
- **PhotoGallery / PhotoUploader:** gerçek preview, seçili fotoğrafın outline'ı, alt metin; upload tip/boyut adet kurallarını inline açıkla; demo upload'ın yalnızca tarayıcıda olduğu belirtilir.
- **Badge:** kısa durum + semantik ton; anlamı renk olmadan da metinde açık.
- **SearchFilters:** masaüstü kalıcı panel; mobil filtre dialog/drawer; temizle ve sonuçları göster kontrolü.
- **EmptyState/Skeleton:** sonuçla aynı sayfa ölçüsü, kısa açıklama ve uygun eylem. Loading için `aria-busy`, boş durum için nötr ikon/işaret.
- **Alert/toast/ConfirmDialog:** rol ve başlık erişilebilir; yıkıcı/önemli demo işlemlerinde önce vazgeç/uygula; mesaj hangi verinin etkilendiğini açıklar.
- **Pagination:** aktif sayfa `aria-current`; önceki/sonraki pasifse tab sırasından çıkar.
- **Avatar:** gerçek kullanıcı fotoğrafı verilmediyse baş harfli nötr avatar.
- **Navbar/footer:** marka işareti ve kısa navigasyon; mobilde aç/kapat etiketli menü; footer örnek veriye dair sınır notunu taşır.

## 5. Layout Principles
- `page-container`: mobilde ekran genişliği eksi 20px (çok dar ekranda), geniş masaüstünde en çok 1312px; merkezleme yalnız hizalama aracı, her bölüm aynı kart ızgarasına sıkıştırılmaz.
- Ana sayfa hero: editoryal asimetrik iki kolon, metin/arama ve fotoğraf arasında görsel ağırlık dengesi; arama kontrolü küçük ekranda tam genişlik ve dikey akış.
- Arama: masaüstünde yaklaşık 250px filtre paneli + esnek sonuç listesi; mobilde filtre dialog ve 2 kolon kart (çok dar ekranda 1 kolon).
- İlan detayı: geniş fotoğraf galerisi; bilgiler sol akış, fiyat/talep özeti masaüstünde yaklaşık 360px yapışkan yan panel, mobilde içerik sonrası tam genişlik.
- Üye paneli: 240px kenar navigasyonu + esnek çalışma alanı. Admin paneli daha sıkı; başlık, filtre, görünür tablo/aksiyon önceliği.
- Spacing ölçeği: 4, 8, 12, 16, 24, 32, 48, 64px. Kart radius 22–24px, form alanı 12px, tam kapsül yalnız küçük chip/button.

## 6. Depth & Elevation
Katman sayısı düşük tutulur: zemin `paper`, ana yüzey `white`, ayrım `line`; kartlar varsayılan olarak gölgesiz veya `0 10px 28px rgb(35 75 59 / 8%)`; yalnız hero/search ve açılır diyalog daha belirgin `0 18px 48px rgb(32 39 34 / 10%)`. Gölgeler border yerine ana ayrım aracı yapılmaz. Dropdown/drawer/dialog en üst etkileşim katmanında; sticky header ve detay sidebar z-index ile örtüşmez.

## 7. Do's & Don'ts
**Do:** örnek ilanı `Örnek ilan`/`Demo görünümü` diye işaretle; fiyat, yaş, ehliyet, minimum geceyi açık yaz; Türkçe alan adları ve hatalar kullan; gerçek başarı mesajı yerine hangi işlem yapılmadıysa onu da belirt; fotoğraf alt metni yaz; görünür focus ve reduced motion uygula.

**Don't:** ödeme/komisyon/kart alanı, gerçek OAuth varmış gibi buton, sahte yıldız/yorum/doğrulama sayısı, harita/favori/mesaj/şikayet özelliği, boş çalışmayan CTA, emoji, dekoratif animasyon, yanlış/aynı fotoğrafı farklı ilanlarda tekrarlama, küçük turuncu metin, sahipsiz form input'u veya onaysız silme aksiyonu ekleme.

## 8. Responsive Behavior
| Görünüm | Davranış |
|---|---|
| 360–390px | 20px yan boşluk, tek kolon hero/metin, form dikey, kart 1–2 kolon, filter drawer, tablolar kartlaştırılır; 44px hedef |
| 640–767px | 2 kolon ilan kartı; başlıklar ölçülü küçülür; yatay overflow yok |
| 768–1023px | 2 kolon içerik, mobil/nav düzeni; filtre drawer veya dar panel, detay fiyat formu tam genişlik |
| 1024–1439px | Masaüstü navigasyon; aramada sol filtre; ilanda galeri ve sticky fiyat paneli; hesapta kenar nav |
| 1440px+ | İçerik 1312px üzerinde gerilmez; kart/görsel en-boy oranı korunur; boşluk kontrollü artar |

Tarihler native date control'de klavye erişilebilir kalır. Küçük ekranda form alanları tam genişlik, action'lar sarılır; uzun tablo yatay kaydırma yerine aynı veriyi kart sunumuna çevirir. `prefers-reduced-motion: reduce` tüm dekoratif geçişi kaldırır.

## 9. Agent Prompt Guide
> Karavan'ın modern açık hava seyahat editoryali stilini koru: forest `#234B3B`, sage `#829985`, sınırlı amber `#E58B52`, paper `#FAF9F6`, white yüzey, Manrope Variable, 4/8 tabanlı boşluk ve görünür focus. Asimetrik, fotoğraf odaklı düzen kullan; ilanları gerçekçi demo olarak açıkça işaretle. Her ekranda tek belirgin birincil CTA, Türkçe alan hataları, 44px dokunma hedefi ve mobil kırılımları uygula. Gerçek auth/DB/ödeme/yorum iddia etme; harita/favori/mesaj/şikayet ekleme. İçeriği ve semantik kontrastı dekorasyondan öncele.
