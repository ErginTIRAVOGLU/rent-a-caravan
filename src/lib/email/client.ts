import { Resend } from "resend";

// Gönderilecek e-postanın içeriği; arayüz sadece bu üç alanı bilir.
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

// Tüm e-posta bu arayüz üzerinden gider; testler sahte istemci enjekte eder.
export interface EmailClient {
  send(msg: EmailMessage): Promise<void>;
}

// Resend "from" adresi: doğrulanmış alan adı yokken sandbox
// onboarding@resend.dev'e izin verir; üretimde RESEND_FROM ile değiştirilir.
// send içinde okunur ki test/konfigürasyon değişimleri anında geçerli olsun.

export const resendClient: EmailClient = {
  async send(msg) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Ana akışı düşürmemek için yalnızca loglayıp yok say (spec).
      console.error(
        "[email] RESEND_API_KEY tanımlı değil; e-posta gönderilmedi:",
        msg.subject,
      );
      return;
    }
    const from = process.env.RESEND_FROM ?? "Karavan <onboarding@resend.dev>";
    const resend = new Resend(apiKey);
    // Resend hata fırlatmak yerine { error } döner; ikisini de logla/boşver.
    const { error } = await resend.emails.send({
      from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
    });
    if (error) {
      console.error("[email] Resend gönderim hatası:", error);
    }
  },
};
