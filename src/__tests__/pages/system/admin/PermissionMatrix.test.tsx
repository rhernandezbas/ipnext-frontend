import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';

import { PermissionMatrix } from '@/pages/system/admin/PermissionMatrix';
import type { PermissionModule } from '@/types/rolePermissions';

const mockModules: PermissionModule[] = [
  {
    moduleId: 'm1',
    moduleCode: 'clients',
    moduleLabel: 'Clientes',
    actions: ['read', 'write', 'delete'],
    actionToId: { read: 'p1', write: 'p2', delete: 'p3' },
  },
  {
    moduleId: 'm2',
    moduleCode: 'billing',
    moduleLabel: 'Facturación',
    actions: ['read', 'write'],
    actionToId: { read: 'p4', write: 'p5' },
  },
];

const defaultProps = {
  modules: mockModules,
  selectedIds: new Set<string>(),
  onChange: vi.fn(),
  roleCode: 'noc',
  isSaving: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PermissionMatrix — layout', () => {
  it('renders module labels as section headers', () => {
    render(createElement(PermissionMatrix, defaultProps));

    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.getByText('Facturación')).toBeInTheDocument();
  });

  it('renders checkboxes for each (module, action) cell', () => {
    render(createElement(PermissionMatrix, defaultProps));

    // 3 actions for clients + 2 for billing = 5 checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(5);
  });

  it('checked state matches selectedIds', () => {
    render(createElement(PermissionMatrix, { ...defaultProps, selectedIds: new Set(['p1', 'p4']) }));

    const checkboxes = screen.getAllByRole('checkbox');
    const checked = checkboxes.filter(cb => (cb as HTMLInputElement).checked);
    expect(checked).toHaveLength(2);
  });

  it('calls onChange when a checkbox is toggled', () => {
    const onChange = vi.fn();
    render(createElement(PermissionMatrix, { ...defaultProps, onChange }));

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(onChange).toHaveBeenCalledWith('p1', true);
  });

  it('uses role="grid" on the matrix container', () => {
    render(createElement(PermissionMatrix, defaultProps));
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });
});

describe('PermissionMatrix — super_admin', () => {
  it('renders all checkboxes disabled when roleCode is super_admin', () => {
    render(createElement(PermissionMatrix, { ...defaultProps, roleCode: 'super_admin', selectedIds: new Set(['p1','p2','p3','p4','p5']) }));

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => {
      expect(cb).toBeDisabled();
      expect(cb).toBeChecked();
    });
  });

  it('shows lock banner for super_admin', () => {
    render(createElement(PermissionMatrix, { ...defaultProps, roleCode: 'super_admin' }));

    expect(screen.getByText(/acceso total por sistema/i)).toBeInTheDocument();
  });
});

describe('PermissionMatrix — collapsible modules', () => {
  it('module groups are expanded by default', () => {
    render(createElement(PermissionMatrix, defaultProps));

    // Checkboxes are visible (expanded)
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('clicking module header collapses the module', async () => {
    const user = userEvent.setup();
    render(createElement(PermissionMatrix, defaultProps));

    const clientesHeader = screen.getByRole('button', { name: /clientes/i });
    await user.click(clientesHeader);

    // After collapse, clients checkboxes should not be visible
    const checkboxes = screen.getAllByRole('checkbox');
    // only billing checkboxes visible (2)
    expect(checkboxes).toHaveLength(2);
  });
});

describe('PermissionMatrix — search', () => {
  it('renders a search input', () => {
    render(createElement(PermissionMatrix, defaultProps));
    expect(screen.getByPlaceholderText(/buscar módulo/i)).toBeInTheDocument();
  });

  it('filters modules by label when search query is typed', async () => {
    const user = userEvent.setup();
    render(createElement(PermissionMatrix, defaultProps));

    await user.type(screen.getByPlaceholderText(/buscar módulo/i), 'Factur');

    expect(screen.queryByText('Clientes')).not.toBeInTheDocument();
    // Text may be split across nodes due to highlight — use aria-label on the group
    expect(screen.getByRole('rowgroup', { name: 'Facturación' })).toBeInTheDocument();
  });

  it('filters modules by code when search query is typed', async () => {
    const user = userEvent.setup();
    render(createElement(PermissionMatrix, defaultProps));

    await user.type(screen.getByPlaceholderText(/buscar módulo/i), 'billing');

    expect(screen.queryByText('Clientes')).not.toBeInTheDocument();
    expect(screen.getByText('Facturación')).toBeInTheDocument();
  });
});

describe('PermissionMatrix — bulk shortcuts', () => {
  it('clicking "Todo" in a module header selects all permissions in that module', () => {
    const onChange = vi.fn();
    render(createElement(PermissionMatrix, { ...defaultProps, onChange }));

    fireEvent.click(screen.getAllByRole('button', { name: /^todo$/i })[0]);

    // Should be called for each permission in the clients module
    expect(onChange).toHaveBeenCalledTimes(3); // p1, p2, p3
    expect(onChange).toHaveBeenCalledWith('p1', true);
    expect(onChange).toHaveBeenCalledWith('p2', true);
    expect(onChange).toHaveBeenCalledWith('p3', true);
  });

  it('clicking "Nada" in a module header deselects all permissions in that module', () => {
    const onChange = vi.fn();
    render(createElement(PermissionMatrix, {
      ...defaultProps,
      selectedIds: new Set(['p1', 'p2', 'p3']),
      onChange,
    }));

    fireEvent.click(screen.getAllByRole('button', { name: /^nada$/i })[0]);

    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenCalledWith('p1', false);
  });
});

describe('PermissionMatrix — granted/total badge', () => {
  it('shows granted/total count per module', () => {
    render(createElement(PermissionMatrix, { ...defaultProps, selectedIds: new Set(['p1', 'p2']) }));

    // Clients: 2/3 selected
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });
});
