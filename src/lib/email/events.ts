import { resendClient } from "./client";
import type { EmailClient } from "./client";
import {
  bookingRequestedTemplate,
  bookingStatusChangedTemplate,
  listingStatusChangedTemplate,
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
