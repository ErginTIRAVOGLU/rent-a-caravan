# Karavan — Tasarım ve uygulama planı

## Kapsam ve kararlar
Bu repository başlangıçta yalnızca Git metaverisi içeriyordu; uygulama kodu, ürün belgeleri veya mevcut backend yok. Kullanıcının onayladığı kapsam yeni bir tasarım ağırlıklı arayüz ve açıkça işaretlenmiş demo içeriklerdir. Plan: Next.js 15 App Router, strict TypeScript ve Tailwind CSS v4 ile mobil-first, çalışır ön yüz prototipi oluşturmak. Arama, filtre, sıralama, sayfalama, form doğrulama, çok adımlı ilan formu ve demo akışları arayüz içinde çalışacak; kalıcı veri, gerçek oturum, gerçek rezervasyon veya ödeme iddiası olmayacak.

Proje başlatılırken Manus yönetimli `server` ve `database` olanakları etkinleştirildi. Bu platform veritabanı MySQL uyumludur; ürün talimatındaki PostgreSQL beklentisiyle uyuşmaz ve kullanıcı yalnızca UI/demo arayüzü onayladığı için uygulama bu DB'yi kullanmayacak. Gerçek backend/OAuth bu planın dışında kalır; daha sonra istendiğinde sağlayıcı/kimlik bilgileri ve veritabanı mimarisi ayrı kararlaştırılmalıdır. Ödeme ve talep akışında ödeme adımı yoktur.

## Tasarım sistemi
- **Design Movement:** Modern açık hava seyahat editoryali ile seçkin konaklama pazaryerinin birleşimi; hazır dashboard şablonu değil.
- **Core Principles:** Görseli metinden önce okut; güveni kanıtlanmamış rozetlerle değil, açık bilgilerle kur; sıcak ama düzenli boşluk; tek ve belirgin birincil eylem.
- **Color Philosophy:** Orman yeşili güven/istikrar, adaçayı dingin doğa, sıcak turuncu az ve dikkatli CTA vurgusu; kırık beyaz zemin ve beyaz yüzeyler gerçek fotoğraflara nefes alanı bırakır. Temel tokenlar: primary `#234B3B`, secondary `#829985`, accent `#E58B52`, background `#FAF9F6`, surface `#FFFFFF`, text `#202722`, muted `#66716A`, border `#E4E7E3`. Success `#21643D`, warning `#8A5600`, error `#B42318`, info `#245B83`, disabled `#929B94`, focus `#2563EB`; kontrast renk çifti bazında kontrol edilecek.
- **Layout Paradigm:** Sayfa başına ortalanmış şablon yerine aynı max-width container hizasında editoryal bölümler: ana sayfada fotoğraf + arama için asimetrik split; aramada sonuç listesi ve bağlama duyarlı filtre; ilanda geniş fotoğraf şeridi ve yanında fiyat/talep; hesap ekranlarında seyahat odaklı içerik ve kompakt kenar navigasyonu; admin'de sıkı veri tabloları.
- **Signature Elements:** (1) rota/seyahat işaretini anımsatan özel Karavan amblemi; (2) arama alanlarını birleştiren orman yeşili kapsül; (3) küçük amber rota/konum vurguları. Dekorasyon içeriğin önüne geçmez.
- **Interaction Philosophy:** Kontrollerin durumları ve sonuçları anında anlaşılır; demo eylemleri açık durum mesajı verir; odak klavyede görünür kalır; dokunma hedefleri en az 44px hedeflenir.
- **Animation:** Kısa 140–180ms opacity/renk geçişleri; büyük scale, bounce veya parallax yok. Reduced-motion tercihi tüm dekoratif geçişleri kapatır.
- **Typography System:** Yerel paketten Manrope Variable (400–800) tek sans ailesi; Türkçe karakterleri destekleyen sans fallback. H1 48/52 desktop, 36/40 mobile; H2 32/38 ve 28/34; H3 22/30; body 16/26; small 14/21; caption/label 12/18; CTA 14/20, 700. Fiyatlar tabular numeral ile taranabilir.
- **Brand Essence:** Türkiye yollarını konforlu ve güvenilir bir karavan konaklamasına çeviren kiralama pazaryeri; kişilik: özgür, özenli, güvenilir.
- **Brand Voice:** Sıcak, doğrudan, sakin ve gerçekçi. Örnek: “Yola çıkacağın karavanı bul.” “Talep gönder; konaklama planını sahibiyle netleştir.” Ödeme varmış gibi söz verilmez.
- **Wordmark & Logo:** Marka adı metin olarak, yanında dağ/rota kıvrımını taşıyan sade özel K işaretinden oluşan ölçeklenebilir vektör/ikon; okunaksız yapay yazı kullanılmaz.
- **Signature Brand Color:** Forest `#234B3B`.

