"use server";

import type { BookingRequest } from "@prisma/client";

import { requireUser } from "../../lib/auth";
import { ok, type ActionResult } from "../../lib/result";
import {
  approveBookingCore,
  cancelBookingCore,
  createBookingCore,
  rejectBookingCore,
} from "./service";

/**
 * İstemciye dönen talep görünümü. Prisma `Decimal` sınıf örneği React sunucu
 * eylemi serileştiricisi tarafından reddedilir ("only plain objects") —
 * `totalPrice` burada number'a çevrilir; çekirdekler `ActionResult<BookingRequest>`
 * dönmeye devam eder (T6 dersi, listings/actions.ts ClientLogin ile aynı kalıp).
 */
export type ClientBooking = Omit<BookingRequest, "totalPrice"> & {
  totalPrice: number;
};

function toClientBooking(booking: BookingRequest): ClientBooking {
  return { ...booking, totalPrice: Number(booking.totalPrice) };
}

function toClientResult(
  result: ActionResult<BookingRequest>,
): ActionResult<ClientBooking> {
  return result.ok ? ok(toClientBooking(result.data)) : result;
}

/** Talep oluştur — oturum kapısı; kiracı/aktif-ilan/kurallar service'te. */
export async function createBooking(
  input: unknown,
): Promise<ActionResult<ClientBooking>> {
  const user = await requireUser();
  return toClientResult(await createBookingCore(user, input));
}

/** Talebi onayla — yalnız ilan sahibi; atomik çakışma koruması service'te. */
export async function approveBooking(
  id: string,
): Promise<ActionResult<ClientBooking>> {
  const user = await requireUser();
  return toClientResult(await approveBookingCore(user, id));
}

/** Talebi reddet + gerekçe — yalnız ilan sahibi. */
export async function rejectBooking(
  id: string,
  reason?: string,
): Promise<ActionResult<ClientBooking>> {
  const user = await requireUser();
  return toClientResult(await rejectBookingCore(user, id, reason));
}

/** Talebi iptal et — yalnız kiracı; PENDING|APPROVED. */
export async function cancelBooking(
  id: string,
): Promise<ActionResult<ClientBooking>> {
  const user = await requireUser();
  return toClientResult(await cancelBookingCore(user, id));
}
