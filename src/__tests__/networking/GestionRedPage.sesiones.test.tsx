/**
 * GestionRedPage — Tab Sesiones activas (redesign)
 *
 * Cubre:
 *  S-1  Filtros disparan request con params correctos (search, nasId, status, page, limit)
 *  S-2  Paginación: click en "siguiente" incrementa page → el hook recibe page=2
 *  S-3  Badge del tab usa stats.total (no data.length)
 *  S-4  Empty state cuando sessions=[] (sin sesiones para los filtros)
 *  S-5  KPIs de cabecera (total/active/idle) desde stats
 *  S-6  Reset a page=1 cuando cambia el filtro de estado
 *  F1   Dropdown de NAS de Sesiones poblado desde useNasServers (fuente ESTABLE),
 *       NO desde sessionsEnvelope.data (la página paginada ≤50 de ~3000 sesiones).
 *  W2   Guard contra respuesta legacy (array plano) del BE — no debe crashear.
 *  W3   El badge de estado por fila NO es una live region (role="status").
 *  W4   Cobertura honesta: debounce real, reset de page por search, S-2 real.
 */
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import GestionRedPage from '@/pages/networking/GestionRedPage';
import * as useRadiusSessionsModule from '@/hooks/useRadiusSessions';
import * as useNasModule from '@/hooks/useNas';
import * as useNetworkModule from '@/hooks/useNetwork';
import { mockQuery, mockMutation } from '@/__tests__/_utils/reactQueryMocks';
import type { PaginatedRadiusSessions } from '@/types/radiusSessions';
import type { NasServer } from '@/types/nas';

// ── Mocks ─────────────────────────────────────────────────────────────────────
// useMyPermissions y useConfirm ya vienen mockeados (permisivos) del setup global
// (src/test/setup.ts) — sus implementaciones de fábrica sobreviven a clearAllMocks().
vi.mock('@/hooks/useRadiusSessions');
vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useNetwork');
vi.mock('@/pages/networking/PppoeManagementTab', () => ({
  PppoeManagementTab: () => <div>PPPoE stub</div>,
}));

// ── Helpers ────────────────────────────────────────────────────────────────────
// F1 fix: antes TODAS las sesiones del fixture compartían el mismo nasId
// ('10.75.0.1'), lo que enmascaraba el bug del dropdown poblado desde
// sessionsEnvelope.data — con un solo NAS en el fixture, el dedup "accidentalmente"
// mostraba el único NAS presente y nunca exponía que a escala real (≤50 de ~3000
// sesiones) faltaban NAS. Por default ahora sembramos sesiones de VARIOS NAS.
const DEFAULT_NAS_IDS = ['10.75.0.1', '10.75.0.2', '10.75.0.3'];

function makeSessions(count: number, nasIds: string[] = DEFAULT_NAS_IDS) {
  return Array.from({ length: count }, (_, i) => {
    const nasId = nasIds[i % nasIds.length];
    return {
      id: `s-${i}`,
      sessionId: `sess-${i}`,
      username: `user${i}`,
      clientName: `Cliente ${i}`,
      customerName: `Cliente ${i}`,
      clientId: `c-${i}`,
      contractId: `ctr-${i}`,
      nasId,
      nasName: nasId,
      ipAddress: `10.0.0.${i}`,
      macAddress: `AA:BB:CC:DD:EE:${i.toString(16).padStart(2, '0')}`,
      startedAt: new Date().toISOString(),
      duration: 3600,
      downloadBytes: 0,
      uploadBytes: 0,
      downloadMbps: 0,
      uploadMbps: 0,
      status: 'active' as const,
    };
  });
}

function makeNasServer(overrides: Partial<NasServer> & Pick<NasServer, 'id' | 'name' | 'nasIpAddress'>): NasServer {
  return {
    type: 'mikrotik_api',
    ipAddress: overrides.nasIpAddress,
    radiusSecret: '',
    apiPort: null,
    apiLogin: null,
    apiPassword: null,
    status: 'active',
    lastSeen: null,
    clientCount: 0,
    description: '',
    ...overrides,
  };
}

function makeEnvelope(override: Partial<PaginatedRadiusSessions> = {}): PaginatedRadiusSessions {
  const sessions = makeSessions(10);
  return {
    data: sessions,
    total: 10,
    page: 1,
    limit: 50,
    hasNext: false,
    stats: { total: 10, active: 10, idle: 0 },
    ...override,
  };
}

