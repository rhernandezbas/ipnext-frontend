/**
 * Tests for TicketAreasBody — catalog ABM (list, create, edit, delete) +
 * portal-topic-admin: visibility of each área as a tópico in the customer app.
 * Mocks at the hook layer (useTicketAreas + mutations).
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

// portal-topic-admin — fixture with >=2 áreas on EACH side (visible/internal).
// A single-element-per-side fixture would let a mutant survive (e.g. "always show
// the chip" or "never show it" could still pass with just 1+1).
const mockAreas: TicketArea[] = [
  {
    id: 'a1',
    name: 'Soporte',
    color: '#6366f1',
    portalVisible: true,
    portalLabel: 'Soporte técnico',
    portalDescription: 'Fallas de internet o del servicio',
    portalOrder: 1,
  },
  {
    id: 'a2',
    name: 'Facturacion',
    color: '#10b981',
    portalVisible: true,
    portalLabel: null,
    portalDescription: null,
    portalOrder: 2,
  },
  {
    id: 'a3',
    name: 'NOC',
    color: '#3b82f6',
    portalVisible: false,
    portalLabel: null,
    portalDescription: null,
    portalOrder: 0,
  },
  {
    id: 'a4',
    name: 'Administracion',
    color: '#f59e0b',
    portalVisible: false,
    portalLabel: null,
    portalDescription: null,
    portalOrder: 0,
  },
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

/** Default portal payload sent when the operator never touches that section. */
const DEFAULT_PORTAL_PAYLOAD = {
  portalVisible: false,
  portalLabel: null,
  portalDescription: null,
  portalOrder: 0,
};

