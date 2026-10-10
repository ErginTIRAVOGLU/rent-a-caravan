# Karavan — Uygulama görevleri

Bu repository başlangıçta boştu. Kullanıcının onayladığı teslimat: yeni proje üzerinde tasarım odaklı arayüz ve açıkça etiketlenmiş demo içerikler. Gerçek oturum, kalıcı kayıt veya ödeme varmış gibi gösterilmeyecek.

## 1. Ziyaretçi rotaları
- [x] `/` ana sayfasında profesyonel navbar; logo, Karavanları Keşfet, Nasıl Çalışır ve uygun kullanıcı işlemleri; karavan fotoğraflı hero; aramayı öne çıkaran şehir, giriş/çıkış tarihi ve kişi alanları; mobilde kullanılabilir arama; son eklenen aktif ilanlar; görsel, başlık, konum, kapasite ve gecelik fiyat içeren ilan kartları; kiralama süreci; ilan oluşturmak isteyen sahipler için CTA; güven veren metin ve footer bulunmalı.
- [x] `/arama` sayfasında başlık/sonuç sayısı, şehir/tarih/kişi/fiyat/araç tipi filtreleri, seçili filtre chip'leri ve temizleme, sıralı kartlar, masaüstü filtre paneli, mobil filtre çekmecesi/dialog, sayfalama, boş/yükleniyor/hata durumları bulunmalı. MVP kapsamı dışında olan harita, favori ve sezonluk fiyat gösterimi eklenmemeli.
- [x] `/ilan/[id]` sayfasında fotoğraf galerisi/önizlemeleri; ilan başlığı, şehir/ilçe ve araç tipi; marka/model/yıl/vites/yakıt/kapasite/varsa ölçüler; ehliyet koşulu ve asgari sürücü yaşı; klima, WC, duş, güneş paneli, tente, ısıtma, TV, sıcak su, ocak, buzdolabı, yatak takımı, mutfak takımı, GPS, bisiklet taşıyıcı, kamera, invertör ve WiFi donanımları; kurallar ve minimum kiralama süresi; ilan sahibi avatarı/adı/profil bilgisi; gecelik fiyat ve tarihlere göre toplam fiyat özeti; tarih/kişi/mesaj alanları olan talep formu ve mobilde erişilebilir talep CTA'sı bulunmalı. Talep göndermenin ödeme olmadığı açıkça yazılmalı; doğrulanmamış güven iddiaları yapılmamalı.
- [x] `/giris` ve `/kayit` rotalarında erişilebilir e-posta/şifre ve ad alanları, alan bazlı Türkçe doğrulama mesajları, hata/yüklenme/başarı halleri ve karşılıklı sayfa bağlantıları olmalı. Google giriş seçeneği ancak mevcut altyapı gerçekten desteklediği ölçüde gösterilmeli; gerçek auth varmış gibi davranılmamalı.

## 2. Üye paneli ve ilan işlemleri
- [x] Tek hesapla kiracı ve sahip işlemlerini destekleyen tutarlı bir hesap alanı oluşturulmalı; masaüstünde uygun navigasyon, mobilde kompakt navigasyon kullanılmalı.
- [x] `/hesap/ilanlarim` demo ilanlarını fotoğraf/başlık/konum/gecelik fiyatla listelemeli; taslak, incelemede, yayında, reddedildi ve duraklatıldı durumlarını göstermeli; oluşturma, düzenleme ve silme eylemlerini açık demo sınırları içinde ele almalı.
- [x] `/hesap/ilanlarim/yeni` ve `/hesap/ilanlarim/[id]/duzenle` dört adımlı form içermeli: (1) temel bilgiler ve araç özellikleri, (2) donanım ve ev kuralları, (3) fotoğraf yükleme, (4) önizleme ve incelemeye gönderme. Adım göstergesi, ileri/geri navigasyonu, form doğrulaması, fotoğraf önizleme/silme, kaydetme/gönderme durumları ve Türkçe alan hataları olmalı. En fazla 10 fotoğraf, dosya başına en fazla 5 MB, yalnızca JPEG/PNG/WebP kabul edilmeli.
- [x] `/hesap/taleplerim` gelen ve gönderilen talepler için ayrı sekmeler; ilan özeti; kiracı/sahip bilgisi; tarih, kişi sayısı, toplam fiyat; bekliyor/onaylandı/reddedildi/iptal edildi/tamamlandı durumları; sahip için onay/red ve red gerekçesi; kiracı için iptal; tarih çakışması mesajı; boş/yükleniyor durumları içermeli. Ödeme ekranı olmayacak.
- [x] `/hesap/profil` ad, telefon, e-posta, profil düzenleme ve şifre değiştirme alanları ile kaydetme/başarı/hata durumlarını sunmalı; gerçek veri kaydı varmış gibi gösterilmemeli.

