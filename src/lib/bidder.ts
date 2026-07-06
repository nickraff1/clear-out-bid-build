import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getStripeEnvironment } from '@/lib/stripe';

export type BidEligibility = {
  allowed: boolean;
  reason: string;
  required_deposit: number;
};

const REASON_COPY: Record<string, { title: string; body: string }> = {
  verification_required: {
    title: 'Bidder verification required',
    body: 'Set up bidder verification before placing your first bid.',
  },
  terms_acceptance_required: {
    title: 'Accept the auction terms',
    body: 'Bids are legally binding. Accept the auction terms to continue.',
  },
  account_restricted: {
    title: 'Bidding restricted',
    body: 'Your account is currently restricted from bidding. Contact support.',
  },
  account_banned: {
    title: 'Account banned',
    body: 'This account is not permitted to place bids.',
  },
  unpaid_previous_auction: {
    title: 'Unpaid auction win',
    body: 'You have an unpaid auction win. Resolve it before bidding again.',
  },
  auction_not_active: { title: 'Auction not active', body: 'This lot is not currently accepting bids.' },
  auction_ended: { title: 'Auction ended', body: 'This auction has already ended.' },
  payment_method_required: {
    title: 'Add a payment method',
    body: 'Save a card on file so we can charge it automatically if you win.',
  },
  deposit_required: {
    title: 'Authorize bid deposit',
    body: 'This price tier requires a deposit hold on your card. The hold is released if you do not win.',
  },
  ok: { title: 'Eligible to bid', body: '' },
};

export function reasonCopy(reason: string) {
  return REASON_COPY[reason] ?? { title: 'Cannot bid', body: reason };
}

export function useBidEligibility(lotId: string | undefined) {
  const { user } = useAuth();
  const [eligibility, setEligibility] = useState<BidEligibility | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !lotId) {
      setEligibility(null);
      return;
    }
    setLoading(true);
    let paymentEnvironment: 'sandbox' | 'live';
    try {
      paymentEnvironment = getStripeEnvironment();
    } catch {
      setEligibility({ allowed: false, reason: 'payment_method_required', required_deposit: 0 });
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .rpc('can_user_bid_for_environment', {
        _user_id: user.id,
        _lot_id: lotId,
        _environment: paymentEnvironment,
      })
      .maybeSingle();
    if (!error && data) {
      setEligibility({
        allowed: !!data.allowed,
        reason: data.reason ?? 'unknown',
        required_deposit: Number(data.required_deposit ?? 0),
      });
    }
    setLoading(false);
  }, [user, lotId]);

  useEffect(() => { refresh(); }, [refresh]);
  return { eligibility, loading, refresh };
}

export async function acceptAuctionTerms() {
  return supabase.rpc('accept_auction_terms');
}

export async function authorizeBidDeposit(lotId: string) {
  return supabase.functions.invoke('authorize-bid-deposit', {
    body: { lot_id: lotId, environment: getStripeEnvironment() },
  });
}