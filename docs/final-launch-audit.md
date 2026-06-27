# Final Launch Audit

## Summary

Offcutt is a beta marketplace with working buyer, seller and admin surfaces. The codebase is close to closed beta readiness, but public launch still depends on live payment validation, legal review, email/notification maturity, and deeper end-to-end QA.

## System classification

| Area | Status | Notes |
| --- | --- | --- |
| Auth/signup/login/reset | Working but needs QA | Supabase auth and reset route exist. |
| Buyer onboarding | Working but needs polish | Buyer role defaults and portal exist. |
| Seller onboarding | Working but needs polish | Seller portal and organisation creation exist. |
| Seller profile/business profile | Working but needs polish | Org fields and admin seller controls exist. |
| Listing creation/edit/publish | Working but needs QA | Forms exist; photo storage policy needs external verification. |
| Photo upload | Risky / needs QA | UI exists, storage rules not fully audited here. |
| Marketplace browse/filter/sort | Launch-ready for beta | Category URL bug fixed and tested. |
| Listing detail | Launch-ready for beta | Safety notes, report, auction terms visible. |
| Watchlist | Working but needs QA | Canonical and compatibility routes work. |
| Buyer messaging seller | Working but needs QA | Conversation RPC added to reduce not-found failures. |
| Buy-now checkout | Risky / needs QA | Payment functions exist; live mode not approved. |
| Payment webhook handling | Risky / needs QA | Success/failure/cancel/expiry handling exists. Needs live/sandbox event QA. |
| Order creation | Working but needs QA | Buy/auction/order paths exist. |
| Listing status after purchase | Working but needs QA | Webhook marks lot sold. |
| Buyer order page | Working but needs QA | Pickup, message, report, review controls exist. |
| Seller order/pickup page | Working but needs QA | Sales and pickup pages exist. |
| Pickup scheduling/code/completion | Working but needs QA | Pickup code and status flow exist; admin override exists. |
| Review unlock | Partially implemented | Review dialog exists after completion; needs full QA. |
| Issue reporting | Working but needs polish | Reports and admin resolution exist. |
| Admin orders | Working but needs QA | Notes, cancel, force-complete, pickup code. |
| Admin payments/payouts | Working but needs QA | Manual payout status controls exist. |
| Admin reports/issues | Working but needs QA | Resolution flow exists. |
| Admin launch checklist | Improved | Admin and messaging checks added. |
| Admin listing moderation | Partially implemented | Listing page exists; action coverage needs QA. |
| Auction bidding | Risky / needs QA | RPCs/functions exist; live auction restrictions still need test proof. |
| Auction expiry/closer | Working but needs QA | Close function and admin button exist. |
| Anti-snipe/soft-close | Risky / needs QA | Present in auction logic, not fully verified here. |
| Seller self-bid guard | Working but needs QA | Server-side protections exist in migrations/functions. |
| Dummy bidder protection | Partially implemented | Bidder status/deposit scaffolding exists; public-launch blocker until proven. |
| Notifications | Working but needs QA | Realtime channel bug fixed; email not proven. |
| Email readiness | Missing / blocker for public launch | In-app notifications exist; email delivery not proven. |
| Policy/legal pages | Working but needs legal review | Beta-ready pages exist. |
| Mobile buyer/seller/admin | Risky / needs QA | Needs dedicated mobile pass. |
| Security/RLS | Working but needs audit | Admin messaging RLS improved. Full RLS audit still recommended. |
| Environment/deployment | Partially implemented | Docs added; live secrets not present. |
| Observability/logging | Missing / public-launch blocker | No production monitoring integration in repo. |
| Stuck state detection | Improved | Admin launch checklist includes key checks. |
