import { describe, expect, it } from 'vitest';
import { getAuctionWinnerGuideState } from '@/lib/auction-winner-guide';

const base = {
  orderStatus: 'pending_payment',
  pickupStatus: 'awaiting_payment',
  proposedPickupAt: null,
  proposedByCurrentUser: false,
  agreedPickupAt: null,
  paymentError: null,
  hasReviewed: false,
};

describe('auction winner guide', () => {
  it('starts with automatic payment processing', () => {
    const guide = getAuctionWinnerGuideState(base);
    expect(guide.currentStep).toBe(0);
    expect(guide.completedCount).toBe(0);
    expect(guide.title).toContain('payment is processing');
  });

  it('directs a buyer to manual payment when the automatic charge fails', () => {
    const guide = getAuctionWinnerGuideState({ ...base, paymentError: 'card_declined' });
    expect(guide.action).toBe('payment');
    expect(guide.actionLabel).toBe('Pay now');
  });

  it('advances to pickup arrangement after payment', () => {
    const guide = getAuctionWinnerGuideState({
      ...base,
      orderStatus: 'paid',
      pickupStatus: 'awaiting_arrangement',
    });
    expect(guide.completedCount).toBe(1);
    expect(guide.currentStep).toBe(1);
    expect(guide.action).toBe('pickup');
  });

  it('waits for seller readiness after a pickup time is agreed', () => {
    const guide = getAuctionWinnerGuideState({
      ...base,
      orderStatus: 'paid',
      pickupStatus: 'pickup_confirmed',
      agreedPickupAt: '2026-07-20T01:00:00.000Z',
    });
    expect(guide.completedCount).toBe(2);
    expect(guide.currentStep).toBe(2);
  });

  it('directs the buyer to their pickup code when ready', () => {
    const guide = getAuctionWinnerGuideState({
      ...base,
      orderStatus: 'ready_for_pickup',
      pickupStatus: 'ready_for_pickup',
      agreedPickupAt: '2026-07-20T01:00:00.000Z',
    });
    expect(guide.completedCount).toBe(3);
    expect(guide.currentStep).toBe(3);
    expect(guide.action).toBe('collection');
  });

  it('finishes only after collection and review', () => {
    const awaitingReview = getAuctionWinnerGuideState({
      ...base,
      orderStatus: 'collected',
      pickupStatus: 'completed',
      agreedPickupAt: '2026-07-20T01:00:00.000Z',
    });
    expect(awaitingReview.completedCount).toBe(4);
    expect(awaitingReview.action).toBe('review');

    const complete = getAuctionWinnerGuideState({
      ...base,
      orderStatus: 'collected',
      pickupStatus: 'completed',
      agreedPickupAt: '2026-07-20T01:00:00.000Z',
      hasReviewed: true,
    });
    expect(complete.completedCount).toBe(5);
    expect(complete.action).toBeNull();
  });
});
