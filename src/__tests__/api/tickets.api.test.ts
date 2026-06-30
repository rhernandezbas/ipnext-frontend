import { describe, it, expect } from 'vitest';
import { getMockTicketStats } from '@/api/tickets.api';

describe('getMockTicketStats', () => {
  it('returns the canonical 3-state counters (open/pending/closed) the BE exposes', () => {
    const stats = getMockTicketStats();
    expect(stats.open).toEqual(expect.any(Number));
    expect(stats.pending).toEqual(expect.any(Number));
    expect(stats.closed).toEqual(expect.any(Number));
  });

  it('does NOT carry the legacy `resolved` counter (BE only returns open/pending/closed)', () => {
    const stats = getMockTicketStats();
    expect('resolved' in stats).toBe(false);
  });
});
