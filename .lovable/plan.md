
# Implementation Plan: Portal Switching, Payment System, and End-to-End Testing

## Overview

This plan addresses three key requirements:
1. Seamless switching between Buyer and Seller portals for users who operate in both roles
2. Stripe payment integration for real transactions (card payments, seller payouts, platform fees)
3. End-to-end testing workflow

---

## Part 1: Dual-Role Portal Switching

### Current State
- Users can only have ONE role (buyer_admin OR seller_admin)
- The `AppLayout` component shows navigation based on a single role
- The `AuthContext` determines `isSeller` and `isBuyer` as mutually exclusive

### Solution: Enable Both Roles + Portal Switcher

#### Database Changes
Users can have MULTIPLE roles in the `user_roles` table (table already supports this with unique constraint on user_id + role, not just user_id).

**No schema migration needed** - users can already have both `buyer_admin` and `seller_admin` roles.

#### Code Changes

**1. Update `AuthContext.tsx`**
- Modify `isSeller` and `isBuyer` to NOT be mutually exclusive
- Both can be true simultaneously

**2. Create Portal Switcher Component**
New file: `src/components/app/PortalSwitcher.tsx`
- Dropdown in sidebar header showing current portal (Buyer/Seller)
- Click to switch between portals
- Shows "Add Seller Account" or "Add Buyer Account" if user only has one role

**3. Update `AppLayout.tsx`**
- Add PortalSwitcher to the sidebar header
- Track active portal in localStorage (e.g., `active_portal_${userId}`)
- Show nav items based on selected portal, not just roles

**4. Update `OnboardingWizard.tsx`**
- Add option to enable both roles after initial setup
- "Also want to sell/buy?" step after initial role selection

**5. Create "Become a Seller/Buyer" Flow**
New file: `src/pages/app/AddRole.tsx`
- Allows existing users to add the other role
- Creates new organization for the role if needed
- Adds the user_role entry

---

## Part 2: Stripe Payment Integration

### Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         PAYMENT FLOW                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  BUYER                    PLATFORM                    SELLER        │
│                                                                     │
│  [Bid/Buy] ──────────► [Hold Payment] ◄───────────── [Listing]     │
│                              │                                      │
│                              ▼                                      │
│                    [Auction Closes/Sale]                           │
│                              │                                      │
│                   ┌──────────┴──────────┐                          │
│                   ▼                      ▼                          │
│             [Buyer Fee 10%]       [Seller Fee 10%]                 │
│                   │                      │                          │
│                   ▼                      ▼                          │
│            [To Platform]          [To Platform]                    │
│                                         │                          │
│                              [Net to Seller 90%]                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Stripe Connect Implementation

#### Step 1: Enable Stripe
Use Lovable's Stripe integration tool to:
- Collect Stripe Secret Key from user
- Configure Stripe Connect for marketplace payments

#### Step 2: Database Tables
New migration for payment tracking:

```text
payments table:
- id (uuid)
- order_id (uuid, FK to orders)
- stripe_payment_intent_id (text)
- stripe_charge_id (text)
- amount_charged (numeric) - total charged to buyer
- buyer_fee (numeric) - 10% platform fee from buyer
- seller_fee (numeric) - 10% platform fee from seller
- seller_payout (numeric) - net to seller (90% of base)
- status (payment_status enum: pending, processing, succeeded, failed, refunded)
- created_at, updated_at

seller_stripe_accounts table:
- id (uuid)
- org_id (uuid, FK to organizations)
- stripe_account_id (text)
- onboarding_complete (boolean)
- payouts_enabled (boolean)
- created_at, updated_at
```

#### Step 3: Edge Functions

**A. `stripe-connect-onboard` Edge Function**
- Creates Stripe Connected Account for sellers
- Generates onboarding link
- Handles webhook for account updates

**B. `process-payment` Edge Function**
- Creates PaymentIntent with Stripe Connect
- Handles card tokenization
- Calculates fees:
  - Base price (e.g., $100)
  - Buyer fee: +10% (buyer pays $110)
  - Seller fee: -10% (seller receives $90)
  - Platform keeps: $20 ($10 buyer fee + $10 seller fee)

**C. `stripe-webhooks` Edge Function**
- Handles payment_intent.succeeded
- Handles payout events
- Updates order status

#### Step 4: Frontend Components

**A. Buyer Checkout Page**
New file: `src/pages/app/buyer/Checkout.tsx`
- Stripe Elements for card input
- Show itemized breakdown:
  - Item price: $100
  - Buyer fee (10%): $10
  - Total: $110
