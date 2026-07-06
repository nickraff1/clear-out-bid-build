# Fix Buyer Payment Methods & $1 Bid Increment

## Problem

1. **"Could not retrieve elements store due to unexpected error"** in the Add Payment Method dialog on the lot page. The Stripe Elements `clientSecret` is passed via `options`, but the `<Elements>` provider is being remounted (the `stripePromise` state changes right as `clientSecret` changes) and/or the `appearance.theme: 'night'` value is rejected in the current Elements version — the "retrieve elements store" error is Stripe.js's signature for an Elements instance that never finished bootstrapping. Root cause here: `getStripe()` is stored in React state on each `open`, generating a fresh promise each time even though the module caches it — the effect resets `paymentEnvironment` back to `'sandbox'` before the fetch resolves, so Elements mounts against the wrong publishable key (env mismatch between platform SetupIntent and pk).
2. **No buyer-portal page to manage saved cards** — a buyer must currently open a lot to add a card, and can never see/replace/delete it.
3. **Bid increment min is $5** — user wants $1 across the board.

## Changes

### 1. `src/components/bidder/AddPaymentMethodDialog.tsx` — fix loading

- Drop the `stripePromise` state; call `getStripe()` directly inline (module already memoises).
- Don't touch `paymentEnvironment` in the reset branch — keep the value that was returned by `create-bidder-setup-intent` alongside `client_secret`, and only render `<Elements>` once both are present.
- Change appearance to `{ theme: 'stripe' }` (the `'night'` theme paired with the light dialog is what surfaces the elements-store error on the current @stripe/react-stripe-js version).
- Add a small "Add another card" hook: if `onSaved` receives a payment method, close and refetch.

### 2. New page — `src/pages/app/buyer/BuyerPaymentMethods.tsx`

Buyer portal page at `/app/buyer/payment-methods`:

- Query `bidder_verifications` for current user to show the currently saved card (brand, last4, exp) — data already lives on that row (`stripe_payment_method_id`, plus card metadata we'll return from the confirm function).
- "Add / replace card" button opens the existing `AddPaymentMethodDialog`.
- After save, refresh and show the new card.
- Empty state: "No saved card. Add one to bid on auctions." with CTA opening the dialog.

Wire in:
- `src/App.tsx` — add route `/app/buyer/payment-methods` guarded like the other buyer routes.
- `src/components/app/AppLayout.tsx` — add nav item "Payment Methods" (CreditCard icon) in the buyer nav array, between Orders and Watchlist.
- `src/pages/app/buyer/BuyerOverview.tsx` — add a small "Payment Method" tile linking to the new page (surfacing whether a card is on file).

### 3. Return card metadata from `confirm-bidder-payment-method`

Update the edge function to also persist `card_brand`, `card_last4`, `card_exp_month`, `card_exp_year` on `bidder_verifications` (nullable columns already exist? — will verify; add migration if missing) so the Payment Methods page can render "Visa •••• 4242".

### 4. Bid increment → $1

`src/lib/constants.ts`: replace `BID_INCREMENTS` with a single tier `{ upTo: Infinity, increment: 1 }`, and update `getBidIncrement` fallback to `1`. This flows through `getMinNextBid`, lot detail's "Min $X" placeholder, and the "Increment $5" label on the lot page.

## Verification

- Open a lot as a buyer with no saved card → click "Add payment method" → dialog loads Stripe Elements, card `4242 4242 4242 4242` saves, "Place bid" becomes enabled.
- Buyer portal → "Payment Methods" shows the saved card and lets the buyer replace it.
- Lot page shows "Increment $1" and Min next bid = current + $1.

## Files

- edit `src/components/bidder/AddPaymentMethodDialog.tsx`
- add `src/pages/app/buyer/BuyerPaymentMethods.tsx`
- edit `src/App.tsx`, `src/components/app/AppLayout.tsx`, `src/pages/app/buyer/BuyerOverview.tsx`
- edit `supabase/functions/confirm-bidder-payment-method/index.ts` (+ migration if card_* columns missing)
- edit `src/lib/constants.ts`
