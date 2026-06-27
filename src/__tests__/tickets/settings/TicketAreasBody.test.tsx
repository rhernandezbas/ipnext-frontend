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
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

const mockAreas: TicketArea[] = [
  { id: 'a1', name: 'Soporte', color: '#6366f1' },
  { id: 'a2', name: 'Facturacion', color: '#10b981' },
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
    vi.mocked(useTicketAreasModule.useTicketAreas).mockReturnValue(mockQuery({
      data: [],
      isLoading: false,
    }));
    renderBody();
    expect(screen.getByText(/no hay areas/i)).toBeInTheDocument();
  });

  it('renders loading state', () => {
    vi.mocked(useTicketAreasModule.useTicketAreas).mockReturnValue(mockQuery({
      data: [],
      isLoading: true,
    }));
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

  it('calls createMutation.mutateAsync with name + default color on save', async () => {
    const createMock = makeNoop();
    vi.mocked(useTicketAreasModule.useCreateTicketArea).mockReturnValue(createMock);
    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /nueva area/i }));
    fireEvent.change(screen.getByPlaceholderText(/soporte/i), { target: { value: 'Redes' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar/i }));
    await waitFor(() => {
      // #69 — new area carries the default pill color.
      expect(createMock.mutateAsync).toHaveBeenCalledWith({ name: 'Redes', color: '#6366f1' });
    });
  });

  it('#69 — sends the chosen color on create', async () => {
    const createMock = makeNoop();
    vi.mocked(useTicketAreasModule.useCreateTicketArea).mockReturnValue(createMock);
    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /nueva area/i }));
    fireEvent.change(screen.getByPlaceholderText(/soporte/i), { target: { value: 'Redes' } });
    fireEvent.change(screen.getByLabelText(/color del area/i), { target: { value: '#10b981' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar/i }));
    await waitFor(() => {
      expect(createMock.mutateAsync).toHaveBeenCalledWith({ name: 'Redes', color: '#10b981' });
    });
  });

  it('#69 — edit modal prefills the area color', () => {
    renderBody();
    const editBtns = screen.getAllByRole('button', { name: /editar/i });
    fireEvent.click(editBtns[0]);
    expect(screen.getByLabelText(/color del area/i)).toHaveValue('#6366f1');
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
      expect(vi.mocked(updateMock.mutateAsync)).toHaveBeenCalledWith({
        id: 'a1',
        data: { name: 'Soporte TI', color: '#6366f1' },
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
      expect(vi.mocked(deleteMock.mutateAsync)).toHaveBeenCalledWith('a1');
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
