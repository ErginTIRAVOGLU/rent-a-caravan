# Karavan Pazar Yeri — Sosyal Katman ve Kalite Kapısı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Karavan kiralama pazar yerinde kullanıcıların birbirleriyle iletişime geçebilmesi, birbirlerini değerlendirebilmesi, şikayetlerin admin tarafından yönetilebilmesi, e-posta özetlerinin çalışması ve CI + Playwright kapısı olan canlı site kurmak.

**Architecture:** Tek Next.js (App Router) monoliti. Mutasyonlar server actions, UploadThing/cron için route handler. `src/app/` altında **Türkçe URL segmentleri** (spec Bölüm 2), iş mantığı `src/server/<domain>/service.ts` (test edilen çekirdek, explicit `user` parametresi) + `actions.ts` (Auth.js oturumuyla saran ince sarmalayıcı). Sosyal katman (mesajlaşma, değerlendirme, şikayet) bu planda tamamlanır.

**Tech Stack:** Next.js 15 (App Router, src/) · TypeScript strict · Tailwind v4 · Prisma + PostgreSQL · Auth.js v5 (Google + credentials) · Zod · Resend · UploadThing · S3

**Database Changes:**
- `User` model: `emailVerified: DateTime?` (default: null), `reviewsVisible: Boolean` (default: true)
- `Conversation` model: `listingId`, `renterId`, `ownerId`, `lastMessageAt: DateTime?`, `lastMessagePreview: String?`, unique(listingId, renterId)
- `Message` model: `conversationId`, `senderId`, `content`, `readAt: DateTime?`, `createdAt`
- `Review` model: `listingId`, `authorId`, `bookingId` (unique), `rating: Int (1-5)`, `comment: String?`, `ipAddress: String?`, `updatedAt: DateTime?`
- `Report` model: `reporterId`, `targetType: LISTING | USER`, `targetId`, `reason`, `status: OPEN | REVIEWING | CLOSED`, `updatedAt: DateTime?`
- `Setting` model: `key` (id), `value: Json`, `updatedAt` — "reviewsEnabled" key (getter `?? true`)
- `RateLimitEntry` model: `key`, `bucket`, `count`, `expiresAt` (existing from Plan 1)

**Important Notes:**
- Prisma 7: `@prisma/adapter-pg`, no `--schema` flag for `db execute`; run `prisma generate` after schema edits.
- next-auth v5 gotcha: `signOut` must come from `src/lib/auth.ts`; `import { signOut } from "next-auth"` fails `tsc`.
- No `gh` CLI; GitHub MCP PAT returns 403 for PR creation — use REST API via `git credential fill`.
- Browser quirks: call `browser.resize` desktop before `browser.capture`; `browser.scroll` times out (~20s) but usually applies.
- Seed DB: 2 ACTIVE listings (Antalya "Deniz Manzaralı Çekme Karavan" id `cmv26obay0004y8o9qln1oajw`, İzmir "Ege Turu İçin Kompakt Panelvan"), 1 PENDING (Bolu).
- Dev server running in background (`npm run dev`).
- Deploy-time user to-dos unchanged: real `UPLOADTHING_TOKEN`, Google OAuth, Resend key, Vercel `CRON_SECRET`.

## Implementation Plan

### 1. Database Schema Updates

- [ ] Add `emailVerified: DateTime?` to `User` model in `prisma/schema.prisma`
- [ ] Add `reviewsVisible: Boolean @default(true)` to `User` model
- [ ] Create `Conversation` model: `id`, `listingId`, `renterId`, `ownerId`, `lastMessageAt: DateTime?`, `lastMessagePreview: String?`, `createdAt`, `@@unique([listingId, renterId])`, `@@index([renterId, lastMessageAt])`, `@@index([ownerId, lastMessageAt])`
- [ ] Create `Message` model: `id`, `conversationId`, `senderId`, `content: String`, `readAt: DateTime?`, `createdAt`, `@@index([conversationId, createdAt])`
- [ ] Create `Review` model: `id`, `listingId`, `authorId`, `bookingId`, `rating: Int`, `comment: String?`, `ipAddress: String?`, `updatedAt: DateTime?`, `@@unique([bookingId])`
- [ ] Create `Report` model: `id`, `reporterId`, `targetType: ReportTargetType`, `targetId: String`, `reason: String`, `status: ReportStatus`, `updatedAt: DateTime?`
- [ ] Add `ReportTargetType` enum: `LISTING`, `USER`
- [ ] Add `ReportStatus` enum: `OPEN`, `REVIEWING`, `CLOSED`
- [ ] Create `Setting` model: `key: String @id`, `value: Json`, `updatedAt: DateTime`
- [ ] Run `prisma generate` and verify schema is valid
- [ ] Create and run migration: `prisma migrate dev --name "add_social_layer_models"`
- [ ] Update seed: backfill `emailVerified: now()` for existing users, add sample conversations/messages/reviews/reports
- [ ] Commit with ASCII-safe message: "feat: add social layer database models"

