import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { InternetServiceEvent } from '@/types/internetService';

// El select de operadores se puebla del endpoint pppoe-scoped
// usePppoeActivationOperators (gate pppoe.read) — NO de useRbacUsers (que pedía
// admin/rbac y dejaba el select vacío para usuarios pppoe.read-only). El endpoint
// ya devuelve SOLO los operadores que generaron eventos, así que el componente NO
// filtra por rol ni status: mapea {actorId, actorName} → {id, name} tal cual.
vi.mock('@/hooks/useInternetServices', () => ({
  useInternetActivationHistory: vi.fn(),
  usePppoeActivationOperators: vi.fn(),
}));

vi.mock('@/utils/exportToCsv', () => ({
  exportToCsv: vi.fn(),
}));

import {
  useInternetActivationHistory,
  usePppoeActivationOperators,
} from '@/hooks/useInternetServices';
import { exportToCsv } from '@/utils/exportToCsv';
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

/**
 * Mockea usePppoeActivationOperators (la fuente del select de operadores). El
 * endpoint pppoe-scoped ya devuelve los operadores DISTINCT que generaron eventos
 * (cualquier rol, sin status): el componente los mapea {actorId, actorName} →
 * {id, name} tal cual, sin filtrar.
 */
type OperatorSpec = { actorId: string; actorName: string };