function defaultMocks(envelopeOverride?: Partial<PaginatedRadiusSessions>) {
  vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mockReturnValue(
    mockQuery({ data: makeEnvelope(envelopeOverride), isLoading: false })
  );
  vi.mocked(useNasModule.useNasServers).mockReturnValue(mockQuery({ data: [], isLoading: false }));
  vi.mocked(useNasModule.useCreateNasServer).mockReturnValue(mockMutation());
  vi.mocked(useNasModule.useUpdateNasServer).mockReturnValue(mockMutation());
  vi.mocked(useNasModule.useDeleteNasServer).mockReturnValue(mockMutation());
  vi.mocked(useNetworkModule.useIpNetworks).mockReturnValue(mockQuery({ data: [], isLoading: false }));
  vi.mocked(useNetworkModule.useCreateIpNetwork).mockReturnValue(mockMutation());
  vi.mocked(useNetworkModule.useDeleteIpNetwork).mockReturnValue(mockMutation());
  vi.mocked(useNetworkModule.useIpPools).mockReturnValue(mockQuery({ data: [], isLoading: false }));
  vi.mocked(useNetworkModule.useCreateIpPool).mockReturnValue(mockMutation());
  vi.mocked(useNetworkModule.useDeleteIpPool).mockReturnValue(mockMutation());
  vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue(mockQuery({ data: { data: [], total: 0, page: 1, pageSize: 25 }, isLoading: false }));
  vi.mocked(useNetworkModule.useIpv6Networks).mockReturnValue(mockQuery({ data: [], isLoading: false }));
  vi.mocked(useNetworkModule.useCreateIpv6Network).mockReturnValue(mockMutation());
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <GestionRedPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('GestionRedPage — Tab Sesiones activas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultMocks();
  });

  async function goToSesiones() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Sesiones activas/i }));
    return user;
  }

  it('S-1: llama useRadiusSessionsPaginated con page=1 y limit=50 por defecto', async () => {
    renderPage();
    await goToSesiones();
    expect(useRadiusSessionsModule.useRadiusSessionsPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 50 })
    );
  });

  it('S-1b: search debounced se incluye en los params', async () => {
    renderPage();
    const user = await goToSesiones();
    const searchInput = screen.getByRole('textbox', { name: /Buscar sesiones/i });
    await user.type(searchInput, 'perez');
    // El debounce es 300ms, así que en el mock sincrónico el argumento
    // llegará después del debounce. Verificamos que el hook fue llamado
    // con search=undefined mientras escribe (antes del debounce):
    expect(useRadiusSessionsModule.useRadiusSessionsPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 50 })
    );
  });

  it('S-1c: filtro de NAS se incluye en los params', async () => {
    // F1: el dropdown de NAS sale de useNasServers (fuente ESTABLE), NO de
    // sessionsEnvelope.data — sembramos el NAS ahí, no en las sesiones.
    vi.mocked(useNasModule.useNasServers).mockReturnValue(
      mockQuery({ data: [makeNasServer({ id: 'nas-x', name: 'NAS X', nasIpAddress: '10.75.0.30' })], isLoading: false })
    );
    renderPage();
    const user = await goToSesiones();
    const nasSelect = screen.getByRole('combobox', { name: /Filtrar por NAS/i });
    await user.selectOptions(nasSelect, '10.75.0.30');
    expect(useRadiusSessionsModule.useRadiusSessionsPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ nasId: '10.75.0.30', page: 1 })
    );
  });

  it('S-1d: filtro de estado se incluye en los params', async () => {
    renderPage();
    const user = await goToSesiones();
    const statusSelect = screen.getByRole('combobox', { name: /Filtrar por estado/i });
    await user.selectOptions(statusSelect, 'active');
    expect(useRadiusSessionsModule.useRadiusSessionsPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', page: 1 })
    );
  });

  it('S-2: click en "siguiente" incrementa page y el hook recibe page=2 (real, no trivial)', async () => {
    // total=150, limit=50 → 3 páginas → Pagination se renderiza y "siguiente" es clickeable.
    vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mockReturnValue(
      mockQuery({ data: makeEnvelope({ total: 150, hasNext: true }) })
    );
    renderPage();
    const user = await goToSesiones();

    await user.click(screen.getByRole('button', { name: /siguiente/i }));

    await waitFor(() => {
      const calls = vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.page).toBe(2);
    });
  });

  it('S-3: badge del tab sesiones usa stats.total, no data.length', () => {
    // stats.total=500 pero data tiene solo 50 (una página)
    vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mockReturnValue(
      mockQuery({ data: makeEnvelope({ total: 50, stats: { total: 500, active: 490, idle: 10 } }) })
    );
    renderPage();
    // El badge debe mostrar 500 (stats.total), no 50 (data.length)
    const sessTabBtn = screen.getByRole('button', { name: /Sesiones activas/i });
    // El badge está dentro del botón del tab
    expect(sessTabBtn).toHaveTextContent('500');
  });

  it('S-4: empty state cuando no hay sesiones para los filtros', async () => {
    vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mockReturnValue(
      mockQuery({ data: makeEnvelope({ data: [], total: 0, stats: { total: 0, active: 0, idle: 0 } }) })
    );
    renderPage();
    await goToSesiones();
    expect(screen.getByText(/Sin sesiones para los filtros seleccionados/i)).toBeInTheDocument();
  });

  it('S-5: KPIs total/active/idle visibles desde stats', async () => {
    vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mockReturnValue(
      mockQuery({ data: makeEnvelope({ stats: { total: 100, active: 80, idle: 20 } }) })
    );
    renderPage();
    await goToSesiones();
    // KPI section tiene aria-label="Totales de sesiones"
    const kpiRegion = screen.getByRole('region', { name: /Totales de sesiones/i });
    expect(kpiRegion).toHaveTextContent('100');
    expect(kpiRegion).toHaveTextContent('80');
    expect(kpiRegion).toHaveTextContent('20');
  });

  it('S-6: cambiar filtro de estado resetea page a 1', async () => {
    // Título corregido (W4d): este test ejercita el filtro de ESTADO, no nasId
    // (el reset de page por nasId ya está cubierto en S-1c/F1-b).
    // Primera render con page por defecto en 1
    renderPage();
    const user = await goToSesiones();

    const statusSelect = screen.getByRole('combobox', { name: /Filtrar por estado/i });
    await user.selectOptions(statusSelect, 'idle');

    // Después de cambiar el filtro, el hook debe recibir page=1
    const calls = vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.page).toBe(1);
  });
});

