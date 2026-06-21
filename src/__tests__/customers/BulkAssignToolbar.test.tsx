/**
 * BulkAssignToolbar — contextual admin toolbar for bulk-assigning leads.
 * Pattern: ui-ux-pro-max "Bulk Actions" → checkbox column + action bar.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BulkAssignToolbar } from '@/pages/customers/RecaptacionPage/components/BulkAssignToolbar';
import type { AssigneeOption } from '@/pages/customers/RecaptacionPage/components/BulkAssignToolbar';

// Operators are RbacUsers ({ id, name }) — the BE validates operatorId against
// RbacUser, not the Admin table.
const OPERATORS: AssigneeOption[] = [
  { id: 'op-1', name: 'Operador Uno' },
  { id: 'op-2', name: 'Operador Dos' },
];

beforeEach(() => {
  vi.clearAllMocks();
});

function renderToolbar(over: Partial<React.ComponentProps<typeof BulkAssignToolbar>> = {}) {
  const props = {
    count: 2,
    operators: OPERATORS,
    onAssign: vi.fn(),
    onClear: vi.fn(),
    pending: false,
    ...over,
  };
  render(<BulkAssignToolbar {...props} />);
  return props;
}

describe('BulkAssignToolbar', () => {
  it('B1 — shows the selection count', () => {
    renderToolbar({ count: 3 });
    expect(screen.getByText(/3 seleccionados/i)).toBeInTheDocument();
  });

  it('B2 — renders an agent select populated from RbacUser operators', () => {
    renderToolbar();
    const select = screen.getByRole('combobox', { name: /asignar a/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Operador Uno' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Operador Dos' })).toBeInTheDocument();
  });

  it('B3 — clicking "Asignar" calls onAssign with the picked operatorId', async () => {
    const user = userEvent.setup();
    const { onAssign } = renderToolbar();

    await user.selectOptions(screen.getByRole('combobox', { name: /asignar a/i }), 'op-2');
    await user.click(screen.getByRole('button', { name: /^asignar$/i }));

    expect(onAssign).toHaveBeenCalledWith('op-2');
  });

  it('B4 — picking the empty option lets you bulk-unassign (operatorId null)', async () => {
    const user = userEvent.setup();
    const { onAssign } = renderToolbar();

    // Default selection is the empty "— Sin asignar —" option.
    await user.click(screen.getByRole('button', { name: /^asignar$/i }));

    expect(onAssign).toHaveBeenCalledWith(null);
  });

  it('B5 — clicking "Limpiar" calls onClear', async () => {
    const user = userEvent.setup();
    const { onClear } = renderToolbar();

    await user.click(screen.getByRole('button', { name: /limpiar/i }));

    expect(onClear).toHaveBeenCalled();
  });

  it('B6 — "Asignar" is disabled while pending', () => {
    renderToolbar({ pending: true });
    expect(screen.getByRole('button', { name: /^asignar$/i })).toBeDisabled();
  });
});