## 3. Admin alanı
- [x] `/admin/ilanlar` bekleyen ilan listesi, önizleme, fotoğraf/başlık/konum/fiyat/sahip bilgisi, durum filtreleri, onaylama, gerekçeli reddetme, aktif ilanı duraklatma, kritik işlem onay diyaloğu ve işlem sonrası geri bildirim içermeli.
- [x] `/admin/kullanicilar` ad/e-posta/kayıt tarihi/durum sütunlu tablo, kullanıcı engelleme/engeli kaldırma, kritik işlem onay diyaloğu ve yükleniyor/boş/hata durumları içermeli.
- [x] Admin ekranları aynı tasarım tokenlarını kullanmalı, veri okunabilirliği ve işlem verimliliğine öncelik vermeli. MVP dışında şikayet yönetimi ve mesajlaşma eklenmemeli.

## 4. Design System ve ortak bileşenler
- [x] Merkezi CSS değişkenleriyle renk, tipografi, spacing (4/8/12/16/24/32/48/64), radius, border, elevation ve breakpoint tokenları kurulmalı. Temel palet: `#234B3B`, `#829985`, `#E58B52`, `#FAF9F6`, `#FFFFFF`, `#202722`, `#66716A`, `#E4E7E3`; success/warning/error/info/disabled/focus renkleri de semantik ve kontrastı kontrol edilmiş olmalı.
- [x] Türkçe karakter desteği ve masaüstü/mobil ölçüleriyle typography tablosu; görsel tema; bileşen durumu; layout; elevation; do/don't; responsive davranış ve başka ajanlara kısa prompt rehberi dahil dokuz bölümlü `docs/design-system.md` oluşturulmalı ve gerçek arayüzlerde uygulanmalı.
- [x] Navbar/footer, üye/admin navigasyonu, button/icon button, input/select/tarih/textarea, checkbox/radio, form alanı/hata, badge, ListingCard, fiyat özeti, PhotoGallery/PhotoUploader, SearchFilters, EmptyState/Skeleton, alert/toast, ConfirmDialog, Pagination, modal/drawer, avatar ve breadcrumb yeniden kullanılabilir olmalı.
- [x] Bileşenlerde uygun default/hover/focus-visible/active/disabled/loading durumları, görünür focus, klavye kullanımı, erişilebilir etiketler ve yeterli kontrast bulunmalı. Emoji kullanılmamalı; işlevsiz dekoratif kontrol eklenmemeli.

## 5. Ortak durumlar, responsive davranış ve ürün sınırları
- [x] Türkçe 404 görünümü ana sayfa/arama dönüşü vermeli; hata görünümü tekrar deneme sunmalı; loading skeleton gerçek sayfa yapısıyla uyumlu olmalı. Form, boş liste, API hatası, erişim engeli, başarı ve onay/silme halleri ortak tasarıma sahip olmalı.
- [x] 360–390 px mobil, 768 px tablet, 1024 px küçük masaüstü ve 1440 px+ geniş masaüstünde temel sayfalar yatay taşma olmadan çalışmalı. Kart/formlar uyarlanmalı; tablolar mobilde kartlaştırılmalı; dokunma hedefleri tercihen en az 44×44 px olmalı; mobil CTA ve uzun formlar kullanılabilir olmalı.
- [x] Demo içerik, durumlar ve yerel arayüz etkileşimleri açıkça demo olarak etiketlenmeli; gerçek oturum, sunucuya kayıt, rezervasyon/ilan verisi veya ödeme başarıyla kaydediliyormuş gibi sunulmamalı. Online ödeme, kredi kartı, komisyon, harita, favori, sezonluk fiyat, mesajlaşma ve şikayet özellikleri yok.
- [x] Görseller yüklenemediğinde bozuk alan yerine düzenli fallback gösterilmeli; kullanılan görseller lisans/uygulanabilirlik açısından kontrol edilmeli.

## 6. Teknik teslim ve doğrulama
- [x] Next.js 15 App Router, strict TypeScript ve Tailwind CSS v4 hedefiyle gerçek sayfa ve bileşenler oluşturulmalı; mevcut proje/route yapısını değiştirecek bir kaynak olmadığı not edilmeli.
- [x] `public/manus-routes.json`, kaynak rotalarla uyumlu tam sayfa rotalarını (dinamik kalıplar dahil; API/asset/system/404-only hariç) içermeli ve HTTP 200 JSON olarak doğrulanmalı.
- [x] Lint, mevcut testler, TypeScript tanılama/typecheck ve production build çalıştırılmalı; hatalar giderilmeli veya kalanlar raporlanmalı. Preview çalışır durumda yerel HTTP isteğiyle doğrulanmalı.

## Doğrulama kaydı
- `pnpm lint`, `pnpm typecheck`, `pnpm build` ve `git diff --check` başarılı. Paket manifestinde ayrı bir `test` komutu veya mevcut test dosyası yoktu; bunun yerine 12 sayfa rotası ve arama query senaryoları yerel/dış Preview HTTP kontrolünden geçti.
- 390, 768, 1024 ve 1440 px görünümlerinde ekran görüntüsü incelemesi yapıldı; fiyat sıralama formu ve moderasyon onay/iptal diyaloğu demo Preview üzerinde etkileşimli olarak doğrulandı.