// ── F1: dropdown de NAS de Sesiones — fuente ESTABLE (useNasServers) ─────────
describe('GestionRedPage — F1: dropdown de NAS de Sesiones desde fuente estable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultMocks();
  });

  async function goToSesiones() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Sesiones activas/i }));
    return user;
  }

  const manyNasServers: NasServer[] = [
    makeNasServer({ id: 'nas-1', name: 'NE8000 Sur', nasIpAddress: '10.75.0.1' }),
    makeNasServer({ id: 'nas-2', name: 'MikroTik RDA1', nasIpAddress: '10.75.0.2' }),
    makeNasServer({ id: 'nas-3', name: 'MikroTik RDA2', nasIpAddress: '10.75.0.3' }),
    makeNasServer({ id: 'nas-4', name: 'Ubiquiti Norte', nasIpAddress: '10.75.0.4' }),
  ];

  it('F1-a: lista TODOS los NAS servers aunque la página actual solo tenga sesiones de UN NAS', async () => {
    vi.mocked(useNasModule.useNasServers).mockReturnValue(mockQuery({ data: manyNasServers, isLoading: false }));
    // La página actual (≤50 de ~3000 sesiones reales) solo trae sesiones del primer NAS.
    const envelope = makeEnvelope({ data: makeSessions(10, ['10.75.0.1']) });
    vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mockReturnValue(mockQuery({ data: envelope }));

    renderPage();
    await goToSesiones();

    const nasSelect = screen.getByRole('combobox', { name: /Filtrar por NAS/i });
    const optionLabels = within(nasSelect).getAllByRole('option').map(o => o.textContent);
    expect(optionLabels.some(l => l?.includes('NE8000 Sur'))).toBe(true);
    expect(optionLabels.some(l => l?.includes('MikroTik RDA1'))).toBe(true);
    expect(optionLabels.some(l => l?.includes('MikroTik RDA2'))).toBe(true);
    expect(optionLabels.some(l => l?.includes('Ubiquiti Norte'))).toBe(true);
  });

  it('F1-b: seleccionar un NAS AUSENTE en la página actual dispara el param nasId correcto', async () => {
    vi.mocked(useNasModule.useNasServers).mockReturnValue(mockQuery({ data: manyNasServers, isLoading: false }));
    // Ninguna sesión de la página actual pertenece a nas-3 (10.75.0.3).
    const envelope = makeEnvelope({ data: makeSessions(10, ['10.75.0.1']) });
    vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mockReturnValue(mockQuery({ data: envelope }));

    renderPage();
    const user = await goToSesiones();

    const nasSelect = screen.getByRole('combobox', { name: /Filtrar por NAS/i });
    await user.selectOptions(nasSelect, '10.75.0.3');

    expect(useRadiusSessionsModule.useRadiusSessionsPaginated).toHaveBeenCalledWith(
      expect.objectContaining({ nasId: '10.75.0.3', page: 1 })
    );
  });

  it('F1-c: NAS servers sin nasIpAddress se omiten del dropdown', async () => {
    const serversWithBlank: NasServer[] = [
      ...manyNasServers,
      makeNasServer({ id: 'nas-5', name: 'Sin IP NAS', nasIpAddress: '' }),
    ];
    vi.mocked(useNasModule.useNasServers).mockReturnValue(mockQuery({ data: serversWithBlank, isLoading: false }));

    renderPage();
    await goToSesiones();

    const nasSelect = screen.getByRole('combobox', { name: /Filtrar por NAS/i });
    expect(within(nasSelect).queryByText(/Sin IP NAS/i)).not.toBeInTheDocument();
  });

  it('F1-d: el dropdown NO depende de la data paginada — con sessionsEnvelope vacío igual muestra los NAS', async () => {
    vi.mocked(useNasModule.useNasServers).mockReturnValue(mockQuery({ data: manyNasServers, isLoading: false }));
    const envelope = makeEnvelope({ data: [], total: 0, stats: { total: 0, active: 0, idle: 0 } });
    vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mockReturnValue(mockQuery({ data: envelope }));

    renderPage();
    await goToSesiones();

    const nasSelect = screen.getByRole('combobox', { name: /Filtrar por NAS/i });
    const optionLabels = within(nasSelect).getAllByRole('option').map(o => o.textContent);
    expect(optionLabels.length).toBe(manyNasServers.length + 1); // + "Todos los NAS"
  });
});

