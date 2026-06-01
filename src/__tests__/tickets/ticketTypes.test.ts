import { describe, it, expect } from 'vitest';
import { LEGACY_TICKET_STATUSES } from '@/types/ticket';
import type { TicketStatus } from '@/types/ticket';

describe('ticket types', () => {
  it('TicketStatus accepts arbitrary catalog slug strings', () => {
    // Compile-time check: any string is assignable to TicketStatus now.
    const custom: TicketStatus = 'en-revision-interna';
    const legacy: TicketStatus = 'open';
    expect(custom).toBe('en-revision-interna');
    expect(legacy).toBe('open');
  });

  it('LEGACY_TICKET_STATUSES exports the four built-in statuses', () => {
    expect(LEGACY_TICKET_STATUSES).toEqual(['open', 'pending', 'resolved', 'closed']);
  });
});
