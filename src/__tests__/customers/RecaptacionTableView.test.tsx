/**
 * RecaptacionTableView — tests for:
 *   #3b  Assignee column shows assigneeName (not assigneeId)
 *   multi-select passthrough to DataTable (admin bulk-assign)
 */
import { render, screen, within } from '@testing-library/react';
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
  technologies: [],
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

describe('RecaptacionTableView — inline assign (canAssign)', () => {
  const OPERATORS = [
    { id: 'op-1', name: 'Operador Uno' },
    { id: 'op-2', name: 'Operador Dos' },
  ];

  it('IA1 — admin sees an inline <select> in the Asignado column with a per-lead aria-label', () => {
    render(
      <RecaptacionTableView
        leads={[{ ...BASE_LEAD, id: 'lead-1', contactName: 'Pedro Ruiz' }]}
        canAssign
        operators={OPERATORS}
        onAssign={vi.fn()}
      />,
    );
    const select = screen.getByRole('combobox', { name: /asignar lead pedro ruiz/i });
    expect(select).toBeInTheDocument();
    // options: "— Sin asignar —" + each operator
    expect(within(select).getByRole('option', { name: /sin asignar/i })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Operador Uno' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: 'Operador Dos' })).toBeInTheDocument();
  });

  it('IA2 — the select value reflects the current assigneeId', () => {
    render(
      <RecaptacionTableView
        leads={[{ ...BASE_LEAD, assigneeId: 'op-2', assigneeName: 'Operador Dos' }]}
        canAssign
        operators={OPERATORS}
        onAssign={vi.fn()}
      />,
    );
    const select = screen.getByRole('combobox', { name: /asignar lead/i }) as HTMLSelectElement;
    expect(select.value).toBe('op-2');
  });

  it('IA3 — unassigned lead defaults the select to "" (sin asignar)', () => {
    render(
      <RecaptacionTableView
        leads={[{ ...BASE_LEAD, assigneeId: null, assigneeName: null }]}
        canAssign
        operators={OPERATORS}
        onAssign={vi.fn()}
      />,
    );
    const select = screen.getByRole('combobox', { name: /asignar lead/i }) as HTMLSelectElement;
    expect(select.value).toBe('');
  });

  it('IA4 — choosing an operator calls onAssign(leadId, operatorId)', async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn();
    render(
      <RecaptacionTableView
        leads={[{ ...BASE_LEAD, id: 'lead-9' }]}
        canAssign
        operators={OPERATORS}
        onAssign={onAssign}
      />,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: /asignar lead/i }), 'op-1');
    expect(onAssign).toHaveBeenCalledWith('lead-9', 'op-1');
  });

  it('IA5 — choosing "— Sin asignar —" calls onAssign(leadId, null)', async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn();
    render(
      <RecaptacionTableView
        leads={[{ ...BASE_LEAD, id: 'lead-9', assigneeId: 'op-1', assigneeName: 'Operador Uno' }]}
        canAssign
        operators={OPERATORS}
        onAssign={onAssign}
      />,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: /asignar lead/i }), '');
    expect(onAssign).toHaveBeenCalledWith('lead-9', null);
  });

  it('IA6 — agent (no canAssign) sees read-only name, NOT a select', () => {
    render(
      <RecaptacionTableView
        leads={[{ ...BASE_LEAD, assigneeId: 'op-1', assigneeName: 'Operador Uno' }]}
      />,
    );
    expect(screen.queryByRole('combobox', { name: /asignar lead/i })).not.toBeInTheDocument();
    expect(screen.getByText('Operador Uno')).toBeInTheDocument();
  });

  it('IA7 — interacting with the select does NOT trigger onRowClick (stopPropagation)', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <RecaptacionTableView
        leads={[{ ...BASE_LEAD, id: 'lead-9' }]}
        canAssign
        operators={OPERATORS}
        onAssign={vi.fn()}
        onRowClick={onRowClick}
      />,
    );
    const select = screen.getByRole('combobox', { name: /asignar lead/i });
    await user.click(select);
    await user.selectOptions(select, 'op-1');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('IA9 — assignee outside the operator pool: select still shows their name (not empty)', () => {
    // The lead is assigned to someone who is NOT in `operators` (e.g. a disabled
    // user or one outside the current pool). The controlled select must NOT fall
    // back to empty/"Sin asignar" — it has to reflect the real assignee.
    render(
      <RecaptacionTableView
        leads={[{ ...BASE_LEAD, assigneeId: 'ghost-99', assigneeName: 'Usuario Baja' }]}
        canAssign
        operators={OPERATORS}
        onAssign={vi.fn()}
      />,
    );
    const select = screen.getByRole('combobox', { name: /asignar lead/i }) as HTMLSelectElement;
    // The select value reflects the real assignee, not "".
    expect(select.value).toBe('ghost-99');
    // A phantom <option> exists for that assignee with their name as the label.
    const ghostOption = within(select).getByRole('option', { name: 'Usuario Baja' }) as HTMLOptionElement;
    expect(ghostOption).toBeInTheDocument();
    expect(ghostOption.value).toBe('ghost-99');
  });

  it('IA10 — assignee outside the pool with no name: phantom option uses a fallback label + assigneeId value', () => {
    render(
      <RecaptacionTableView
        leads={[{ ...BASE_LEAD, assigneeId: 'ghost-77', assigneeName: null }]}
        canAssign
        operators={OPERATORS}
        onAssign={vi.fn()}
      />,
    );
    const select = screen.getByRole('combobox', { name: /asignar lead/i }) as HTMLSelectElement;
    expect(select.value).toBe('ghost-77');
    const ghostOption = within(select).getByRole('option', { name: /fuera de lista/i }) as HTMLOptionElement;
    expect(ghostOption.value).toBe('ghost-77');
  });

  it('IA11 — assignee already in the pool does NOT get a duplicate phantom option', () => {
    render(
      <RecaptacionTableView
        leads={[{ ...BASE_LEAD, assigneeId: 'op-1', assigneeName: 'Operador Uno' }]}
        canAssign
        operators={OPERATORS}
        onAssign={vi.fn()}
      />,
    );
    const select = screen.getByRole('combobox', { name: /asignar lead/i }) as HTMLSelectElement;
    expect(select.value).toBe('op-1');
    // Exactly one option for the in-pool operator (no phantom duplicate).
    expect(within(select).getAllByRole('option', { name: 'Operador Uno' })).toHaveLength(1);
  });

  it('IA8 — assigningId disables only that row\'s select', () => {
    render(
      <RecaptacionTableView
        leads={[
          { ...BASE_LEAD, id: 'lead-a', contactName: 'Lead A' },
          { ...BASE_LEAD, id: 'lead-b', contactName: 'Lead B' },
        ]}
        canAssign
        operators={OPERATORS}
        onAssign={vi.fn()}
        assigningId="lead-a"
      />,
    );
    expect(screen.getByRole('combobox', { name: /asignar lead lead a/i })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /asignar lead lead b/i })).not.toBeDisabled();
  });
});

