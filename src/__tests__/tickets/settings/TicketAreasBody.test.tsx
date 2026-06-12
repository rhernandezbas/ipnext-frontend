/**
 * Tests for TicketAreasBody — catalog ABM (list, create, edit, delete).
 * Mocks at the hook layer (useTicketAreas + mutations).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useTicketAreas');
vi.mock('@/context/ConfirmContext');

import * as useTicketAreasModule from '@/hooks/useTicketAreas';
import * as ConfirmContextModule from '@/context/ConfirmContext';

// Can component: always render children in tests (permissions are not under test here)
vi.mock('@/components/auth/Can', () => ({
  Can: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { TicketAreasBody } from '@/pages/tickets/settings/TicketAreasBody';
import type { TicketArea } from '@/types/ticketArea';

const mockAreas: TicketArea[] = [
  { id: 'a1', name: 'Soporte' },
  { id: 'a2', name: 'Facturacion' },
];

function makeNoop() {
  return { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as unknown as ReturnType<typeof useTicketAreasModule.useCreateTicketArea>;
}

function renderBody() {
  return render(
    <MemoryRouter>
      <TicketAreasBody />
    </MemoryRouter>
  );
}

describe('TicketAreasBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTicketAreasModule.useTicketAreas).mockReturnValue({
      data: mockAreas,
      isLoading: false,
    } as ReturnType<typeof useTicketAreasModule.useTicketAreas>);
    vi.mocked(useTicketAreasModule.useCreateTicketArea).mockReturnValue(makeNoop());
    vi.mocked(useTicketAreasModule.useUpdateTicketArea).mockReturnValue(makeNoop() as unknown as ReturnType<typeof useTicketAreasModule.useUpdateTicketArea>);
    vi.mocked(useTicketAreasModule.useDeleteTicketArea).mockReturnValue(makeNoop() as unknown as ReturnType<typeof useTicketAreasModule.useDeleteTicketArea>);
    vi.mocked(ConfirmContextModule.useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
  });

  it('renders the list of areas', () => {
    renderBody();
    expect(screen.getByText('Soporte')).toBeInTheDocument();
    expect(screen.getByText('Facturacion')).toBeInTheDocument();
  });

  it('renders empty state when no areas exist', () => {
    vi.mocked(useTicketAreasModule.useTicketAreas).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useTicketAreasModule.useTicketAreas>);
    renderBody();
    expect(screen.getByText(/no hay areas/i)).toBeInTheDocument();
  });

  it('renders loading state', () => {
    vi.mocked(useTicketAreasModule.useTicketAreas).mockReturnValue({
      data: [],
      isLoading: true,
    } as ReturnType<typeof useTicketAreasModule.useTicketAreas>);
    renderBody();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('renders the Nueva area button', () => {
    renderBody();
    expect(screen.getByRole('button', { name: /nueva area/i })).toBeInTheDocument();
  });

  it('opens create modal when Nueva area is clicked', () => {
    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /nueva area/i }));
    // The modal heading is an h2 with "Nueva area"
    expect(screen.getByRole('heading', { name: /nueva area/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/soporte/i)).toBeInTheDocument();
  });

  it('calls createMutation.mutateAsync with name on save', async () => {
    const createMock = makeNoop();
    vi.mocked(useTicketAreasModule.useCreateTicketArea).mockReturnValue(createMock);
    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /nueva area/i }));
    fireEvent.change(screen.getByPlaceholderText(/soporte/i), { target: { value: 'Redes' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar/i }));
    await waitFor(() => {
      expect(createMock.mutateAsync).toHaveBeenCalledWith({ name: 'Redes' });
    });
  });

  it('opens edit modal with prefilled name when Editar is clicked', () => {
    renderBody();
    const editBtns = screen.getAllByRole('button', { name: /editar/i });
    fireEvent.click(editBtns[0]);
    expect(screen.getByDisplayValue('Soporte')).toBeInTheDocument();
  });

  it('calls updateMutation.mutateAsync on edit save', async () => {
    const updateMock = makeNoop() as unknown as ReturnType<typeof useTicketAreasModule.useUpdateTicketArea>;
    vi.mocked(useTicketAreasModule.useUpdateTicketArea).mockReturnValue(updateMock);
    renderBody();
    const editBtns = screen.getAllByRole('button', { name: /editar/i });
    fireEvent.click(editBtns[0]);
    fireEvent.change(screen.getByDisplayValue('Soporte'), { target: { value: 'Soporte TI' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar/i }));
    await waitFor(() => {
      expect((updateMock as { mutateAsync: ReturnType<typeof vi.fn> }).mutateAsync).toHaveBeenCalledWith({
        id: 'a1',
        data: { name: 'Soporte TI' },
      });
    });
  });

  it('calls deleteMutation.mutateAsync on confirm delete', async () => {
    const deleteMock = makeNoop() as unknown as ReturnType<typeof useTicketAreasModule.useDeleteTicketArea>;
    vi.mocked(useTicketAreasModule.useDeleteTicketArea).mockReturnValue(deleteMock);
    renderBody();
    const deleteBtns = screen.getAllByRole('button', { name: /eliminar/i });
    fireEvent.click(deleteBtns[0]);
    await waitFor(() => {
      expect((deleteMock as { mutateAsync: ReturnType<typeof vi.fn> }).mutateAsync).toHaveBeenCalledWith('a1');
    });
  });

  it('shows 409 in-use error when delete returns TICKET_AREA_IN_USE', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const deleteMock = {
      mutateAsync: vi.fn().mockRejectedValue({
        response: { status: 409, data: { code: 'TICKET_AREA_IN_USE' } },
      }),
      isPending: false,
    } as unknown as ReturnType<typeof useTicketAreasModule.useDeleteTicketArea>;
    vi.mocked(useTicketAreasModule.useDeleteTicketArea).mockReturnValue(deleteMock);
    renderBody();
    const deleteBtns = screen.getAllByRole('button', { name: /eliminar/i });
    fireEvent.click(deleteBtns[0]);
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/no se puede eliminar/i));
    });
    alertSpy.mockRestore();
  });

  it('shows conflict error when create returns TICKET_AREA_NAME_CONFLICT', async () => {
    const createMock = {
      mutateAsync: vi.fn().mockRejectedValue({
        response: { status: 409, data: { code: 'TICKET_AREA_NAME_CONFLICT' } },
      }),
      isPending: false,
    } as unknown as ReturnType<typeof useTicketAreasModule.useCreateTicketArea>;
    vi.mocked(useTicketAreasModule.useCreateTicketArea).mockReturnValue(createMock);
    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /nueva area/i }));
    fireEvent.change(screen.getByPlaceholderText(/soporte/i), { target: { value: 'Soporte' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar/i }));
    await waitFor(() => {
      expect(screen.getByText(/ya existe un area/i)).toBeInTheDocument();
    });
  });
});
