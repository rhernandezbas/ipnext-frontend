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
vi.mock('@/hooks/useTicketAreas');

import * as useRbacUsersModule from '@/hooks/useRbacUsers';
import * as useTicketAreasModule from '@/hooks/useTicketAreas';

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
    vi.mocked(useTicketAreasModule.useTicketAreas).mockReturnValue({
      data: [{ id: 'area-1', name: 'Soporte' }, { id: 'area-2', name: 'Facturacion' }],
      isLoading: false,
    } as ReturnType<typeof useTicketAreasModule.useTicketAreas>);
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

  // #28 follow-up: the payload must match the BE wire shape — `description`
  // (the BE 400s without it; `message` was the legacy mock field).
  // #49: areaId is now required — validate and include in payload.
  it('calls onCreate with the BE wire shape when form is filled', async () => {
    const { onCreate } = renderModal({});
    fireEvent.input(screen.getByLabelText(/asunto/i), { target: { value: 'Falla de red' } });
    fireEvent.input(screen.getByLabelText(/mensaje/i), { target: { value: 'Sin internet desde ayer' } });
    fireEvent.change(screen.getByRole('combobox', { name: /prioridad/i }), { target: { value: 'high' } });
    fireEvent.change(screen.getByRole('combobox', { name: /area/i }), { target: { value: 'area-1' } });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Falla de red',
          description: 'Sin internet desde ayer',
          priority: 'high',
          areaId: 'area-1',
        })
      );
    });
  });

  // #49 — area is required
  it('shows area validation error when area is not selected', async () => {
    renderModal({});
    fireEvent.input(screen.getByLabelText(/asunto/i), { target: { value: 'Test' } });
    fireEvent.input(screen.getByLabelText(/mensaje/i), { target: { value: 'Descripcion' } });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    await waitFor(() => {
      expect(screen.getByText(/area.*requerida/i)).toBeInTheDocument();
    });
  });

  // #49 — area select is populated from catalog (lesson #27: no hardcoded list)
  it('renders Area select populated from catalog (useTicketAreas)', () => {
    renderModal({});
    expect(screen.getByRole('combobox', { name: /area/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Soporte' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Facturacion' })).toBeInTheDocument();
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
