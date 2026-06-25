import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { InternetServiceEvent } from '@/types/internetService';

vi.mock('@/hooks/useInternetServices', () => ({
  useInternetActivationHistory: vi.fn(),
}));

import { useInternetActivationHistory } from '@/hooks/useInternetServices';
import { InternetActivationHistoryModal } from '@/components/molecules/InternetActivationHistoryModal/InternetActivationHistoryModal';

// IMPORTANTE: el BE graba eventType en INGLÉS (activated/deactivated/...). Los
// fixtures deben usar los valores REALES del wire, NO 'alta'/'baja' (que el BE
// NUNCA emite). El badge los mapea a etiqueta español.
const events: InternetServiceEvent[] = [
  {
    id: 'e1',
    clientId: 'client-1',
    customerName: 'Juan Pérez',
    contractId: 'c1',
    eventType: 'activated',
    actorName: 'Operador Uno',
    reason: 'Alta nueva por instalación',
    createdAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'e2',
    clientId: 'client-1',
    customerName: 'Juan Pérez',
    contractId: 'c1',
    eventType: 'deactivated',
    actorName: 'Operador Dos',
    reason: null,
    createdAt: '2026-05-01T10:00:00Z',
  },
];

function mockHistory(over: { data?: InternetServiceEvent[]; isLoading?: boolean; isError?: boolean } = {}) {
  vi.mocked(useInternetActivationHistory).mockReturnValue({
    data: over.data ?? events,
    isLoading: over.isLoading ?? false,
    isError: over.isError ?? false,
  } as ReturnType<typeof useInternetActivationHistory>);
}

function renderModal(props: { open?: boolean; clientId?: string } = {}) {
  return render(
    <MemoryRouter>
      <InternetActivationHistoryModal
        open={props.open ?? true}
        clientId={props.clientId ?? 'client-1'}
        onClose={vi.fn()}
      />
    </MemoryRouter>,
  );
}

