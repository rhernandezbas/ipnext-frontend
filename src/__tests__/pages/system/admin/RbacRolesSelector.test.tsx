import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RbacRolesSelector } from '@/pages/system/admin/RbacRolesSelector';
import type { RbacRoleDto } from '@/types/rbacRole';

const ROLES: RbacRoleDto[] = [
  { id: 'r1', code: 'super_admin', label: 'Super Admin', isSystem: true },
  { id: 'r2', code: 'noc', label: 'NOC', isSystem: true },
  { id: 'r3', code: 'ventas', label: 'Ventas', isSystem: true },
  { id: 'r4', code: 'custom_role', label: 'Soporte Custom', isSystem: false },
];

describe('RbacRolesSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chips for selected roles', () => {
    const onChange = vi.fn();
    render(
      <RbacRolesSelector value={['r1', 'r2']} roles={ROLES} onChange={onChange} />,
    );
    expect(screen.getByText('Super Administrador')).toBeInTheDocument();
    expect(screen.getByText('NOC')).toBeInTheDocument();
  });

  it('shows empty state in popover when no roles available', () => {
    const onChange = vi.fn();
    render(
      <RbacRolesSelector value={[]} roles={[]} onChange={onChange} />,
    );
    // open popover
    fireEvent.click(screen.getByRole('button', { name: /seleccionar roles/i }));
    expect(screen.getByText(/no hay roles disponibles/i)).toBeInTheDocument();
  });

  it('removes a chip when X is clicked', () => {
    const onChange = vi.fn();
    render(
      <RbacRolesSelector value={['r1', 'r2']} roles={ROLES} onChange={onChange} />,
    );
    // click remove on r1 chip
    const removeButtons = screen.getAllByRole('button', { name: /quitar/i });
    fireEvent.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith(['r2']);
  });

  it('adds a role when popover item is clicked', () => {
    const onChange = vi.fn();
    render(
      <RbacRolesSelector value={['r1']} roles={ROLES} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /seleccionar roles/i }));
    fireEvent.click(screen.getByRole('option', { name: /ventas/i }));
    expect(onChange).toHaveBeenCalledWith(['r1', 'r3']);
  });

  it('does not duplicate already selected roles in popover', () => {
    const onChange = vi.fn();
    render(
      <RbacRolesSelector value={['r1', 'r2']} roles={ROLES} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /seleccionar roles/i }));
    // r1 and r2 should not appear in popover options (already selected)
    const options = screen.queryAllByRole('option');
    const optionTexts = options.map(o => o.textContent);
    expect(optionTexts).not.toContain('Super Administrador');
    expect(optionTexts).not.toContain('NOC');
  });

  it('filters roles by search text', () => {
    const onChange = vi.fn();
    render(
      <RbacRolesSelector value={[]} roles={ROLES} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /seleccionar roles/i }));
    const searchInput = screen.getByPlaceholderText(/buscar rol/i);
    fireEvent.change(searchInput, { target: { value: 'noc' } });
    expect(screen.getByRole('option', { name: /noc/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /ventas/i })).toBeNull();
  });

  it('shows custom role label directly', () => {
    const onChange = vi.fn();
    render(
      <RbacRolesSelector value={['r4']} roles={ROLES} onChange={onChange} />,
    );
    expect(screen.getByText('Soporte Custom')).toBeInTheDocument();
  });

  it('shows error message when error prop is provided', () => {
    const onChange = vi.fn();
    render(
      <RbacRolesSelector
        value={[]}
        roles={ROLES}
        onChange={onChange}
        error="Seleccioná al menos un rol."
      />,
    );
    expect(screen.getByText('Seleccioná al menos un rol.')).toBeInTheDocument();
  });

  it('disables interaction when disabled prop is true', () => {
    const onChange = vi.fn();
    render(
      <RbacRolesSelector value={[]} roles={ROLES} onChange={onChange} disabled />,
    );
    const trigger = screen.getByRole('button', { name: /seleccionar roles/i });
    expect(trigger).toBeDisabled();
  });
});