function findRowByText(text: string): HTMLElement {
  const rows = screen.getAllByRole('row');
  const row = rows.find(r => within(r).queryByText(text));
  if (!row) throw new Error(`row containing "${text}" not found`);
  return row;
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
      expect(createMock.mutateAsync).toHaveBeenCalledWith({
        name: 'Redes',
        color: '#6366f1',
        ...DEFAULT_PORTAL_PAYLOAD,
      });
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
      expect(createMock.mutateAsync).toHaveBeenCalledWith({
        name: 'Redes',
        color: '#10b981',
        ...DEFAULT_PORTAL_PAYLOAD,
      });
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
        data: {
          name: 'Soporte TI',
          color: '#6366f1',
          portalVisible: true,
          portalLabel: 'Soporte técnico',
          portalDescription: 'Fallas de internet o del servicio',
          portalOrder: 1,
        },
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

  // ── portal-topic-admin ──────────────────────────────────────────────────

  describe('portal visibility — list', () => {
    it('shows the "En la app" chip only for portal-visible areas (>=2 each side) and the client label if set', () => {
      renderBody();

      const soporteRow = findRowByText('Soporte');
      const facturacionRow = findRowByText('Facturacion');
      const nocRow = findRowByText('NOC');
      const adminRow = findRowByText('Administracion');

      expect(within(soporteRow).getByText('En la app')).toBeInTheDocument();
      expect(within(soporteRow).getByText('Soporte técnico')).toBeInTheDocument();

      expect(within(facturacionRow).getByText('En la app')).toBeInTheDocument();

      expect(within(nocRow).queryByText('En la app')).not.toBeInTheDocument();
      expect(within(adminRow).queryByText('En la app')).not.toBeInTheDocument();
    });
  });

  describe('portal visibility — form', () => {
    it('prefills the 4 portal fields when editing an existing area', () => {
      renderBody();
      const editBtns = screen.getAllByRole('button', { name: /editar/i });
      fireEvent.click(editBtns[0]); // a1 — Soporte, portalVisible: true

      expect(screen.getByLabelText(/mostrar.*app de clientes/i)).toBeChecked();
      expect(screen.getByLabelText(/nombre en la app/i)).toHaveValue('Soporte técnico');
      expect(screen.getByLabelText(/descripci[oó]n en la app/i)).toHaveValue('Fallas de internet o del servicio');
      expect(screen.getByLabelText(/orden en la app/i)).toHaveValue(1);
    });

    it('sends portalLabel as null (not empty string) when the operator clears it', async () => {
      const updateMock = makeNoop() as unknown as ReturnType<typeof useTicketAreasModule.useUpdateTicketArea>;
      vi.mocked(useTicketAreasModule.useUpdateTicketArea).mockReturnValue(updateMock);
      renderBody();
      const editBtns = screen.getAllByRole('button', { name: /editar/i });
      fireEvent.click(editBtns[0]); // a1 — portalLabel: 'Soporte técnico'

      fireEvent.change(screen.getByLabelText(/nombre en la app/i), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: /^guardar/i }));

      await waitFor(() => {
        expect(vi.mocked(updateMock.mutateAsync)).toHaveBeenCalledWith({
          id: 'a1',
          data: expect.objectContaining({ portalLabel: null }),
        });
      });
      // asserting the REAL body, not just "didn't throw":
      const call = vi.mocked(updateMock.mutateAsync).mock.calls[0][0];
      expect(call.data.portalLabel).toBe(null);
      expect(call.data.portalLabel).not.toBe('');
    });

    // El BE exige `z.number().int()`. Un `<input type="number">` deja pasar
    // decimales, que `Number()` convierte en 1.5 y se comen un 400 que el
    // operador ve como "No se pudo guardar el area", sin pista de cual campo
    // lo causo.
    //
    // HONESTIDAD SOBRE ESTE TEST: el revert-probe (romper `toPortalOrder` para
    // devolver el `Number()` crudo) mata SOLO la fila del decimal. Las filas
    // '-' y '' pasan CON Y SIN el guard, porque jsdom —igual que un browser
    // real— normaliza un valor invalido de un input numerico a '' antes de que
    // el handler lo vea, y `Number('')` ya es 0. O sea: NO son la red, son
    // documentacion del contrato "salga lo que salga del input, al BE va un
    // entero". La rama NaN de `toPortalOrder` es defensa en profundidad para
    // el dia que ese input cambie de tipo, no una ruta alcanzable hoy.
    it.each([
      ['2.7', 2, 'un decimal se trunca — LA fila que el probe mata'],
      ['-', 0, 'normalizado a "" por el input; no discrimina el guard'],
      ['', 0, 'campo vaciado; no discrimina el guard'],
    ])('portalOrder %s => %i (%s)', async (typed, expected) => {
      const updateMock = makeNoop() as unknown as ReturnType<typeof useTicketAreasModule.useUpdateTicketArea>;
      vi.mocked(useTicketAreasModule.useUpdateTicketArea).mockReturnValue(updateMock);
      renderBody();
      fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);

      fireEvent.change(screen.getByLabelText(/orden en la app/i), { target: { value: typed } });
      fireEvent.click(screen.getByRole('button', { name: /^guardar/i }));

      await waitFor(() => expect(vi.mocked(updateMock.mutateAsync)).toHaveBeenCalled());
      const call = vi.mocked(updateMock.mutateAsync).mock.calls[0][0];
      expect(call.data.portalOrder).toBe(expected);
      expect(Number.isInteger(call.data.portalOrder)).toBe(true);
    });

    it('preserves label/description text when portalVisible is toggled off and back on', () => {
      renderBody();
      const editBtns = screen.getAllByRole('button', { name: /editar/i });
      fireEvent.click(editBtns[0]); // a1

      const toggle = screen.getByLabelText(/mostrar.*app de clientes/i);
      fireEvent.click(toggle); // off
      expect(toggle).not.toBeChecked();
      fireEvent.click(toggle); // back on
      expect(toggle).toBeChecked();

      expect(screen.getByLabelText(/nombre en la app/i)).toHaveValue('Soporte técnico');
      expect(screen.getByLabelText(/descripci[oó]n en la app/i)).toHaveValue('Fallas de internet o del servicio');
    });

    it('disables the label/description/order fields while portalVisible is off', () => {
      renderBody();
      const editBtns = screen.getAllByRole('button', { name: /editar/i });
      fireEvent.click(editBtns[2]); // a3 — NOC, portalVisible: false

      expect(screen.getByLabelText(/mostrar.*app de clientes/i)).not.toBeChecked();
      expect(screen.getByLabelText(/nombre en la app/i)).toBeDisabled();
      expect(screen.getByLabelText(/descripci[oó]n en la app/i)).toBeDisabled();
      expect(screen.getByLabelText(/orden en la app/i)).toBeDisabled();
    });

    it('creating an area without touching the portal section never sends portalVisible: true', async () => {
      const createMock = makeNoop();
      vi.mocked(useTicketAreasModule.useCreateTicketArea).mockReturnValue(createMock);
      renderBody();
      fireEvent.click(screen.getByRole('button', { name: /nueva area/i }));
      fireEvent.change(screen.getByPlaceholderText(/soporte/i), { target: { value: 'Redes' } });
      fireEvent.click(screen.getByRole('button', { name: /^guardar/i }));

      await waitFor(() => {
        expect(createMock.mutateAsync).toHaveBeenCalled();
      });
      const payload = vi.mocked(createMock.mutateAsync).mock.calls[0][0];
      expect(payload.portalVisible).not.toBe(true);
      expect(payload.portalVisible).toBe(false);
    });
  });
});
