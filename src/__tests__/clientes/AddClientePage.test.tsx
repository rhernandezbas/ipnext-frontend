import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AddClientePage from '@/pages/clientes/AddClientePage';
import * as useClientsModule from '@/hooks/useClients';

vi.mock('@/hooks/useClients');

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const mockMutateAsync = vi.fn();

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter initialEntries={['/admin/customers/add']}>
        <Routes>
          <Route path="/admin/customers/add" element={<AddClientePage />} />
          <Route path="/admin/customers/list" element={<div>Lista de Clientes</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AddClientePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useClientsModule.useCreateCustomer).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useClientsModule.useCreateCustomer>);

    // Also mock other hooks used by the module so they don't break
    vi.mocked(useClientsModule.useClientList).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientList>);
  });

  it('renders "Nuevo cliente" heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Nuevo cliente' })).toBeInTheDocument();
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

  it('renders "Guardar cliente" and "Cancelar" buttons', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Guardar cliente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('calls createCustomer mutation on submit with correct data', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue({});
    renderPage();

    await user.type(screen.getByLabelText('Nombre'), 'Carlos');
    await user.type(screen.getByLabelText('Apellido'), 'López');
    await user.type(screen.getByLabelText('Email'), 'carlos@test.com');
    await user.type(screen.getByLabelText('Teléfono'), '333-3333');
    await user.type(screen.getByLabelText('Dirección'), 'Av. Corrientes 1234');

    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }));

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Carlos',
        lastName: 'López',
        email: 'carlos@test.com',
        phone: '333-3333',
        address: 'Av. Corrientes 1234',
        status: 'active',
      })
    );
  });

  it('navigates to /admin/customers/list on success', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValue({});
    renderPage();

    await user.type(screen.getByLabelText('Nombre'), 'Carlos');
    await user.type(screen.getByLabelText('Apellido'), 'López');
    await user.type(screen.getByLabelText('Email'), 'carlos@test.com');
    await user.type(screen.getByLabelText('Teléfono'), '333-3333');

    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }));

    await waitFor(() => {
      expect(screen.getByText('Lista de Clientes')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('shows error message on failure', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValue(new Error('Server error'));
    renderPage();

    await user.type(screen.getByLabelText('Nombre'), 'Carlos');
    await user.type(screen.getByLabelText('Apellido'), 'López');
    await user.type(screen.getByLabelText('Email'), 'carlos@test.com');
    await user.type(screen.getByLabelText('Teléfono'), '333-3333');

    await user.click(screen.getByRole('button', { name: 'Guardar cliente' }));

    await waitFor(() => {
      expect(screen.getByText('Error al crear el cliente. Intente nuevamente.')).toBeInTheDocument();
    });
  });

  it('disables submit button while submitting', () => {
    vi.mocked(useClientsModule.useCreateCustomer).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    } as unknown as ReturnType<typeof useClientsModule.useCreateCustomer>);

    renderPage();

    const submitBtn = screen.getByRole('button', { name: 'Guardando...' });
    expect(submitBtn).toBeDisabled();
  });

  it('disables all inputs while submitting', () => {
    vi.mocked(useClientsModule.useCreateCustomer).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
    } as unknown as ReturnType<typeof useClientsModule.useCreateCustomer>);

    renderPage();

    expect(screen.getByLabelText('Nombre')).toBeDisabled();
    expect(screen.getByLabelText('Apellido')).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Teléfono')).toBeDisabled();
    expect(screen.getByLabelText('Dirección')).toBeDisabled();
    expect(screen.getByLabelText('Estado')).toBeDisabled();
  });

  it('navigates to /admin/customers/list on Cancelar click', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => {
      expect(screen.getByText('Lista de Clientes')).toBeInTheDocument();
    });
  });

  it('Estado dropdown has Activo and Inactivo options', () => {
    renderPage();
    const select = screen.getByLabelText('Estado');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Activo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Inactivo' })).toBeInTheDocument();
  });
});
