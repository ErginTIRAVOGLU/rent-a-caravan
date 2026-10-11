/**
 * E2E sabitleri — senaryoların paylaştığı kullanıcı/ilan/fixture verisi.
 *
 * Kullanıcılar ve ilanlar `prisma/seed.ts` ile oluşturulur; şifre oradan
 * yakalanır (SEED_PASSWORD) ki iki taraf hiçbir zaman ayrışmasın.
 */

import { SEED_PASSWORD } from "../../../prisma/seed";

/** Seed hesapları — e-posta (giriş) + ad (header'daki oturum sinyali). */
export const ACCOUNTS = {
  admin: { email: "admin@karavan.test", name: "Demo Admin" },
  owner: { email: "sahip@karavan.test", name: "Ayşe Yıldız" },
  secondOwner: { email: "ikinci-sahip@karavan.test", name: "Burak Çelik" },
  renter: { email: "kiraci@karavan.test", name: "Can Kaya" },
} as const;

export type Account = (typeof ACCOUNTS)[keyof typeof ACCOUNTS];

/** Seed kullanıcı e-postaları (fixture/DB hazırlığı için). */
export const USERS = {
  admin: ACCOUNTS.admin.email,
  owner: ACCOUNTS.owner.email,
  secondOwner: ACCOUNTS.secondOwner.email,
  renter: ACCOUNTS.renter.email,
} as const;

/** İlan şehirleri — arama filtresi bu değerlerle çağrılır. */
export const CITIES = {
  antalya: "Antalya",
  izmir: "İzmir",
  bolu: "Bolu",
} as const;

/** Seed ilan başlıkları (prisma/seed.ts). */
export const LISTINGS = {
  /** ACTIVE — senaryo 2 (sahip onayı) bu ilanı kullanır. */
  antalya: "Deniz Manzaralı Çekme Karavan",
  /** ACTIVE — senaryo 1 (talep), 4 (mesajlaşma) ve 5 (yorum) bu ilanı kullanır. */
  izmir: "Ege Turu İçin Kompakt Panelvan",
  /** PENDING — senaryo 3'ün onay bekleyen ilanı. */
  bolu: "Abant ve Yayla Turu Motorhome",
} as const;

/** Seed şifresi (tüm kullanıcılar için aynı). */
export const PASSWORD = SEED_PASSWORD;

/**
 * Senaryo önkoşul fixture'ları (dev DB'de sabit kimliklerle upsert edilir):
 * senaryolar üst üste koşabilir olsun diye her koşumda sıfırlanır.
 */

/** Senaryo 5'in yorum yazacağı COMPLETED rezervasyon (İzmir ilanı). */
export const E2E_REVIEW_BOOKING_ID = "ce2ereviewbooking00000000";

// `createReviewCore` bookingId'yi `^c[a-z0-9]{24}$` deseniyle doğrular; fixture
// kimliği bu desene uymak zorunda (aksi halde senaryo 5 sunucudan reddedilir).
if (!/^c[a-z0-9]{24}$/.test(E2E_REVIEW_BOOKING_ID)) {
  throw new Error(
    "E2E_REVIEW_BOOKING_ID geçersiz: createReviewCore ^c[a-z0-9]{24}$ deseni bekliyor.",
  );
}

/** Senaryo 1'in talep mesajı (gelen talepler listesinde satır bulmak için). */
export const BOOKING_MESSAGE_SCENARIO_1 = "E2E senaryo 1: hafta sonu için müsait mü?";

/** Senaryo 2'nin talep mesajı (gelen talepler listesinde satır bulmak için). */
export const BOOKING_MESSAGE_SCENARIO_2 = "E2E senaryo 2: onay bekleyen talep.";

/** Senaryo 4'ün mesajı (sohbet önizlemesinde ve konuşmada görünür). */
export const CHAT_MESSAGE_SCENARIO_4 = "E2E senaryo 4: Ekim için müsaitlik var mı?";

/** Senaryo 5'in yorum metni (ilan detayında görünür). */
export const REVIEW_COMMENT_SCENARIO_5 =
  "E2E senaryo 5: Karavan tertemiz, sahibi çok ilgiliydi.";
