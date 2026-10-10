import { resendClient } from "./client";
import type { EmailClient } from "./client";
import {
  bookingRequestedTemplate,
  bookingStatusChangedTemplate,
  listingStatusChangedTemplate,
  registerVerifyTemplate,
} from "./templates";
import type {
  BookingRequestedData,
  BookingStatusChangedData,
  ListingStatusChangedData,
} from "./templates";

// E-posta olayları — spec: "gönderim hatası asla ana akışı düşürmez".
// Her fonksiyon try/catch ile sarılır: hata console.error ile loglanır,
// Promise asla reject olmaz. client parametresi test enjeksiyonu içindir.

export async function sendBookingRequested(
  to: string,
  data: BookingRequestedData,
  client: EmailClient = resendClient,
): Promise<void> {
  try {
    await client.send(bookingRequestedTemplate(to, data));
  } catch (error) {
    console.error("[email] sendBookingRequested gönderimi başarısız:", error);
  }
}

export async function sendBookingStatusChanged(
  to: string,
  data: BookingStatusChangedData,
  client: EmailClient = resendClient,
): Promise<void> {
  try {
    await client.send(bookingStatusChangedTemplate(to, data));
  } catch (error) {
    console.error("[email] sendBookingStatusChanged gönderimi başarısız:", error);
  }
}

export async function sendListingStatusChanged(
  to: string,
  data: ListingStatusChangedData,
  client: EmailClient = resendClient,
): Promise<void> {
  try {
    await client.send(listingStatusChangedTemplate(to, data));
  } catch (error) {
    console.error("[email] sendListingStatusChanged gönderimi başarısız:", error);
  }
}

/**
 * Kayıt sonrası e-posta doğrulama linki gönderir.
 * Hata ana akışı düşürmez (try/catch ile sarılır).
 */
export async function sendRegisterVerify(
  to: string,
  token: string,
  client: EmailClient = resendClient,
): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const verifyUrl = `${baseUrl}/dogrula?token=${token}`;
    await client.send(registerVerifyTemplate(to, { verifyUrl, expiryHours: 24 }));
  } catch (error) {
    console.error("[email] sendRegisterVerify gönderimi başarısız:", error);
  }
}
