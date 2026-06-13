/**
 * RecaptacionTableView — tests for:
 *   #3b  Assignee column shows assigneeName (not assigneeId)
 */
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RecaptacionTableView } from '@/pages/customers/RecaptacionPage/components/RecaptacionTableView';
import type { RecaptureLeadDto } from '@/types/recaptacion';

const BASE_LEAD: RecaptureLeadDto = {
  id: 'lead-1',
  source: 'churned_client',
  clientId: null,
  contactName: 'Pedro Ruiz',
  phone: null,
  email: null,
  status: 'nuevo',
  assigneeId: null,
  assigneeName: null,
  claimedAt: null,
  createdAt: '2026-06-13T00:00:00Z',
  updatedAt: '2026-06-13T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RecaptacionTableView — assignee name (#3b)', () => {
  it('T1 — renders assigneeName when present', () => {
    const lead: RecaptureLeadDto = {
      ...BASE_LEAD,
      assigneeId: 'user-77',
      assigneeName: 'Carlos Sánchez',
    };
    render(<RecaptacionTableView leads={[lead]} />);
    expect(screen.getByText('Carlos Sánchez')).toBeInTheDocument();
    expect(screen.queryByText('user-77')).not.toBeInTheDocument();
  });

  it('T2 — shows "—" when assigneeName is null and assigneeId is also null', () => {
    render(<RecaptacionTableView leads={[BASE_LEAD]} />);
    // At minimum one "—" for the assignee cell
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('T3 — falls back to assigneeId when assigneeName is null but assigneeId exists', () => {
    const lead: RecaptureLeadDto = {
      ...BASE_LEAD,
      assigneeId: 'user-42',
      assigneeName: null,
    };
    render(<RecaptacionTableView leads={[lead]} />);
    // Should show the id as last resort, not "—"
    expect(screen.getByText('user-42')).toBeInTheDocument();
  });
});
