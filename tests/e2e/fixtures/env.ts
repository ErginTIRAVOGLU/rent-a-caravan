// Playwright globalSetup/spec'leri Node'dan çalışır (Next.js .env otomatik
// yüklemesi burada yok); .env'i elle yükleriz. Bu modül HER ZAMİN ilk import
// edilmeli — ESM değerlendirme sırası gereği dotenv, prisma'dan önce koşmalı.
import "dotenv/config";