### 2. Auth: JWT Claim Refresh (Backlog #4 — JWT rol donması)

- [ ] Modify `src/lib/auth.ts` `jwt` callback: on every server-side `auth()` call, fetch `{ role, isBanned, emailVerified }` from DB and update token claims
- [ ] If `isBanned === true`, return `null` from callback (session becomes invalid)
- [ ] Set `session.maxAge = 7 * 24 * 60 * 60` (7 days) in `authConfig`
- [ ] Add test in `tests/auth.test.ts`: ban user → next `auth()` gate returns null; demote admin → next gate loses admin rights
- [ ] Run `npm run check` and ensure all tests pass
- [ ] Commit with ASCII-safe message: "fix: jwt claim refresh on every auth() call, short token maxAge"

### 3. User Email Verification (Registration Link)

- [ ] Add `verifyEmail` function in `src/server/users/service.ts`: HMAC-signed link payload `{email, exp}`, 24h expiry, uses `AUTH_SECRET`
- [ ] Add `verifyEmailAction` in `src/server/users/actions.ts`: validates signature/expiry → sets `emailVerified: now()` → returns `ActionResult`
- [ ] Create `src/app/dogrula/page.tsx`: email verification page (verifies link, shows success/error + resend option)
- [ ] Modify `verifyCredentials` in `src/server/users/service.ts`: if `emailVerified === null` → fail with "E-postanız doğrulanmamış." + resend button
- [ ] Modify `linkGoogleUser` in `src/server/users/service.ts`: if `emailVerified === null` on signin, set to `now()`
- [ ] Add email template `registerVerifyTemplate` in `src/lib/email/templates.ts`
- [ ] Add `sendRegisterVerify` in `src/lib/email/events.ts`
- [ ] Call `sendRegisterVerify` from `registerUser` in `src/server/users/service.ts` after user creation
- [ ] Add test for `verifyEmail` in `tests/server/users/service.test.ts`
- [ ] Add test for `verifyEmailAction` in `tests/server/users/actions.test.ts`
- [ ] Add test for verify page in `tests/app/dogru.test.ts`
- [ ] Run `npm run check` and ensure all tests pass
- [ ] Commit with ASCII-safe message: "feat: implement email verification with hmac-signed links"

### 4. Header: Session-Aware + Logout (Backlog #1, #2)

- [ ] Convert `src/components/SiteHeader.tsx` to client component (`"use client"`)
- [ ] Use `useSession` from `next-auth/react` instead of server `getSessionUser`
- [ ] Add unread message badge (SWR 15s polling to `/api/messages/unread-count`)
- [ ] Add sliding session refresh trigger (periodic `/api/auth/session` call via `useSession`)
- [ ] Ensure logout button calls `signOut` from `src/lib/auth.ts` (already in `signOutAction`)
- [ ] Add test for header in `tests/components/SiteHeader.test.tsx`
- [ ] Run `npm run check` and ensure all tests pass
- [ ] Commit with ASCII-safe message: "feat: session-aware header with logout and unread badge"

### 5. PhotoUploader: UTApi.deleteFiles (Backlog #3)

- [ ] Add `UTApi` import and `deleteFiles` call in `src/components/PhotoUploader.tsx` remove handler
- [ ] Extract key from UploadThing URL (pattern: `/f/<fileKey>`)
- [ ] Wrap in try/catch, silently swallow errors (best-effort)
- [ ] Mock in tests, no local token required
- [ ] Add test in `tests/upload.test.ts`
- [ ] Run `npm run check` and ensure all tests pass
- [ ] Commit with ASCII-safe message: "feat: photouploader deletes from uploadthing on remove"

### 6. Messaging System

- [ ] Create `src/server/messages/service.ts` with:
  - `startConversationCore(user, listingId)`: find or create Conversation (unique race handling P2002)
  - `sendMessageCore(user, conversationId, content)`: validate membership (renter/owner), Zod 1..2000 chars, rate-limit `MESSAGE_LIMIT=20/60s`, update `lastMessageAt`/`lastMessagePreview`, create Message
  - `markMessagesReadCore(user, conversationId)`: updateMany `readAt` where `senderId !== user.id AND readAt IS NULL`
  - `getConversationsCore(user)`: conversations where `renterId=user.id OR ownerId=user.id`, ordered by `lastMessageAt desc`, include unread count
  - `getConversationCore(user, conversationId)`: verify membership, return messages + listing info + booking status
