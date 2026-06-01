import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreateTicketModal } from '@/pages/tickets/TicketsListPage/components/CreateTicketModal';

// Mock CustomerPicker to avoid heavy deps
vi.mock('@/pages/scheduling/SchedulingTasksPage/components/CustomerPicker', () => ({
  CustomerPicker: ({ onChange }: { onChange: (id: string | null, name: string | null) => void }) => (
    <div>
      <button
        type="button"
        data-testid="customer-picker-select"
        onClick={() => onChange('42', 'Empresa SA')}
      >
        Select Customer
      </button>
    </div>
  ),
}));

vi.mock('@/hooks/useRbacUsers');
import * as useRbacUsersModule from '@/hooks/useRbacUsers';

const mockUsers = [
  { id: 'u1', name: 'Ana García', roles: [] },
];

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderModal(props: {
  onClose?: () => void;
  onCreate?: (data: unknown) => Promise<unknown>;
  loading?: boolean;
}) {
  const { onClose = vi.fn(), onCreate = vi.fn().mockResolvedValue(undefined), loading = false } = props;
  return {
    onClose,
    onCreate,
    ...render(
      <QueryClientProvider client={makeQC()}>
        <MemoryRouter>
          <CreateTicketModal onClose={onClose} onCreate={onCreate} loading={loading} />
        </MemoryRouter>
      </QueryClientProvider>
    ),
  };
}

describe('CreateTicketModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRbacUsersModule.useRbacUsers).mockReturnValue({
      data: mockUsers,
      isLoading: false,
    } as ReturnType<typeof useRbacUsersModule.useRbacUsers>);
  });

  it('renders form with required fields', () => {
    renderModal({});
    expect(screen.getByLabelText(/asunto/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mensaje/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /prioridad/i })).toBeInTheDocument();
  });

  it('renders Cancelar and Crear buttons', () => {
    renderModal({});
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear/i })).toBeInTheDocument();
  });

  it('calls onClose when Cancelar is clicked', () => {
    const { onClose } = renderModal({});
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows validation errors when submitting empty required fields', async () => {
    renderModal({});
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    await waitFor(() => {
      expect(screen.getByText(/asunto.*requerido/i)).toBeInTheDocument();
    });
  });

  it('shows mensaje validation error when empty', async () => {
    renderModal({});
    fireEvent.input(screen.getByLabelText(/asunto/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    await waitFor(() => {
      expect(screen.getByText(/mensaje.*requerido/i)).toBeInTheDocument();
    });
  });

  it('does NOT call onCreate when fields are empty', async () => {
    const { onCreate } = renderModal({});
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    await waitFor(() => {
      expect(onCreate).not.toHaveBeenCalled();
    });
  });

  it('calls onCreate with correct data when form is filled', async () => {
    const { onCreate } = renderModal({});
    fireEvent.input(screen.getByLabelText(/asunto/i), { target: { value: 'Falla de red' } });
    fireEvent.input(screen.getByLabelText(/mensaje/i), { target: { value: 'Sin internet desde ayer' } });
    fireEvent.change(screen.getByRole('combobox', { name: /prioridad/i }), { target: { value: 'high' } });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Falla de red',
          message: 'Sin internet desde ayer',
          priority: 'high',
        })
      );
    });
  });

  it('shows loading state on submit button when loading=true', () => {
    renderModal({ loading: true });
    expect(screen.getByRole('button', { name: /creando/i })).toBeInTheDocument();
  });

  it('disables inputs when loading=true', () => {
    renderModal({ loading: true });
    expect(screen.getByLabelText(/asunto/i)).toBeDisabled();
    expect(screen.getByLabelText(/mensaje/i)).toBeDisabled();
  });

  it('renders Asignado dropdown with RBAC users', () => {
    renderModal({});
    expect(screen.getByRole('combobox', { name: /asignado/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ana García' })).toBeInTheDocument();
  });
});