// ── technology column (color badges by family, fiber-first) ──────────────────

describe('RecaptacionTableView — technology column', () => {
  it('TC1 — renders a "Tecnología" column header', () => {
    render(<RecaptacionTableView leads={[{ ...BASE_LEAD, technologies: ['Fiber'] }]} />);
    expect(screen.getByRole('columnheader', { name: 'Tecnología' })).toBeInTheDocument();
  });

  it('TC2 — a single technology renders one badge with its catalog label + family', () => {
    const { container } = render(
      <RecaptacionTableView leads={[{ ...BASE_LEAD, technologies: ['Fiber'] }]} />,
    );
    const badges = Array.from(container.querySelectorAll('[data-family]'));
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe('Fiber');
    expect(badges[0].getAttribute('data-family')).toBe('fiber');
  });

  it('TC3 — multiple technologies render fiber-first, then wireless, then cable', () => {
    const { container } = render(
      <RecaptacionTableView leads={[{ ...BASE_LEAD, technologies: ['HFC', 'Wireless', 'FTTH'] }]} />,
    );
    const badges = Array.from(container.querySelectorAll('[data-family]'));
    expect(badges.map((b) => b.textContent)).toEqual(['FTTH', 'Wireless', 'HFC']);
    expect(badges.map((b) => b.getAttribute('data-family'))).toEqual(['fiber', 'wireless', 'cable']);
  });

  it('TC4 — empty technologies renders the muted dash, no badges', () => {
    const { container } = render(
      <RecaptacionTableView leads={[{ ...BASE_LEAD, technologies: [] }]} />,
    );
    expect(container.querySelectorAll('[data-family]')).toHaveLength(0);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('TC5 — maps each catalog value to the right family color', () => {
    const { container } = render(
      <RecaptacionTableView leads={[{ ...BASE_LEAD, technologies: ['Radio', 'DOCSIS'] }]} />,
    );
    const byText = (t: string) =>
      Array.from(container.querySelectorAll('[data-family]')).find((b) => b.textContent === t)!;
    expect(byText('Radio').getAttribute('data-family')).toBe('wireless');
    expect(byText('DOCSIS').getAttribute('data-family')).toBe('cable');
  });

  it('TC6 — an unknown technology value falls back to the neutral family', () => {
    const { container } = render(
      <RecaptacionTableView leads={[{ ...BASE_LEAD, technologies: ['Starlink'] }]} />,
    );
    const badge = container.querySelector('[data-family]')!;
    expect(badge.textContent).toBe('Starlink');
    expect(badge.getAttribute('data-family')).toBe('other');
  });
});

// ── possible active-client match badge (S12) ──────────────────────────────────

describe('RecaptacionTableView — possible active match badge (S12)', () => {
  it('M1 — shows the match indicator in the Contacto cell when signals.length >= 1', () => {
    render(
      <RecaptacionTableView
        leads={[{ ...BASE_LEAD, possibleActiveMatchSignals: ['phone'] }]}
      />,
    );
    expect(screen.getByText('Posible cliente activo')).toBeInTheDocument();
  });

  it('M2 — renders nothing when possibleActiveMatchSignals is an empty array', () => {
    render(
      <RecaptacionTableView
        leads={[{ ...BASE_LEAD, possibleActiveMatchSignals: [] }]}
      />,
    );
    expect(screen.queryByText('Posible cliente activo')).not.toBeInTheDocument();
  });

  it('M3 — renders nothing when possibleActiveMatchSignals is undefined (old cached payload)', () => {
    render(<RecaptacionTableView leads={[BASE_LEAD]} />);
    expect(screen.queryByText('Posible cliente activo')).not.toBeInTheDocument();
  });

  it('M4 — the match indicator does not break technology badges or the status pill in the same row', () => {
    render(
      <RecaptacionTableView
        leads={[{
          ...BASE_LEAD,
          technologies: ['Wireless'],
          status: 'interesado',
          possibleActiveMatchSignals: ['phone', 'email'],
        }]}
      />,
    );
    // Match indicator present…
    expect(screen.getByText('Posible cliente activo')).toBeInTheDocument();
    // …and the pre-existing Wireless tech badge + status pill render unaffected.
    expect(screen.getByText('Wireless')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado: Interesado')).toBeInTheDocument();
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