function mockOperators(specs: OperatorSpec[] = [], isLoading = false) {
  vi.mocked(usePppoeActivationOperators).mockReturnValue({
    data: isLoading ? undefined : specs,
    isLoading,
    isError: false,
  } as ReturnType<typeof usePppoeActivationOperators>);
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
  // Default: empty operators list, not loading.
  mockOperators();
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

  // ── Badge de dirección (↑/↓) + texto oldPlan → newPlan en filas 'modified' ──
  describe('badge de dirección + oldPlan → newPlan en filas modified', () => {
    function modifiedEvent(over: {
      direction: 'upgrade' | 'downgrade' | null;
      oldPlan: string | null;
      newPlan: string | null;
    }): InternetServiceEvent {
      return {
        id: 'ev-modified',
        clientId: 'client-1',
        customerName: 'Juan Pérez',
        contractId: 'c1',
        eventType: 'modified',
        actorName: 'Operador X',
        reason: null,
        createdAt: '2026-06-01T10:00:00Z',
        ...over,
      };
    }

    it('direction "upgrade" renderiza el badge ↑ y el texto oldPlan → newPlan', () => {
      mockHistory({
        data: [modifiedEvent({ direction: 'upgrade', oldPlan: 'IP-30M', newPlan: 'IP-50M' })],
      });
      renderModal();
      expect(screen.getByText('↑')).toBeInTheDocument();
      expect(screen.getByText('IP-30M → IP-50M')).toBeInTheDocument();
    });

    it('direction "downgrade" renderiza el badge ↓ y el texto oldPlan → newPlan', () => {
      mockHistory({
        data: [modifiedEvent({ direction: 'downgrade', oldPlan: 'IP-50M', newPlan: 'IP-30M' })],
      });
      renderModal();
      expect(screen.getByText('↓')).toBeInTheDocument();
      expect(screen.getByText('IP-50M → IP-30M')).toBeInTheDocument();
    });

    it('direction null Y sin planes (legacy) NO renderiza badge ni texto', () => {
      mockHistory({
        data: [modifiedEvent({ direction: null, oldPlan: null, newPlan: null })],
      });
      renderModal();
      expect(screen.queryByText('↑')).not.toBeInTheDocument();
      expect(screen.queryByText('↓')).not.toBeInTheDocument();
      expect(screen.queryByText(/→/)).not.toBeInTheDocument();
    });

    it('direction null CON oldPlan/newPlan (lateral/enforcement) muestra el texto SIN badge', () => {
      mockHistory({
        data: [modifiedEvent({ direction: null, oldPlan: 'IP-50M', newPlan: 'IP-REDUCCION' })],
      });
      renderModal();
      expect(screen.getByText('IP-50M → IP-REDUCCION')).toBeInTheDocument();
      expect(screen.queryByText('↑')).not.toBeInTheDocument();
      expect(screen.queryByText('↓')).not.toBeInTheDocument();
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
      // 'Operador' aparece dos veces: en el label del filtro Y en el header de la columna.
      expect(screen.getAllByText('Operador').length).toBeGreaterThanOrEqual(1);
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

    // NOTE: el filtro de Operador es ahora un <select> (no texto libre).
    // Se elige por nombre y el value del option es el id.
    it('round-trip: elegir un operador en el select lo cablea como actorId al hook', async () => {
      const user = userEvent.setup();
      mockHistory();
      mockOperators([{ actorId: 'op-7', actorName: 'Operador Siete' }]);
      renderGlobalModal();
      await user.selectOptions(screen.getByLabelText(/operador/i), 'op-7');
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

    // ── Operador SELECT ──────────────────────────────────────────────────────
    describe('operador select (reemplaza input de texto)', () => {
      it('renderiza un <select> (no un input) para el filtro de operador', () => {
        mockHistory();
        renderGlobalModal();
        const el = screen.getByLabelText(/operador/i);
        expect(el.tagName).toBe('SELECT');
      });

      it('muestra la opción "Todos" por default y una opción por operador', () => {
        mockHistory();
        mockOperators([
          { actorId: 'op-1', actorName: 'Ana García' },
          { actorId: 'op-2', actorName: 'Juan López' },
        ]);
        renderGlobalModal();
        const select = screen.getByLabelText(/operador/i);
        expect(within(select).getByRole('option', { name: /todos/i })).toBeInTheDocument();
        expect(within(select).getByRole('option', { name: 'Ana García' })).toBeInTheDocument();
        expect(within(select).getByRole('option', { name: 'Juan López' })).toBeInTheDocument();
      });

      // ── REGRESIÓN (bug del review) ──────────────────────────────────────────
      // El select se puebla del endpoint pppoe-scoped, NO de useAssignableOperators
      // (que filtra al rol ventas). Las altas de Internet las hacen admin/NOC/red,
      // así que un operador NO-ventas DEBE aparecer. El endpoint ya devuelve la
      // lista relevante tal cual y el componente la muestra entera (sin filtrar).
      it('incluye operadores de CUALQUIER rol (admin/NOC), NO solo ventas', () => {
        mockHistory();
        mockOperators([
          { actorId: 'op-admin', actorName: 'Admin Root' },
          { actorId: 'op-noc', actorName: 'Tecnico NOC' },
          { actorId: 'op-ventas', actorName: 'Vendedor Uno' },
        ]);
        renderGlobalModal();
        // Los TRES deben aparecer — incluido el admin y el NOC (no-ventas).
        expect(screen.getByRole('option', { name: 'Admin Root' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Tecnico NOC' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Vendedor Uno' })).toBeInTheDocument();
      });

      // El endpoint ya devuelve solo los relevantes: el componente NO filtra,
      // solo mapea {actorId, actorName} → {value, label} del <option>.
      it('puebla el select tal cual el endpoint (actorId como value, actorName como label)', () => {
        mockHistory();
        mockOperators([{ actorId: 'op-42', actorName: 'Operador Cuarenta y Dos' }]);
        renderGlobalModal();
        const option = screen.getByRole('option', {
          name: 'Operador Cuarenta y Dos',
        }) as HTMLOptionElement;
        expect(option).toBeInTheDocument();
        expect(option.value).toBe('op-42');
      });

      it('degrada a solo "Todos" sin romper cuando la lista viene vacía (query falló)', () => {
        mockHistory();
        mockOperators([]); // data vacía → query falló (el contrato dice nunca vacío)
        renderGlobalModal();
        const select = screen.getByLabelText(/operador/i);
        expect(select.tagName).toBe('SELECT');
        // Solo la opción "Todos" — sin crash.
        expect(within(select).getAllByRole('option')).toHaveLength(1);
        expect(within(select).getByRole('option', { name: /todos/i })).toBeInTheDocument();
      });

      it('el select se deshabilita mientras cargan los operadores', () => {
        mockHistory();
        mockOperators([], true);
        renderGlobalModal();
        expect(screen.getByLabelText(/operador/i)).toBeDisabled();
      });

      it('seleccionando "Todos" (value vacío) limpia el filtro actorId', async () => {
        const user = userEvent.setup();
        mockHistory();
        mockOperators([{ actorId: 'op-1', actorName: 'Ana García' }]);
        renderGlobalModal();
        // Seleccionar un operador...
        await user.selectOptions(screen.getByLabelText(/operador/i), 'op-1');
        // ...volver a "Todos"
        await user.selectOptions(screen.getByLabelText(/operador/i), '');
        expect(useInternetActivationHistory).toHaveBeenLastCalledWith({}, true);
      });
    });

    // ── Tópico select (filtro server-side por eventType) ──────────────────────
    describe('tópico select (filtro por eventType)', () => {
      it('renderiza un <select> Tópico con "Todos" + una opción por eventType, en orden canónico', () => {
        mockHistory();
        renderGlobalModal();
        const select = screen.getByLabelText(/tópico/i);
        expect(select.tagName).toBe('SELECT');
        const options = within(select).getAllByRole('option') as HTMLOptionElement[];
        expect(options.map((o) => o.value)).toEqual([
          '',
          'activated',
          'deactivated',
          'reactivated',
          'reduced',
          'blocked',
          'restored',
          'modified',
        ]);
        expect(within(select).getByRole('option', { name: 'Todos' })).toBeInTheDocument();
        expect(within(select).getByRole('option', { name: 'Alta' })).toBeInTheDocument();
        expect(within(select).getByRole('option', { name: 'Modificado' })).toBeInTheDocument();
      });

      it('round-trip: elegir un tópico lo cablea como eventType al hook', async () => {
        const user = userEvent.setup();
        mockHistory();
        renderGlobalModal();
        await user.selectOptions(screen.getByLabelText(/tópico/i), 'modified');
        expect(useInternetActivationHistory).toHaveBeenLastCalledWith({ eventType: 'modified' }, true);
      });

      it('seleccionar "Todos" (value vacío) limpia el filtro eventType', async () => {
        const user = userEvent.setup();
        mockHistory();
        renderGlobalModal();
        await user.selectOptions(screen.getByLabelText(/tópico/i), 'modified');
        await user.selectOptions(screen.getByLabelText(/tópico/i), '');
        expect(useInternetActivationHistory).toHaveBeenLastCalledWith({}, true);
      });
    });

    // ── Dirección select (filtro server-side por upgrade/downgrade) ───────────
    describe('dirección select (filtro por upgrade/downgrade)', () => {
      it('renderiza un <select> Dirección con "Todos" + Upgrade + Downgrade', () => {
        mockHistory();
        renderGlobalModal();
        const select = screen.getByLabelText(/dirección/i);
        expect(select.tagName).toBe('SELECT');
        const options = within(select).getAllByRole('option') as HTMLOptionElement[];
        expect(options.map((o) => o.value)).toEqual(['', 'upgrade', 'downgrade']);
      });

      it('round-trip: elegir Upgrade lo cablea como direction al hook', async () => {
        const user = userEvent.setup();
        mockHistory();
        renderGlobalModal();
        await user.selectOptions(screen.getByLabelText(/dirección/i), 'upgrade');
        expect(useInternetActivationHistory).toHaveBeenLastCalledWith({ direction: 'upgrade' }, true);
      });

      it('round-trip: elegir Downgrade lo cablea como direction al hook', async () => {
        const user = userEvent.setup();
        mockHistory();
        renderGlobalModal();
        await user.selectOptions(screen.getByLabelText(/dirección/i), 'downgrade');
        expect(useInternetActivationHistory).toHaveBeenLastCalledWith({ direction: 'downgrade' }, true);
      });

      it('seleccionar "Todos" (value vacío) limpia el filtro direction', async () => {
        const user = userEvent.setup();
        mockHistory();
        renderGlobalModal();
        await user.selectOptions(screen.getByLabelText(/dirección/i), 'upgrade');
        await user.selectOptions(screen.getByLabelText(/dirección/i), '');
        expect(useInternetActivationHistory).toHaveBeenLastCalledWith({}, true);
      });
    });

    // ── Export CSV ───────────────────────────────────────────────────────────
    describe('exportar CSV (modo global)', () => {
      it('muestra el botón "Exportar CSV" en la barra de filtros del modo global', () => {
        mockHistory();
        renderGlobalModal();
        expect(screen.getByRole('button', { name: /exportar csv/i })).toBeInTheDocument();
      });

      it('NO muestra el botón "Exportar CSV" en modo per-cliente', () => {
        mockHistory();
        renderModal({ clientId: 'client-1' });
        expect(
          screen.queryByRole('button', { name: /exportar csv/i }),
        ).not.toBeInTheDocument();
      });

      it('clicar Exportar CSV llama exportToCsv con las 5 columnas: Fecha·Tipo·Cliente·Operador·Motivo', async () => {
        const user = userEvent.setup();
        mockHistory({ data: events });
        renderGlobalModal();
        await user.click(screen.getByRole('button', { name: /exportar csv/i }));
        expect(exportToCsv).toHaveBeenCalledWith(
          expect.anything(),
          expect.arrayContaining([
            expect.objectContaining({ label: 'Fecha' }),
            expect.objectContaining({ label: 'Tipo' }),
            expect.objectContaining({ label: 'Cliente' }),
            expect.objectContaining({ label: 'Operador' }),
            expect.objectContaining({ label: 'Motivo' }),
          ]),
          expect.stringContaining('.csv'),
        );
      });

      // Risk #2 del review: el botón queda SIEMPRE habilitado (no parpadea
      // disabled durante el loading). La garantía de "no bajar archivo vacío"
      // vive en exportToCsv (early-return), testeado en exportToCsv.test.ts.
      it('el botón exportar está SIEMPRE habilitado, incluso con 0 filas', () => {
        mockHistory({ data: [] });
        renderGlobalModal();
        expect(screen.getByRole('button', { name: /exportar csv/i })).toBeEnabled();
      });

      it('con 0 filas, clicar Exportar pasa un array vacío a exportToCsv (que hace early-return → no baja archivo)', async () => {
        const user = userEvent.setup();
        mockHistory({ data: [] });
        renderGlobalModal();
        await user.click(screen.getByRole('button', { name: /exportar csv/i }));
        // exportToCsv recibe [] — su early-return (cubierto en exportToCsv.test.ts)
        // garantiza que NO se dispara ninguna descarga.
        expect(exportToCsv).toHaveBeenCalledWith([], expect.anything(), expect.any(String));
      });
    });
  });
});