## Uygulama yaklaşımı
- Next.js App Router, TypeScript strict, Tailwind CSS v4; gerçek sayfalar ve ortak bileşenler. Yeni bağımlılıklar sadece gerekli olanlarla sınırlı.
- Demo fixture verileri ve formatlayıcılar `src/lib/` altında; genel navigasyon/ürün komponentleri `src/components/` altında; ziyaretçi, hesap ve admin rotaları App Router içinde. Demo etkileşimlerinin yerel ve kalıcı olmayan niteliği görünür şekilde belirtilir.
- Rotalar: `/`, `/arama`, `/ilan/[id]`, `/giris`, `/kayit`, `/hesap/ilanlarim`, `/hesap/ilanlarim/yeni`, `/hesap/ilanlarim/[id]/duzenle`, `/hesap/taleplerim`, `/hesap/profil`, `/admin/ilanlar`, `/admin/kullanicilar`; ayrıca Next `loading`, `error`, `not-found` sistem halleri.
- Tam route kalıpları `public/manus-routes.json` içinden ilan edilir. Tema tokenları global CSS'te merkezi kalır. İlan fotoğrafları her demo listing'e özgü olmalı; hata halinde fallback gösterilmeli.
- `docs/design-system.md` kullanıcı brief'inde zorunlu dokuz başlığı (Visual Theme & Atmosphere; Color Palette & Roles; Typography Rules; Component Stylings; Layout Principles; Depth & Elevation; Do's and Don'ts; Responsive Behavior; Agent Prompt Guide) ayrıntılandırır ve uygulama tokenlarıyla aynı değerleri kullanır.

## Ana proje yapısı
- `src/app/`: root layout, global CSS, ana/arama/ilan, giriş-kayıt, hesap, admin ve sistem durum rotaları.
- `src/components/`: site shell, arama, ilan, form, shared UI, hesap ve admin bileşenleri.
- `src/lib/`: açık demo fixture'ları, para/tarih biçimlendiricileri, doğrulama ve yardımcı fonksiyonlar.
- `public/images/`: üretilmiş veya izinli gerçek karavan/kamp fotoğrafları; erişilebilirlik ve görsel fallback.
- `public/manus-routes.json`: Preview ve platform route manifest'i.
- `docs/design-system.md`: dokuz bölümlü Türkçe stil kılavuzu.
- `TODO.md`: onaylanan gereksinimlerin teslim ölçütleri.

## Teslim sınırları
- Hiçbir eylem gerçek DB'ye yazmaz veya oturum açtığını iddia etmez; ödeme/komisyon arayüzü yoktur.
- Demo ilanlar ve talepler sayfalarda açık biçimde örnek olarak etiketlenir.
- Mevcut backend/Prisma/Auth.js/PostgreSQL bağlantısı yoktur; gerçek uygulama backend'i, Google OAuth sağlayıcı sırları veya PostgreSQL kaynağı bu UI planında kurulmuş sayılmaz.
- Kod hazır olduktan sonra TypeScript/ESLint/test ve production build çalıştırılır; dev Preview yerel HTTP ve tam route manifest'iyle doğrulanır. Kullanılamayan kontroller dürüstçe raporlanır.
