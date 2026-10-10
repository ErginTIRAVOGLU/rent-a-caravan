"use server";

import type { Listing } from "@prisma/client";

import { requireAdmin } from "../../lib/auth";
import { ok, type ActionResult } from "../../lib/result";
import {
  approveListingCore,
  pauseListingCore,
  rejectListingCore,
  setUserBannedCore,
  type BannedUser,
} from "./service";

/**
 * İstemciye dönen ilan görünümü. Prisma `Decimal` sınıf örneği React sunucu
 * eylemi serileştiricisi tarafından reddedilir ("only plain objects") —
 * `nightlyPrice` burada number'a çevrilir; çekirdekler `ActionResult<Listing>`
 * dönmeye devam eder (listings/actions.ts ile aynı kalıp).
 */
export type ClientListing = Omit<Listing, "nightlyPrice"> & {
  nightlyPrice: number;
};

function toClientListing(listing: Listing): ClientListing {
  return { ...listing, nightlyPrice: Number(listing.nightlyPrice) };
}

function toClientResult(
  result: ActionResult<Listing>,
): ActionResult<ClientListing> {
  return result.ok ? ok(toClientListing(result.data)) : result;
}

/** İlanı onayla — oturum kapısı requireAdmin; geçiş matrisi service'te. */
export async function approveListing(
  id: string,
): Promise<ActionResult<ClientListing>> {
  const admin = await requireAdmin();
  return toClientResult(await approveListingCore(admin, id));
}

/** İlanı reddet + gerekçe — oturum kapısı requireAdmin; gerekçe zorunlu. */
export async function rejectListing(
  id: string,
  reason: string,
): Promise<ActionResult<ClientListing>> {
  const admin = await requireAdmin();
  return toClientResult(await rejectListingCore(admin, id, reason));
}

/** İlanı duraklat — oturum kapısı requireAdmin; yalnız ACTIVE → PAUSED. */
export async function pauseListing(
  id: string,
): Promise<ActionResult<ClientListing>> {
  const admin = await requireAdmin();
  return toClientResult(await pauseListingCore(admin, id));
}

/**
 * Kullanıcı banı — oturum kapısı requireAdmin; self-ban/son-yönetici koruması
 * service'te. Yanıt `BannedUser` (passwordHash/googleId asla istemciye gitmez).
 */
export async function setUserBanned(
  userId: string,
  banned: boolean,
): Promise<ActionResult<BannedUser>> {
  const admin = await requireAdmin();
  return setUserBannedCore(admin, userId, banned);
}
