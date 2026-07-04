# Set Up Custom Domain + Branded Auth Emails

Goal: unblock signup emails (and every future transactional email) by moving off the shared default sender onto your own verified domain. Once done, `nickraff1@gmail.com` and every future user will reliably receive verification, password reset, order confirmation, and pickup emails from your brand.

---

## Phase 1 — Purchase your domain (you do this, ~5 min)

1. Open **Project Settings → Project section → Domains** (or use the Publish dialog → Add custom domain).
2. Click **Buy new domain**.
3. Search for the domain you want (e.g. `offcutt.com`, `offcutt.co`, `offcutt.app`, etc.).
4. Complete contact + payment details and purchase.

Once purchased, Lovable auto-connects it to this project — no DNS work required from you.

**Tell me the domain you bought** when you're done, then I move to Phase 2.

---

## Phase 2 — Set up email sender domain (I do this)

I will:
1. Call the email setup flow to provision a sending subdomain (e.g. `notify.yourdomain.com`). Because you bought the domain through Lovable, DNS/NS records are added automatically — no manual copy-paste at a registrar.
2. Provision the email infrastructure (queue, send log, suppression list, cron worker).

You'll see a status of "verifying" for a few minutes while DNS propagates. Scaffolding in Phase 3 does NOT need to wait for verification.

---

## Phase 3 — Scaffold + brand auth email templates (I do this)

I will:
1. Scaffold the 6 auth email templates (signup confirmation, magic link, password reset, invite, email change, reauthentication) and the `auth-email-hook`.
2. Style them to match Offcutt: dark ops-tool aesthetic, orange primary CTA, black/white contrast, brand voice ("Confirm your Offcutt account", not "Verify Email").
3. Deploy the hook.

Result: as soon as DNS verifies (usually <10 min), every auth email — starting with your `nickraff1@gmail.com` signup retry — will land from `notify.yourdomain.com` in the inbox, not spam.

---

## Phase 4 — Test the signup that failed (you do this)

1. Go to the live signup page.
2. Sign up as `nickraff1@gmail.com` (already fully deleted from the previous attempts, so it counts as a first-time signup).
3. Confirm the email arrives from your new domain.
4. Ping me the moment it lands — then we move directly into the original Phase 2B plan (dual seller/buyer live-test accounts + Stripe Connect onboarding).

---

## Optional Phase 5 (recommended, can defer)

Scaffold transactional (app) emails for order confirmations, pickup codes, bid notifications, and payout notifications so the entire post-purchase flow sends from your brand too. Say the word and I'll add this after Phase 4 passes.

---

### What I need from you right now

Just the domain name once you've purchased it. Everything after that I handle end to end.
