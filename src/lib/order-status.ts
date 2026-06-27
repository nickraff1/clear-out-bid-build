export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'ready_for_pickup'
  | 'collected'
  | 'cancelled'
  | 'awaiting_arrangement';

export type BadgeTone = 'success' | 'info' | 'warning' | 'muted' | 'destructive';

const LABELS: Record<string, string> = {
  pending_payment: 'Pending payment',
  paid: 'Paid',
  awaiting_arrangement: 'Awaiting pickup',
  ready_for_pickup: 'Ready for pickup',
  collected: 'Collected',
  cancelled: 'Cancelled',
};

const TONES: Record<string, BadgeTone> = {
  pending_payment: 'warning',
  paid: 'success',
  awaiting_arrangement: 'info',
  ready_for_pickup: 'info',
  collected: 'success',
  cancelled: 'destructive',
};

export function orderStatusLabel(status: string): string {
  return (
    LABELS[status] ??
    status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  );
}

export function orderStatusTone(status: string): BadgeTone {
  return TONES[status] ?? 'muted';
}

const PICKUP_LABELS: Record<string, string> = {
  awaiting_payment: 'Awaiting payment',
  awaiting_arrangement: 'Awaiting pickup arrangement',
  pickup_proposed: 'Pickup time proposed',
  pickup_agreed: 'Pickup time confirmed',
  ready_for_pickup: 'Ready for pickup',
  collected_pending_seller_confirmation: 'Awaiting seller confirmation',
  collected: 'Collected',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function pickupStatusLabel(status: string): string {
  return (
    PICKUP_LABELS[status] ??
    status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  );
}