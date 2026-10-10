# Karavan

Türkiye'de karavan sahibi ve kiracısını buluşturan pazaryeri deneyimi için tasarım odaklı web prototipi.

## Başlatma

```bash
pnpm install
pnpm dev
```

- Next.js 15 App Router
- TypeScript strict
- Tailwind CSS v4
- Zod form doğrulaması
- Manrope Variable ve Lucide ikonları

## Demo kapsamı

Ana sayfa, arama/filtre/sıralama/sayfalama, ilan detayları, giriş/kayıt formları, hesap/ilan/talep/profil akışları ve admin ilan/kullanıcı panelleri örnek verilerle çalışır. Tüm demo işlemleri sayfa oturumu içinde geçicidir; veritabanına yazılmaz. Gerçek Auth.js/Google OAuth/Prisma/PostgreSQL veya ödeme entegrasyonu kurulmamıştır. Talep formu ödeme veya rezervasyon yapmaz. Harita, favori, sezonluk fiyat, mesajlaşma ve şikayet MVP kapsamı dışındadır.

## Kontroller

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Tasarım kararları: [`docs/design-system.md`](docs/design-system.md). Görsel envanteri: [`docs/asset-sources.md`](docs/asset-sources.md). Uygulama koşulları: [`TODO.md`](TODO.md).
