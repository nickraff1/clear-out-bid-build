import { describe, expect, it } from 'vitest';
import {
  canAddListingToEvent,
  getEffectiveEventStatus,
  isEventExpired,
} from '@/lib/event-lifecycle';

const now = new Date('2026-07-15T06:00:00.000Z');

describe('event lifecycle', () => {
  it('treats an event as expired once its pickup end has passed', () => {
    const event = { status: 'active' as const, pickup_end: '2026-07-14T23:59:59.000Z' };

    expect(isEventExpired(event, now)).toBe(true);
    expect(getEffectiveEventStatus(event, now)).toBe('expired');
    expect(canAddListingToEvent(event, now)).toBe(false);
  });

  it('allows listings on current draft or active events', () => {
    const event = { status: 'active' as const, pickup_end: '2026-07-16T00:00:00.000Z' };

    expect(getEffectiveEventStatus(event, now)).toBe('active');
    expect(canAddListingToEvent(event, now)).toBe(true);
  });

  it('does not allow listings on completed or cancelled events', () => {
    expect(canAddListingToEvent({ status: 'completed', pickup_end: '2026-07-16T00:00:00.000Z' }, now)).toBe(false);
    expect(canAddListingToEvent({ status: 'cancelled', pickup_end: '2026-07-16T00:00:00.000Z' }, now)).toBe(false);
  });
});
