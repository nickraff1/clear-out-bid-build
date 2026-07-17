export type WinnerGuideAction = 'payment' | 'pickup' | 'collection' | 'message' | 'review' | null;

export type WinnerGuideStepState = 'complete' | 'current' | 'upcoming';

export type AuctionWinnerGuideInput = {
  orderStatus: string;
  pickupStatus: string | null;
  proposedPickupAt: string | null;
  proposedByCurrentUser: boolean;
  agreedPickupAt: string | null;
  paymentError?: string | null;
  hasReviewed: boolean;
};

export type AuctionWinnerGuideStep = {
  title: string;
  description: string;
  state: WinnerGuideStepState;
};

export type AuctionWinnerGuideState = {
  completedCount: number;
  currentStep: number;
  title: string;
  description: string;
  action: WinnerGuideAction;
  actionLabel: string | null;
  steps: AuctionWinnerGuideStep[];
};

const STEP_COPY = [
  {
    title: 'Payment confirmation',
    description: 'Offcutt charges your saved card and confirms the order.',
  },
  {
    title: 'Arrange pickup',
    description: 'Agree on a pickup time with the seller through the order page.',
  },
  {
    title: 'Prepare to collect',
    description: 'Wait for the seller to mark the item ready and check the loading details.',
  },
  {
    title: 'Inspect and collect',
    description: 'Inspect the item before sharing your pickup code or confirming collection.',
  },
  {
    title: 'Complete and review',
    description: 'The seller confirms your code, then you can review the transaction.',
  },
] as const;

const PAID_ORDER_STATUSES = new Set(['paid', 'ready_for_pickup', 'collected']);
const ARRANGED_PICKUP_STATUSES = new Set([
  'pickup_confirmed',
  'ready_for_pickup',
  'collected_pending_seller_confirmation',
  'completed',
]);
const READY_PICKUP_STATUSES = new Set([
  'ready_for_pickup',
  'collected_pending_seller_confirmation',
  'completed',
]);
const COLLECTED_PICKUP_STATUSES = new Set(['collected_pending_seller_confirmation', 'completed']);

export function getAuctionWinnerGuideState(input: AuctionWinnerGuideInput): AuctionWinnerGuideState {
  const paymentComplete = PAID_ORDER_STATUSES.has(input.orderStatus);
  const pickupArranged = Boolean(input.agreedPickupAt) || ARRANGED_PICKUP_STATUSES.has(input.pickupStatus ?? '');
  const sellerReady = ['ready_for_pickup', 'collected'].includes(input.orderStatus)
    || READY_PICKUP_STATUSES.has(input.pickupStatus ?? '');
  const buyerCollected = input.orderStatus === 'collected'
    || COLLECTED_PICKUP_STATUSES.has(input.pickupStatus ?? '');
  const orderComplete = input.orderStatus === 'collected' || input.pickupStatus === 'completed';

  const complete = [
    paymentComplete,
    pickupArranged,
    sellerReady,
    buyerCollected,
    orderComplete && input.hasReviewed,
  ];
  const completedCount = complete.filter(Boolean).length;
  const currentStep = complete.findIndex((value) => !value);
  const resolvedCurrentStep = currentStep === -1 ? STEP_COPY.length - 1 : currentStep;

  let title = 'Payment is being confirmed';
  let description = 'Your saved card is being charged automatically. Keep this order page handy for updates.';
  let action: WinnerGuideAction = null;
  let actionLabel: string | null = null;

  if (!paymentComplete && input.paymentError) {
    title = 'Your payment needs attention';
    description = 'The automatic charge did not complete. Pay from this order before the winner payment window expires.';
    action = 'payment';
    actionLabel = 'Pay now';
  } else if (!paymentComplete) {
    title = 'You won - payment is processing';
    description = 'Offcutt is charging your saved card. Pickup details unlock as soon as payment is confirmed.';
  } else if (!pickupArranged) {
    if (input.proposedPickupAt && input.proposedByCurrentUser) {
      title = 'Pickup time sent';
      description = 'The seller needs to accept your proposed time. You can message them if anything changes.';
      action = 'message';
      actionLabel = 'Message seller';
    } else if (input.proposedPickupAt) {
      title = 'The seller proposed a pickup time';
      description = 'Review the proposed time, then accept it or suggest a different time.';
      action = 'pickup';
      actionLabel = 'Review pickup time';
    } else {
      title = 'Arrange your pickup';
      description = 'Propose a suitable time or message the seller. The exact address and loading notes are on this order.';
      action = 'pickup';
      actionLabel = 'Arrange pickup';
    }
  } else if (!sellerReady) {
    title = 'Pickup is arranged';
    description = 'Check the address, access notes, vehicle and loading help. The seller will notify you when the item is ready.';
    action = 'message';
    actionLabel = 'Message seller';
  } else if (!buyerCollected) {
    title = 'Your item is ready to collect';
    description = 'Bring the right vehicle and help. Inspect the item before sharing your pickup code or marking it collected.';
    action = 'collection';
    actionLabel = 'View pickup code';
  } else if (!orderComplete) {
    title = 'Waiting for seller confirmation';
    description = 'You marked the item collected. The seller must confirm your pickup code to complete the order.';
    action = 'message';
    actionLabel = 'Message seller';
  } else if (!input.hasReviewed) {
    title = 'Collection complete';
    description = 'The transaction is complete. Share a review to help other Offcutt buyers and sellers.';
    action = 'review';
    actionLabel = 'Leave a review';
  } else {
    title = 'Auction journey complete';
    description = 'Payment, pickup and your review are complete.';
  }

  return {
    completedCount,
    currentStep: resolvedCurrentStep,
    title,
    description,
    action,
    actionLabel,
    steps: STEP_COPY.map((step, index) => ({
      ...step,
      state: complete[index] ? 'complete' : index === resolvedCurrentStep ? 'current' : 'upcoming',
    })),
  };
}
