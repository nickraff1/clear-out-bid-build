import type { ClearanceEvent, EventStatus } from '@/types/database';

type EventLifecycleFields = Pick<ClearanceEvent, 'pickup_end' | 'status'>;

export type EffectiveEventStatus = EventStatus | 'expired';

export function isEventExpired(
  event: Pick<EventLifecycleFields, 'pickup_end'>,
  now = new Date(),
): boolean {
  const pickupEnd = new Date(event.pickup_end).getTime();
  return Number.isFinite(pickupEnd) && pickupEnd <= now.getTime();
}

export function getEffectiveEventStatus(
  event: EventLifecycleFields,
  now = new Date(),
): EffectiveEventStatus {
  if (event.status !== 'cancelled' && isEventExpired(event, now)) {
    return 'expired';
  }

  return event.status;
}

export function canAddListingToEvent(event: EventLifecycleFields, now = new Date()): boolean {
  return (
    !isEventExpired(event, now) &&
    (event.status === 'draft' || event.status === 'active')
  );
}
