import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TicketStatusesPage from '@/pages/tickets/TicketStatusesPage';
import * as useTicketStatusesModule from '@/hooks/useTicketStatuses';
import type { TicketStatus } from '@/types/ticketStatus';

vi.mock('@/hooks/useTicketStatuses');

const mockStatuses: TicketStatus[] = [
  { id: '1', name: 'open', color: '#22c55e', weight: 1 },
  { id: '2', name: 'pending', color: '#f59e0b', weight: 2 },
  { id: '3', name: 'closed', color: '#6b7280', weight: 3 },
];

function makeDeleteMutation(overrides = {}) {
  return {
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides,
  } as ReturnType<typeof useTicketStatusesModule.useDeleteTicketStatus>;
}

function makeCreateMutation(overrides = {}) {
  return {
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides,
  } as ReturnType<typeof useTicketStatusesModule.useCreateTicketStatus>;
}

function makeUpdateMutation(overrides = {}) {
  return {
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    ...overrides,
  } as ReturnType<typeof useTicketStatusesModule.useUpdateTicketStatus>;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TicketStatusesPage />
    </MemoryRouter>
  );
}

describe('TicketStatusesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTicketStatusesModule.useTicketStatuses).mockReturnValue({
      data: mockStatuses,
      isLoading: false,
    } as ReturnType<typeof useTicketStatusesModule.useTicketStatuses>);
    vi.mocked(useTicketStatusesModule.useCreateTicketStatus).mockReturnValue(makeCreateMutation());
    vi.mocked(useTicketStatusesModule.useUpdateTicketStatus).mockReturnValue(makeUpdateMutation());
    vi.mocked(useTicketStatusesModule.useDeleteTicketStatus).mockReturnValue(makeDeleteMutation());
  });

  it('renders page title "Estados"', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Estados' })).toBeInTheDocument();
  });

  it('renders breadcrumb "Tickets /"', () => {
    renderPage();
    expect(screen.getByText('Tickets /')).toBeInTheDocument();
  });

  it('shows loading state when isLoading is true', () => {
    vi.mocked(useTicketStatusesModule.useTicketStatuses).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useTicketStatusesModule.useTicketStatuses>);
    renderPage();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('shows empty state when no statuses exist', () => {
    vi.mocked(useTicketStatusesModule.useTicketStatuses).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useTicketStatusesModule.useTicketStatuses>);
    renderPage();
    expect(screen.getByText(/no hay estados/i)).toBeInTheDocument();
  });

  it('renders all statuses in the table', () => {
    renderPage();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('renders color swatches for each status', () => {
    renderPage();
    // table rows: 3 statuses → 3 color swatches rendered as colored spans
    const rows = screen.getAllByRole('row');
    // 1 header + 3 data rows
    expect(rows).toHaveLength(4);
  });

  it('renders weight values', () => {
    renderPage();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders "+ Nuevo estado" button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: '+ Nuevo estado' })).toBeInTheDocument();
  });

  it('opens create modal when "+ Nuevo estado" is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo estado' }));
    expect(screen.getByRole('heading', { name: 'Nuevo estado' })).toBeInTheDocument();
  });

  it('opens edit modal with pre-filled data when "Editar" is clicked', () => {
    renderPage();
    const editBtns = screen.getAllByRole('button', { name: 'Editar' });
    fireEvent.click(editBtns[0]);
    expect(screen.getByRole('heading', { name: 'Editar estado' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('open')).toBeInTheDocument();
  });

  it('calls useDeleteTicketStatus.mutateAsync when deleting and confirmed', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useTicketStatusesModule.useDeleteTicketStatus).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as ReturnType<typeof useTicketStatusesModule.useDeleteTicketStatus>);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    const deleteBtns = screen.getAllByRole('button', { name: 'Eliminar' });
    fireEvent.click(deleteBtns[0]);
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith('1'));
  });

  it('does not call delete when confirm is cancelled', () => {
    const mockMutateAsync = vi.fn();
    vi.mocked(useTicketStatusesModule.useDeleteTicketStatus).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as ReturnType<typeof useTicketStatusesModule.useDeleteTicketStatus>);

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    const deleteBtns = screen.getAllByRole('button', { name: 'Eliminar' });
    fireEvent.click(deleteBtns[0]);
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('calls useCreateTicketStatus.mutateAsync when creating', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useTicketStatusesModule.useCreateTicketStatus).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as ReturnType<typeof useTicketStatusesModule.useCreateTicketStatus>);

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo estado' }));
    fireEvent.change(screen.getByPlaceholderText(/ej: resuelto/i), { target: { value: 'resolved' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'resolved' })
      )
    );
  });

  it('calls useUpdateTicketStatus.mutateAsync when editing', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useTicketStatusesModule.useUpdateTicketStatus).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as ReturnType<typeof useTicketStatusesModule.useUpdateTicketStatus>);

    renderPage();
    const editBtns = screen.getAllByRole('button', { name: 'Editar' });
    fireEvent.click(editBtns[0]);
    fireEvent.change(screen.getByDisplayValue('open'), { target: { value: 'abierto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1', data: expect.objectContaining({ name: 'abierto' }) })
      )
    );
  });

  it('shows 409 conflict error in modal when name already exists', async () => {
    vi.mocked(useTicketStatusesModule.useCreateTicketStatus).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue({
        response: { status: 409, data: { code: 'TICKET_STATUS_NAME_CONFLICT' } },
      }),
      isPending: false,
    } as ReturnType<typeof useTicketStatusesModule.useCreateTicketStatus>);

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo estado' }));
    fireEvent.change(screen.getByPlaceholderText(/ej: resuelto/i), { target: { value: 'open' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(screen.getByText(/ya existe un estado con ese nombre/i)).toBeInTheDocument()
    );
  });

  it('shows 409 in-use error on delete via alert', async () => {
    vi.mocked(useTicketStatusesModule.useDeleteTicketStatus).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue({
        response: { status: 409, data: { code: 'TICKET_STATUS_IN_USE' } },
      }),
      isPending: false,
    } as ReturnType<typeof useTicketStatusesModule.useDeleteTicketStatus>);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderPage();
    const deleteBtns = screen.getAllByRole('button', { name: 'Eliminar' });
    fireEvent.click(deleteBtns[0]);
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/no se puede eliminar/i))
    );
  });
});