- [ ] Create `src/server/messages/actions.ts` with corresponding actions wrapping cores with `requireUser()`
- [ ] Create `src/app/hesap/mesajlar/page.tsx`: conversation list with unread badges, SWR 15s polling
- [ ] Create `src/app/hesap/mesajlar/[id]/page.tsx`: conversation thread with SWR 5s polling, optimistic send, mark-read on mount
- [ ] Add "Sor" button on `/ilan/[id]` → calls `startConversation` action
- [ ] Add test for `startConversationCore` in `tests/server/messages/service.test.ts`
- [ ] Add test for `sendMessageCore` (rate-limit, membership, optimistic preview) in `tests/server/messages/service.test.ts`
- [ ] Add test for `markMessagesReadCore` in `tests/server/messages/service.test.ts`
- [ ] Add test for actions in `tests/server/messages/actions.test.ts`
- [ ] Add test for conversation list page in `tests/app/hesap/mesajlar.test.ts`
- [ ] Add test for conversation thread page in `tests/app/hesap/mesajlar/[id].test.ts`
- [ ] Run `npm run check` and ensure all tests pass
- [ ] Commit with ASCII-safe message: "feat: implement messaging system with polling and read receipts"

### 7. Reviews (Full CRUD + IP + Toggles)

- [ ] Add `reviewsEnabled` getter in `src/server/admin/service.ts` (reads `Setting` key, defaults to `true`)
- [ ] Create `src/server/reviews/service.ts` with:
  - `createReviewCore(user, listingId, bookingId, rating, comment)`: validates COMPLETED + own booking + unique bookingId, checks `reviewsEnabled` + owner `reviewsVisible`, captures IP from `headers()` `x-forwarded-for`, creates Review
  - `updateReviewCore(user, reviewId, rating, comment)`: author only, updates `updatedAt`
  - `deleteReviewCore(user, reviewId)`: author or ADMIN, hard delete
  - `getReviewsForListing(listingId)`: returns reviews + average rating (respects display guards: hides if `reviewsEnabled=false` OR owner `reviewsVisible=false`)
  - `getUserReviews(user)`: returns { written: Review[], received: Review[] }
- [ ] Create `src/server/reviews/actions.ts` with corresponding actions
- [ ] Create `src/app/ilan/[id]/yorum-yaz/page.tsx`: review form (only if COMPLETED + own booking + no existing review), 1-5 stars + comment ≤1000
- [ ] Create `src/app/hesap/degerlendirmeler/page.tsx`: two sections — "Yazdıklarım" (edit/delete buttons) and "İlanlarıma Yazılanlar" (view only)
- [ ] Update `/ilan/[id]/page.tsx`: show average stars + review list (respects display guards)
- [ ] Add `StarRating` server component in `src/components/StarRating.tsx` (SVG, clickable in form, display-only in view)
- [ ] Add admin setting toggle for `reviewsEnabled` in `/admin/ayarlar/page.tsx`
- [ ] Add owner toggle `reviewsVisible` in `/hesap/profil/page.tsx`
- [ ] Add test for `createReviewCore` (preconditions, IP capture, toggles) in `tests/server/reviews/service.test.ts`
- [ ] Add test for `updateReviewCore`/`deleteReviewCore` (authz) in `tests/server/reviews/service.test.ts`
- [ ] Add test for display guards in `tests/server/reviews/service.test.ts`
- [ ] Add test for actions in `tests/server/reviews/actions.test.ts`
- [ ] Add test for review form page in `tests/app/ilan/[id]/yorum-yaz.test.ts`
- [ ] Add test for reviews page in `tests/app/hesap/degerlendirmeler.test.ts`
- [ ] Run `npm run check` and ensure all tests pass
- [ ] Commit with ASCII-safe message: "feat: implement reviews with full crud, ip capture, and toggles"

### 8. Reports

- [ ] Create `src/server/reports/service.ts` with:
  - `createReportCore(user, targetType, targetId, reason)`: validates target exists, prevents duplicate OPEN report for same target by same user
  - `updateReportStatusCore(admin, reportId, status)`: state matrix OPEN→REVIEWING→CLOSED (no reopen), admin only
  - `getReportsCore()`: admin queue with target links, reporter, date, status badge
