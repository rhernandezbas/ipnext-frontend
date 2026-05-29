import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useRbacRoles', () => ({
  useRbacRoles: vi.fn(),
  useCreateRbacRole: vi.fn(),
}));

import { useRbacRoles, useCreateRbacRole } from '@/hooks/useRbacRoles';
import { NewRoleModal } from '@/pages/system/admin/NewRoleModal';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc },
      createElement(MemoryRouter, null, children)
    );
}

const mockMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRbacRoles).mockReturnValue({
    data: [
      { id: 'r1', code: 'super_admin', label: 'Super Administrador', isSystem: true },
    ],
    isLoading: false,
  } as ReturnType<typeof useRbacRoles>);

  vi.mocked(useCreateRbacRole).mockReturnValue({
    mutateAsync: mockMutate,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useCreateRbacRole>);
});

describe('NewRoleModal', () => {
  it('renders the modal with code and label fields', () => {
    const wrapper = createWrapper();
    render(createElement(NewRoleModal, { onClose: vi.fn(), onCreated: vi.fn() }), { wrapper });

    expect(screen.getByLabelText(/código/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });

  it('shows validation error when code is empty', async () => {
    const wrapper = createWrapper();
    render(createElement(NewRoleModal, { onClose: vi.fn(), onCreated: vi.fn() }), { wrapper });

    fireEvent.click(screen.getByRole('button', { name: /crear/i }));

    await waitFor(() => {
      expect(screen.getByText(/código requerido/i)).toBeInTheDocument();
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('shows validation error when label is empty', async () => {
    const user = userEvent.setup();
    const wrapper = createWrapper();
    render(createElement(NewRoleModal, { onClose: vi.fn(), onCreated: vi.fn() }), { wrapper });

    await user.type(screen.getByLabelText(/código/i), 'mi-rol');
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));

    await waitFor(() => {
      expect(screen.getByText(/nombre requerido/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when code has invalid format (not kebab-case)', async () => {
    const user = userEvent.setup();
    const wrapper = createWrapper();
    render(createElement(NewRoleModal, { onClose: vi.fn(), onCreated: vi.fn() }), { wrapper });

    await user.type(screen.getByLabelText(/código/i), 'Mi Rol!!');
    await user.type(screen.getByLabelText(/nombre/i), 'Mi Rol');
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));

    await waitFor(() => {
      expect(screen.getByText(/solo letras, números y guiones/i)).toBeInTheDocument();
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('calls onSave with valid code and label', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onClose = vi.fn();
    mockMutate.mockResolvedValue({ id: 'new', code: 'operaciones', label: 'Operaciones', isSystem: false });
    const wrapper = createWrapper();
    render(createElement(NewRoleModal, { onClose, onCreated }), { wrapper });

    await user.type(screen.getByLabelText(/código/i), 'operaciones');
    await user.type(screen.getByLabelText(/nombre/i), 'Operaciones');
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));

    await waitFor(() => expect(mockMutate).toHaveBeenCalledWith({ code: 'operaciones', label: 'Operaciones' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
  });

  it('shows inline error on 409 ROLE_CODE_TAKEN', async () => {
    const user = userEvent.setup();
    const error = { response: { data: { code: 'ROLE_CODE_TAKEN' } } };
    mockMutate.mockRejectedValue(error);
    const wrapper = createWrapper();
    render(createElement(NewRoleModal, { onClose: vi.fn(), onCreated: vi.fn() }), { wrapper });

    await user.type(screen.getByLabelText(/código/i), 'admin');
    await user.type(screen.getByLabelText(/nombre/i), 'Admin');
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));

    await waitFor(() => {
      expect(screen.getByText(/código ya existe/i)).toBeInTheDocument();
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    const onClose = vi.fn();
    const wrapper = createWrapper();
    render(createElement(NewRoleModal, { onClose, onCreated: vi.fn() }), { wrapper });

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
