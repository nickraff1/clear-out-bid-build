## What's actually wrong

The relisted lot is `status='active'` on the seller side, but Marketplace filters lots by `clearance_events.pickup_end >= now()`. Your event's pickup window is:

- pickup_start: **2026-07-05 17:00 UTC**
- pickup_end: **2026-07-05 18:55 UTC** (already in the past)
- new auction_end: **2026-07-07 07:00 UTC**

So the auction now ends **~2 days after the pickup window has already closed**. Marketplace hides it, and the `bids_check_pickup_window` trigger would block bids anyway. The original active lot is invisible for the exact same reason — this isn't specific to the relist.

Also: relisting a lot without adjusting the parent event's pickup window will always produce this broken state whenever the old event's pickup has passed. The current `relist_auction_lot` function only touches the lot, never the event, so every relist of an expired event silently ships a dead listing.

## Full fix (not a patch)

### 1. Rework `relist_auction_lot` to guarantee a coherent, biddable state

New signature:

```
relist_auction_lot(
  p_lot_id           uuid,
  p_auction_end      timestamptz,
  p_pickup_start     timestamptz,   -- required
  p_pickup_end       timestamptz,   -- required
  p_start_price      numeric  = NULL,
  p_reserve_price    numeric  = NULL
)
```

Behavior:

- Auth: caller must be a member of the lot's org (unchanged).
- Validate: `p_auction_end > now()`, `p_pickup_start >= p_auction_end`, `p_pickup_end > p_pickup_start`.
- Clone the lot (fresh bids/status='active', copy media using the correct `type, is_primary, sort_order` columns, copy compliance tags) — as today.
- **Extend, never shrink, the parent event's pickup window**: set `pickup_start = LEAST(existing, p_pickup_start)` and `pickup_end = GREATEST(existing, p_pickup_end)`.
- If the parent event's `status` is `draft` or `completed`, set it to `active` so the seller doesn't have to hunt for it.
- Return the new lot id.

### 2. Rework the relist dialog to collect a pickup window

`src/components/seller/RelistAuctionDialog.tsx` becomes:

- Load the parent event's current `pickup_start / pickup_end` so we can show them.
- Fields:
  - **New auction end** (datetime-local) — default: now + 7 days.
  - **Pickup window start** (datetime-local) — default: `auction_end` (auto-shifts when auction_end changes if the user hasn't manually edited it).
  - **Pickup window end** (datetime-local) — default: `auction_end + 3 days` (same auto-shift rule).
  - **Start price** and **Reserve price** — unchanged.
- Inline helper text: "Current event pickup: {start} → {end}. Relisting will extend the event window if needed."
- Client-side validation with clear errors: pickup start ≥ auction end, pickup end > pickup start.
- Submit calls the new RPC signature.

### 3. Regenerate types and confirm both entry points still work

- Types regenerate automatically after the migration.
- `SellerLots.tsx` and `EventDetail.tsx` already pass the lot into `RelistAuctionDialog`; no changes needed beyond passing the event's pickup window (fetch inside the dialog by `lot.event_id`, so nothing changes at the call sites).

### 4. Verify end-to-end on the existing broken event

After the migration + UI change, relist the Stone Benchtop lot with:

- auction_end = now + 10 min (fast smoke test)
- pickup_start = auction_end
- pickup_end = auction_end + 2 days

Then confirm:

- Marketplace lists it (pickup_end is now in the future).
- Placing a bid succeeds (the pickup-window trigger no longer rejects).
- The event's `pickup_end` moved forward and its status flipped to `active`.

## Files changed

- `supabase/migrations/…` — replace `public.relist_auction_lot` with the new version above.
- `src/components/seller/RelistAuctionDialog.tsx` — add pickup window fields, load parent event, new validation, new RPC args.
- No changes required in `SellerLots.tsx` or `EventDetail.tsx`.