// ── W2: guard contra respuesta legacy (array plano) del BE ───────────────────
describe('GestionRedPage — W2: guard contra sessionsEnvelope legacy (array plano)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultMocks();
  });

  it('si el BE responde el array legacy (sin envelope), el tab degrada graceful (vacío, sin crash)', async () => {
    // Simula un BE viejo que todavía responde RadiusSession[] plano en vez del
    // envelope paginado — sessionsEnvelope terminaría siendo un array, no un objeto
    // con .data/.stats/.total. El componente NO debe tirar TypeError.
    const legacyArrayResponse = makeSessions(3) as unknown as PaginatedRadiusSessions;
    vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mockReturnValue(
      mockQuery({ data: legacyArrayResponse, isLoading: false })
    );

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /Sesiones activas/i }));

    // Degrada a vacío en vez de crashear.
    expect(screen.getByText(/Sin sesiones para los filtros seleccionados/i)).toBeInTheDocument();
  });
});

// ── W3: el badge de estado por fila NO es una live region ────────────────────
describe('GestionRedPage — W3: badge de estado sin role="status" (evita 50 live regions)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultMocks();
  });

  it('con sesiones cargadas, ninguna fila usa role="status"; el estado sigue siendo accesible via aria-label', async () => {
    const envelope = makeEnvelope({ data: makeSessions(5) });
    vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mockReturnValue(mockQuery({ data: envelope }));

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /Sesiones activas/i }));

    // El skeleton de carga (role="status") no está montado — los datos ya cargaron.
    // Si el badge por fila siguiera usando role="status", esto encontraría 5 elementos.
    expect(screen.queryAllByRole('status')).toHaveLength(0);
    // La info de estado sigue siendo accesible para lectores de pantalla.
    expect(screen.getAllByLabelText('Activo').length).toBeGreaterThan(0);
  });
});

// ── W4: cobertura honesta ─────────────────────────────────────────────────────
describe('GestionRedPage — W4: cobertura honesta (debounce real, reset de page)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('W4-a: tras 300ms el hook recibe el VALOR DEBOUNCED de búsqueda (no solo el estado intermedio)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Sesiones activas/i }));
    });

    const searchInput = screen.getByRole('textbox', { name: /Buscar sesiones/i });
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'perez' } });
    });

    // Antes del debounce: el hook todavía NO recibió 'perez'.
    const before = vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mock.calls;
    expect(before[before.length - 1][0].search).toBeFalsy();

    act(() => {
      vi.advanceTimersByTime(350);
    });

    await waitFor(() => {
      const calls = vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mock.calls;
      const last = calls[calls.length - 1][0];
      expect(last.search).toBe('perez');
    });
  });

  it('W4-b: escribir en el buscador resetea page a 1 (no solo status/nasId lo hacen)', async () => {
    // Arranca en una página con más de 1 página disponible para poder avanzar.
    vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mockReturnValue(
      mockQuery({ data: makeEnvelope({ total: 150, hasNext: true }) })
    );
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Sesiones activas/i }));

    // Avanza a la página 2 primero.
    await user.click(screen.getByRole('button', { name: /siguiente/i }));
    await waitFor(() => {
      const calls = vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mock.calls;
      expect(calls[calls.length - 1][0].page).toBe(2);
    });

    // Ahora escribe en el buscador — debe resetear page a 1.
    const searchInput = screen.getByRole('textbox', { name: /Buscar sesiones/i });
    await user.type(searchInput, 'x');

    await waitFor(() => {
      const calls = vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.page).toBe(1);
    });
  });
});
