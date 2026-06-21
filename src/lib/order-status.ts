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