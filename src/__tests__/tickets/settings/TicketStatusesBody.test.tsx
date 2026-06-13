/**
 * Tests for TicketStatusesBody — catalog ABM (list, create, edit, delete).
 * Mocks at the hook layer (useTicketStatuses + mutations).
 *
 * Replaces TicketStatusesPage.test.tsx — the page was extracted into a body
 * component and the standalone route now redirects to /admin/tickets/settings.
 * Permission gating: write actions are wrapped in <Can permission="tickets.manage">.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useTicketStatuses');
vi.mock('@/context/ConfirmContext');

// Can component: always render children in tests (permissions not under test here)
vi.mock('@/components/auth/Can', () => ({
  Can: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import * as useTicketStatusesModule from '@/hooks/useTicketStatuses';
import * as ConfirmContextModule from '@/context/ConfirmContext';
import { TicketStatusesBody } from '@/pages/tickets/settings/TicketStatusesBody';
import type { TicketStatus } from '@/types/ticketStatus';

const mockStatuses: TicketStatus[] = [
  { id: '1', name: 'open', color: '#22c55e', weight: 1 },
  { id: '2', name: 'pending', color: '#f59e0b', weight: 2 },
  { id: '3', name: 'closed', color: '#6b7280', weight: 3 },
];

function makeNoop() {
  return {
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  } as ReturnType<typeof useTicketStatusesModule.useCreateTicketStatus>;
}

function renderBody() {
  return render(
    <MemoryRouter>
      <TicketStatusesBody />
    </MemoryRouter>
  );
}

describe('TicketStatusesBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ConfirmContextModule.useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
    vi.mocked(useTicketStatusesModule.useTicketStatuses).mockReturnValue({
      data: mockStatuses,
      isLoading: false,
    } as ReturnType<typeof useTicketStatusesModule.useTicketStatuses>);
    vi.mocked(useTicketStatusesModule.useCreateTicketStatus).mockReturnValue(makeNoop());
    vi.mocked(useTicketStatusesModule.useUpdateTicketStatus).mockReturnValue(
      makeNoop() as unknown as ReturnType<typeof useTicketStatusesModule.useUpdateTicketStatus>
    );
    vi.mocked(useTicketStatusesModule.useDeleteTicketStatus).mockReturnValue(
      makeNoop() as unknown as ReturnType<typeof useTicketStatusesModule.useDeleteTicketStatus>
    );
  });

  it('renders the list of statuses', () => {
    renderBody();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('closed')).toBeInTheDocument();
  });

  it('renders empty state when no statuses exist', () => {
    vi.mocked(useTicketStatusesModule.useTicketStatuses).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useTicketStatusesModule.useTicketStatuses>);
    renderBody();
    expect(screen.getByText(/no hay estados/i)).toBeInTheDocument();
  });

  it('renders loading state when isLoading is true', () => {
    vi.mocked(useTicketStatusesModule.useTicketStatuses).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useTicketStatusesModule.useTicketStatuses>);
    renderBody();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('renders weight values', () => {
    renderBody();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders "+ Nuevo estado" button', () => {
    renderBody();
    expect(screen.getByRole('button', { name: '+ Nuevo estado' })).toBeInTheDocument();
  });

  it('renders color swatches for each status (1 header + 3 data rows)', () => {
    renderBody();
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4);
  });

  it('does NOT render page breadcrumb or h1 title (body-only component)', () => {
    renderBody();
    // No h1 heading should exist — the page header lives in the container settings page
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('opens create modal when "+ Nuevo estado" is clicked', () => {
    renderBody();
    fireEvent.click(screen.getByRole('button', { name: '+ Nuevo estado' }));
    expect(screen.getByRole('heading', { name: 'Nuevo estado' })).toBeInTheDocument();
  });

  it('opens edit modal with pre-filled data when "Editar" is clicked', () => {
    renderBody();
    const editBtns = screen.getAllByRole('button', { name: 'Editar' });
    fireEvent.click(editBtns[0]);
    expect(screen.getByRole('heading', { name: 'Editar estado' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('open')).toBeInTheDocument();
  });

  it('calls useCreateTicketStatus.mutateAsync when creating', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useTicketStatusesModule.useCreateTicketStatus).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as ReturnType<typeof useTicketStatusesModule.useCreateTicketStatus>);

    renderBody();
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
    } as unknown as ReturnType<typeof useTicketStatusesModule.useUpdateTicketStatus>);

    renderBody();
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

  it('calls useDeleteTicketStatus.mutateAsync when deleting and confirmed', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useTicketStatusesModule.useDeleteTicketStatus).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useTicketStatusesModule.useDeleteTicketStatus>);

    renderBody();
    const deleteBtns = screen.getAllByRole('button', { name: 'Eliminar' });
    fireEvent.click(deleteBtns[0]);
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith('1'));
  });

  it('does not call delete when confirm is cancelled', async () => {
    const mockMutateAsync = vi.fn();
    vi.mocked(useTicketStatusesModule.useDeleteTicketStatus).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useTicketStatusesModule.useDeleteTicketStatus>);

    const confirmFn = vi.fn().mockResolvedValue(false);
    vi.mocked(ConfirmContextModule.useConfirm).mockReturnValue(confirmFn);
    renderBody();
    const deleteBtns = screen.getAllByRole('button', { name: 'Eliminar' });
    fireEvent.click(deleteBtns[0]);
    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('shows 409 conflict error in modal when name already exists', async () => {
    vi.mocked(useTicketStatusesModule.useCreateTicketStatus).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue({
        response: { status: 409, data: { code: 'TICKET_STATUS_NAME_CONFLICT' } },
      }),
      isPending: false,
    } as ReturnType<typeof useTicketStatusesModule.useCreateTicketStatus>);

    renderBody();
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
    } as unknown as ReturnType<typeof useTicketStatusesModule.useDeleteTicketStatus>);

    const confirmFn = vi.fn().mockResolvedValue(true);
    vi.mocked(ConfirmContextModule.useConfirm).mockReturnValue(confirmFn);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    renderBody();
    const deleteBtns = screen.getAllByRole('button', { name: 'Eliminar' });
    fireEvent.click(deleteBtns[0]);
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/no se puede eliminar/i))
    );
    alertSpy.mockRestore();
  });
});
