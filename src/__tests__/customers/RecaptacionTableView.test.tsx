/**
 * RecaptacionTableView — tests for:
 *   #3b  Assignee column shows assigneeName (not assigneeId)
 *   multi-select passthrough to DataTable (admin bulk-assign)
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('RecaptacionTableView — multi-select passthrough', () => {
  const lead = (id: string): RecaptureLeadDto => ({ ...BASE_LEAD, id, contactName: `Lead ${id}` });

  it('S1 — renders no checkboxes by default (selectable off)', () => {
    render(<RecaptacionTableView leads={[lead('a'), lead('b')]} />);
    expect(screen.queryByLabelText('Seleccionar todos')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Seleccionar fila/)).not.toBeInTheDocument();
  });

  it('S2 — renders row + "select all" checkboxes when selectable', () => {
    render(
      <RecaptacionTableView
        leads={[lead('a'), lead('b')]}
        selectable
        selectedIds={[]}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Seleccionar todos')).toBeInTheDocument();
    expect(screen.getByLabelText('Seleccionar fila a')).toBeInTheDocument();
    expect(screen.getByLabelText('Seleccionar fila b')).toBeInTheDocument();
  });

  it('S3 — toggling a row checkbox reports the new selection', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <RecaptacionTableView
        leads={[lead('a'), lead('b')]}
        selectable
        selectedIds={[]}
        onSelectionChange={onSelectionChange}
      />,
    );

    await user.click(screen.getByLabelText('Seleccionar fila a'));

    expect(onSelectionChange).toHaveBeenCalledWith(['a']);
  });

  it('S4 — reflects controlled selectedIds', () => {
    render(
      <RecaptacionTableView
        leads={[lead('a'), lead('b')]}
        selectable
        selectedIds={['a']}
        onSelectionChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Seleccionar fila a')).toBeChecked();
    expect(screen.getByLabelText('Seleccionar fila b')).not.toBeChecked();
  });
});
