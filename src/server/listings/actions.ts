"use server";

import type { Listing } from "@prisma/client";

import { requireUser } from "../../lib/auth";
import { ok, type ActionResult } from "../../lib/result";
import {
  createListingCore,
  deleteListingCore,
  submitListingCore,
  updateListingCore,
} from "./service";

/**
 * İstemciye dönen ilan görünümü. Prisma `Decimal` sınıf örneği React sunucu
 * eylemi serileştiricisi tarafından reddedilir ("only plain objects") —
 * `nightlyPrice` burada number'a çevrilir; diğer alanlar düz veridir.
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

/** İlan oluştur — oturum kapısı; çekirdek her zaman DRAFT + kendi sahipliği yazar. */
export async function createListing(
  data: unknown,
): Promise<ActionResult<ClientListing>> {
  const user = await requireUser();
  return toClientResult(await createListingCore(user, data));
}

/** İlan güncelle — yalnız sahibi (yetki hatası service'te). */
export async function updateListing(
  id: string,
  data: unknown,
): Promise<ActionResult<ClientListing>> {
  const user = await requireUser();
  return toClientResult(await updateListingCore(user, id, data));
}

/** İlan sil — yalnız sahibi (yetki hatası service'te). */
export async function deleteListing(
  id: string,
): Promise<ActionResult<ClientListing>> {
  const user = await requireUser();
  return toClientResult(await deleteListingCore(user, id));
}

/** İlanı incelemeye gönder — DRAFT|REJECTED → PENDING, en az 1 foto zorunlu. */
export async function submitListing(
  id: string,
): Promise<ActionResult<ClientListing>> {
  const user = await requireUser();
  return toClientResult(await submitListingCore(user, id));
}
