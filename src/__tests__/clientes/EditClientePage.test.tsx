import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import EditClientePage from '@/pages/clientes/EditClientePage';
import * as useClientsModule from '@/hooks/useClients';

vi.mock('@/hooks/useClients');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockMutateAsync = vi.fn();

const mockCustomer = {
  id: 42,
  name: 'Alice García',
  firstName: 'Alice',
  lastName: 'García',
  email: 'alice@test.com',
  phone: '111-1111',
  address: 'Calle 1',
  status: 'active' as const,
  balance: 0,
  category: 'residential',
  tariffPlan: null,
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  services: [],
  logs: [],
};

function renderPage(id = '42') {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={[`/admin/customers/view/${id}/edit`]}>
        <Routes>
          <Route path="/admin/customers/view/:id/edit" element={<EditClientePage />} />
          <Route path="/admin/customers/view/:id" element={<div>Cliente Detalle</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('EditClientePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useClientsModule.useClientDetail).mockReturnValue({
      data: mockCustomer,
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientDetail>);

    vi.mocked(useClientsModule.useUpdateCustomer).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useClientsModule.useUpdateCustomer>);
  });

  it('renders "Editar cliente" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Editar cliente' })).toBeInTheDocument();
  });

  it('pre-fills Nombre field with existing client data', () => {
    renderPage();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Alice');
  });

  it('renders all form fields', () => {
    renderPage();
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Apellido')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Teléfono')).toBeInTheDocument();
    expect(screen.getByLabelText('Dirección')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado')).toBeInTheDocument();
  });

  it('calls updateCustomer on submit', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue({});
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '42',
          data: expect.objectContaining({
            firstName: 'Alice',
            lastName: 'García',
            email: 'alice@test.com',
          }),
        })
      );
    });
  });

  it('navigates back on cancel', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => {
      expect(screen.getByText('Cliente Detalle')).toBeInTheDocument();
    });
  });

  it('shows error message on failure', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValue(new Error('Server error'));
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(screen.getByText('Error al guardar. Intente nuevamente.')).toBeInTheDocument();
    });
  });

  it('shows loading spinner while client data loads', () => {
    vi.mocked(useClientsModule.useClientDetail).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useClientsModule.useClientDetail>);

    renderPage();
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });
});