/** Renderiza el modal en MODO GLOBAL (sin clientId). */
function renderGlobalModal(props: { open?: boolean } = {}) {
  return render(
    <MemoryRouter>
      <InternetActivationHistoryModal open={props.open ?? true} onClose={vi.fn()} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InternetActivationHistoryModal', () => {
  it('does not render when closed', () => {
    mockHistory();
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a dialog with the history title when open', () => {
    mockHistory();
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/historial de internet/i)).toBeInTheDocument();
  });

  it('renders the column headers Fecha/Tipo/Operador/Motivo', () => {
    mockHistory();
    renderModal();
    expect(screen.getByText(/fecha/i)).toBeInTheDocument();
    expect(screen.getByText('Tipo')).toBeInTheDocument();
    expect(screen.getByText('Operador')).toBeInTheDocument();
    expect(screen.getByText('Motivo')).toBeInTheDocument();
  });

  it('renders one row per event with the operator name and the type badge', () => {
    mockHistory();
    renderModal();
    expect(screen.getByText('Operador Uno')).toBeInTheDocument();
    expect(screen.getByText('Operador Dos')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('Baja')).toBeInTheDocument();
  });

  // ── C1 — el badge DEBE mapear cada eventType REAL del BE (inglés) a su etiqueta ──
  // El BE emite: activated/deactivated/reactivated/modified/reduced/blocked/restored.
  describe('EventTypeBadge mapea los eventType REALES del BE a etiqueta español', () => {
    const cases: Array<[InternetServiceEvent['eventType'], string]> = [
      ['activated', 'Alta'],
      ['restored', 'Restaurado'],
      ['deactivated', 'Baja'],
      ['blocked', 'Bloqueado'],
      ['reactivated', 'Reactivación'],
      ['modified', 'Modificado'],
      ['reduced', 'Reducido'],
    ];

    it.each(cases)('eventType "%s" → etiqueta "%s"', (eventType, label) => {
      mockHistory({
        data: [
          {
            id: `ev-${eventType}`,
            clientId: 'client-1',
            customerName: 'Juan Pérez',
            contractId: 'c1',
            eventType,
            actorName: 'Operador X',
            reason: null,
            createdAt: '2026-06-01T10:00:00Z',
          },
        ],
      });
      renderModal();
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('un eventType DESCONOCIDO muestra el string crudo capitalizado, NO "Reactivación"', () => {
      mockHistory({
        data: [
          {
            id: 'ev-unknown',
            clientId: 'client-1',
            customerName: 'Juan Pérez',
            contractId: 'c1',
            // @ts-expect-error — probamos un valor fuera de la unión (robustez del default).
            eventType: 'frobnicated',
            actorName: 'Operador X',
            reason: null,
            createdAt: '2026-06-01T10:00:00Z',
          },
        ],
      });
      renderModal();
      expect(screen.getByText('Frobnicated')).toBeInTheDocument();
      expect(screen.queryByText('Reactivación')).not.toBeInTheDocument();
    });
  });

  it('passes the clientId filter to the hook (round-trip)', () => {
    mockHistory();
    renderModal({ clientId: 'client-99' });
    expect(useInternetActivationHistory).toHaveBeenCalledWith({ clientId: 'client-99' }, true);
  });

  it('a reason with text shows a "ver" button; opening it shows the reason', async () => {
    const user = userEvent.setup();
    mockHistory();
    renderModal();
    const verButtons = screen.getAllByRole('button', { name: /ver motivo/i });
    expect(verButtons).toHaveLength(1); // only the event WITH a reason
    await user.click(verButtons[0]);
    expect(screen.getByText('Alta nueva por instalación')).toBeInTheDocument();
  });

  it('shows a loading state while fetching', () => {
    mockHistory({ isLoading: true, data: undefined });
    renderModal();
    // DataTable renders skeleton rows while loading — the empty message must NOT show.
    expect(screen.queryByText(/sin eventos/i)).not.toBeInTheDocument();
  });

  it('shows an empty message when there are no events', () => {
    mockHistory({ data: [] });
    renderModal();
    expect(screen.getByText(/sin eventos/i)).toBeInTheDocument();
  });

  it('closes the modal when the close button is clicked', async () => {
    const user = userEvent.setup();
    mockHistory();
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <InternetActivationHistoryModal open clientId="client-1" onClose={onClose} />
      </MemoryRouter>,
    );
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  // ── MODO GLOBAL (sin clientId) — espejo del GlobalBody de TV ──────────────────
  describe('modo global (sin clientId)', () => {
    it('sin clientId → llama al hook SIN clientId (trae todas las altas del sistema)', () => {
      mockHistory();
      renderGlobalModal();
      // El filtro arranca vacío → objeto vacío, no { clientId }.
      expect(useInternetActivationHistory).toHaveBeenCalledWith({}, true);
    });

    it('renderiza la columna Cliente además de Fecha/Tipo/Operador/Motivo', () => {
      mockHistory();
      renderGlobalModal();
      expect(screen.getByText('Cliente')).toBeInTheDocument();
      expect(screen.getByText(/fecha/i)).toBeInTheDocument();
      expect(screen.getByText('Tipo')).toBeInTheDocument();
      expect(screen.getByText('Operador')).toBeInTheDocument();
      expect(screen.getByText('Motivo')).toBeInTheDocument();
    });

    it('muestra el nombre del cliente por fila (modo global cruza clientes)', () => {
      mockHistory();
      renderGlobalModal();
      // El fixture tiene dos eventos del mismo cliente → dos links al cliente.
      const links = screen.getAllByRole('link', { name: /juan pérez/i });
      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links[0]).toHaveAttribute('href', '/admin/customers/view/client-1');
    });

    it('muestra la barra de filtros (desde/hasta/operador) en modo global', () => {
      mockHistory();
      renderGlobalModal();
      expect(screen.getByLabelText(/desde/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/hasta/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/operador/i)).toBeInTheDocument();
    });

    it('round-trip: escribir el ID de operador lo cablea como actorId al hook', async () => {
      const user = userEvent.setup();
      mockHistory();
      renderGlobalModal();
      await user.type(screen.getByLabelText(/operador/i), 'op-7');
      expect(useInternetActivationHistory).toHaveBeenLastCalledWith({ actorId: 'op-7' }, true);
    });

    // W1 — el <input type="date"> da YYYY-MM-DD; el BE hace new Date(...) = UTC
    // midnight = 21:00 AR del día anterior (bordes corridos 3h). DEBE convertirse
    // al instante AR (UTC-3) con arDayStartUtc/arDayEndUtc antes de mandarlo.
    it('round-trip W1: Desde se cablea como el INICIO del día AR en UTC (no UTC midnight)', async () => {
      const user = userEvent.setup();
      mockHistory();
      renderGlobalModal();
      await user.type(screen.getByLabelText(/desde/i), '2026-06-01');
      // arDayStartUtc('2026-06-01') → 2026-06-01T03:00:00.000Z
      expect(useInternetActivationHistory).toHaveBeenLastCalledWith(
        { from: '2026-06-01T03:00:00.000Z' },
        true,
      );
    });

    it('round-trip W1: Hasta se cablea como el FIN del día AR en UTC (inclusive)', async () => {
      const user = userEvent.setup();
      mockHistory();
      renderGlobalModal();
      await user.type(screen.getByLabelText(/hasta/i), '2026-06-01');
      // arDayEndUtc('2026-06-01') → 2026-06-02T02:59:59.999Z
      expect(useInternetActivationHistory).toHaveBeenLastCalledWith(
        { to: '2026-06-02T02:59:59.999Z' },
        true,
      );
    });
  });
});