- Submit payment
- Redirect to order confirmation

**B. Seller Onboarding**
New file: `src/pages/app/seller/StripeConnect.tsx`
- Connect Stripe button
- Shows Stripe onboarding status
- Display payout history

**C. Order Detail Updates**
- Show payment status
- Show fee breakdown
- For sellers: show payout information

---

## Part 3: Updated Flow Implementation

### Order Flow with Payments

1. **Auction Won / Buy Now Clicked**
   - Order created with `pending_payment` status
   - Buyer redirected to checkout

2. **Checkout Page**
   - Display lot details, fees
   - Stripe card form
   - Submit creates PaymentIntent via edge function

3. **Payment Success**
   - Webhook updates order to `paid`
   - Creates payment record
   - Notifies both buyer and seller

4. **Pickup Complete**
   - Order marked as `collected`
   - Triggers seller payout (if using delayed payouts)

---

## Part 4: File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `src/components/app/PortalSwitcher.tsx` | Dropdown to switch between Buyer/Seller portals |
| `src/pages/app/AddRole.tsx` | Add second role (become seller/buyer) |
| `src/pages/app/buyer/Checkout.tsx` | Stripe payment checkout page |
| `src/pages/app/seller/StripeConnect.tsx` | Seller Stripe onboarding |
| `supabase/functions/stripe-connect-onboard/index.ts` | Seller Stripe account creation |
| `supabase/functions/process-payment/index.ts` | Handle card payments |
| `supabase/functions/stripe-webhooks/index.ts` | Handle Stripe webhooks |

### Modified Files
| File | Changes |
|------|---------|
| `src/contexts/AuthContext.tsx` | Allow both isSeller and isBuyer to be true |
| `src/components/app/AppLayout.tsx` | Add PortalSwitcher, track active portal |
| `src/components/app/RoleGuard.tsx` | Update to allow dual-role access |
| `src/components/onboarding/OnboardingWizard.tsx` | Option to add second role |
| `src/pages/LotDetail.tsx` | Redirect to checkout instead of creating order directly |
| `supabase/functions/auction-engine/index.ts` | Update to work with payment system |

### Database Migration
- Add `payments` table
- Add `seller_stripe_accounts` table
- Add `payment_status` enum

---

## Part 5: End-to-End Testing Plan

### Test Scenario 1: Seller Flow
1. Sign up as new user → Select "I want to sell"
2. Verify redirect to Seller Portal
3. Connect Stripe account (test mode)
4. Create new clearance event
5. Add lot with photos (test image upload)
6. Set auction with start price and reserve
7. Publish event
8. Verify lot appears in marketplace

### Test Scenario 2: Buyer Flow
1. Sign up as different user → Select "I want to buy"
2. Browse marketplace
3. Place bid on auction lot
4. Verify bid updates in real-time
5. Win auction (wait for end or use test controls)
6. Complete checkout with test card (4242 4242 4242 4242)
7. Verify order created with correct fees

### Test Scenario 3: Dual-Role User
1. Logged in as buyer
2. Use "Become a Seller" option
3. Verify can switch between portals
4. Create listing as seller
5. Switch to buyer portal
6. Place bid on different lot

### Test Scenario 4: Payment Settlement
1. Verify seller receives payout notification
2. Check fee calculations (10% buyer + 10% seller)
3. Verify platform keeps 20% of base price

---

## Technical Implementation Order

### Phase 1: Portal Switching (Immediate)
1. Update AuthContext for dual roles
2. Create PortalSwitcher component
3. Update AppLayout with switcher
4. Create AddRole page

### Phase 2: Stripe Setup (Requires Stripe Enable)
1. Enable Stripe integration via Lovable tool
2. Create database tables for payments
3. Implement edge functions
4. Build checkout page

### Phase 3: Integration
1. Connect auction engine to payment flow
2. Update order management for payments
3. Build seller payout dashboard

### Phase 4: Testing
1. Automated browser testing
2. Test card numbers for various scenarios
3. Verify fee calculations

---

## Security Considerations

- All payment processing happens server-side (Edge Functions)
- Card details never touch our servers (Stripe Elements)
- RLS policies ensure users only see their own payment data
- Webhook signatures verified to prevent spoofing
- Seller payouts require completed onboarding

---

## Fee Summary

| Transaction | Buyer Pays | Seller Receives | Platform Keeps |
|-------------|------------|-----------------|----------------|
| $100 item   | $110 (+10%)| $90 (-10%)      | $20 (20% of base) |
| $500 item   | $550       | $450            | $100 |
| $1000 item  | $1100      | $900            | $200 |