- [ ] Create `src/server/reports/actions.ts` with corresponding actions
- [ ] Add "Bildir" dialog on `/ilan/[id]/page.tsx` and `/hesap/profil/page.tsx` (reason 5-500 chars)
- [ ] Create `src/app/admin/sikayetler/page.tsx`: admin queue with status transitions
- [ ] Add test for `createReportCore` (duplicate prevention, target validation) in `tests/server/reports/service.test.ts`
- [ ] Add test for `updateReportStatusCore` (state matrix, authz) in `tests/server/reports/service.test.ts`
- [ ] Add test for report dialog in `tests/app/ilan/[id]/report.test.ts`
- [ ] Add test for admin reports page in `tests/app/admin/sikayetler.test.ts`
- [ ] Run `npm run check` and ensure all tests pass
- [ ] Commit with ASCII-safe message: "feat: implement reports with admin queue"

### 9. Email Digests

- [ ] Add `dailyDigestTemplate` in `src/lib/email/templates.ts`: up to 5 conversations with preview + unread count + "Mesajları gör" link
- [ ] Add `sendDailyDigest` in `src/lib/email/events.ts`: finds users with unread messages (`readAt: null` AND `createdAt` within 7 days), sends one email per user
- [ ] Create `src/app/api/cron/digest/route.ts`: Vercel cron 09:00 UTC (12:00 TR), Bearer `CRON_SECRET` validation, calls `sendDailyDigest`
- [ ] Add `vercel.json` cron entry for digest
- [ ] Add test for `sendDailyDigest` in `tests/lib/email/events.test.ts` (mock client, verifies query + template)
- [ ] Add test for cron route in `tests/cron.test.ts` (Bearer validation, empty result)
- [ ] Run `npm run check` and ensure all tests pass
- [ ] Commit with ASCII-safe message: "feat: implement daily message digest cron"

### 10. Admin Settings (reviewsEnabled)

- [ ] `updateSettingCore`/`updateSetting` already exist in `src/server/admin/` — verify `reviewsEnabled` key works
- [ ] Ensure `/admin/ayarlar/page.tsx` has toggle for `reviewsEnabled` (boolean)
- [ ] Add test for setting in `tests/server/admin/service.test.ts` (if not already)
- [ ] Run `npm run check` and ensure all tests pass
- [ ] Commit with ASCII-safe message: "feat: admin settings for reviews toggle"

### 11. COMPLETED Email Template (Backlog #5)

- [ ] Add `bookingCompletedTemplate` in `src/lib/email/templates.ts`: "Konaklama tamamlandı — deneyiminizi değerlendirin" + ilan linki
- [ ] Modify `completeDueBookings` in `src/lib/rate-limit.ts` (or wherever cron handler is) to use new template
- [ ] Add test for template in `tests/email.test.ts`
- [ ] Run `npm run check` and ensure all tests pass
- [ ] Commit with ASCII-safe message: "feat: completed booking email with review prompt"

### 12. Playwright E2E Tests

- [ ] Create `tests/e2e/playwright.config.ts`
- [ ] Scenario 1: Renter searches → views listing → sends booking request → sees "Bekliyor" in dashboard
- [ ] Scenario 2: Owner approves request → renter sees "Onaylandı"
- [ ] Scenario 3: Admin approves new listing → appears in search
- [ ] Scenario 4: Renter clicks "Sor" on listing → sends message → owner sees it + read receipt
- [ ] Scenario 5: COMPLETED fixture → renter writes review with stars → appears on listing detail
- [ ] Run `npx playwright test` and ensure all 5 pass
- [ ] Commit with ASCII-safe message: "test: add playwright e2e scenarios 1-5"

### 13. GitHub Actions CI

- [ ] Create `.github/workflows/ci.yml`:
  - `check` job: `npm ci` → `prisma generate` → `tsc --noEmit` → `eslint .` → `vitest run` (with postgres:16 service container, `TEST_DATABASE_URL`) → `next build`
  - `e2e` job (needs: check): `next start` → `npx playwright test` (chromium)
  - Triggers: push to `main`, all PRs
- [ ] Run CI manually or push to verify
- [ ] Commit with ASCII-safe message: "ci: add github actions workflow for check and e2e"

### 14. Final Integration & Verification

- [ ] Verify all features work together in browser (manual smoke test)
- [ ] Run `npm run build` and verify all routes are green
- [ ] Run `npm run check` and ensure all tests pass (vitest + playwright)
- [ ] Verify database changes are correct (migration applied, seed works)
- [ ] Ensure all commits have ASCII-safe messages
- [ ] Link any new PRs or issues via `session.link` with appropriate parameters
- [ ] Commit with ASCII-safe message: "feat: integrate social layer features"

## Verification

After completing all tasks:
1. Verify all tests pass with `npm run check`
2. Verify Playwright 5/5 pass
3. Verify CI pipeline green
4. Verify all routes work in the browser
5. Verify database changes are correct
6. Verify all new features are working as expected
7. Ensure all commits have ASCII-safe messages
8. Link any new PRs or issues via `session.link` with appropriate parameters