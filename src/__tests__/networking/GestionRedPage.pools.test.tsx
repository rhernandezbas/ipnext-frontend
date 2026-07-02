/**
 * GestionRedPage — Tab Pools IP (redesign FE-only)
 *
 * Cubre:
 *  P-1  Filtros FE: por NAS, tipo, ipKind (si disponible), texto debounced
 *  P-2  Grupos colapsables: toggle oculta/muestra filas; header siempre visible
 *  P-3  KPIs null-safe: assignedCount=null excluido del agregado; "N sin dato" mostrado
 *  P-4  All-null → KPIs muestran "—" (NoData)
 *  P-5  Orden por uso desc dentro del grupo; null al final
 *  P-6  NoData (—) en celda assignedCount cuando null; UsageBar no muestra barra
 *  P-7  ipKind: filtro se oculta cuando no hay datos de ipKind
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import GestionRedPage from '@/pages/networking/GestionRedPage';
import * as useRadiusSessionsModule from '@/hooks/useRadiusSessions';
import * as useNasModule from '@/hooks/useNas';
import * as useNetworkModule from '@/hooks/useNetwork';
import { mockQuery, mockMutation } from '@/__tests__/_utils/reactQueryMocks';
import type { IpPool } from '@/types/network';
import type { PaginatedRadiusSessions } from '@/types/radiusSessions';

// useMyPermissions y useConfirm ya vienen mockeados (permisivos) del setup global
// (src/test/setup.ts) — sus implementaciones de fábrica sobreviven a clearAllMocks().
vi.mock('@/hooks/useRadiusSessions');
vi.mock('@/hooks/useNas');
vi.mock('@/hooks/useNetwork');
vi.mock('@/pages/networking/PppoeManagementTab', () => ({
  PppoeManagementTab: () => <div>PPPoE stub</div>,
}));

// ── Helpers ────────────────────────────────────────────────────────────────────
const emptyEnvelope: PaginatedRadiusSessions = {
  data: [],
  total: 0,
  page: 1,
  limit: 50,
  hasNext: false,
  stats: { total: 0, active: 0, idle: 0 },
};

function makePool(overrides: Partial<IpPool> & Pick<IpPool, 'id'>): IpPool {
  return {
    id: overrides.id,
    name: overrides.name ?? `Pool ${overrides.id}`,
    networkId: 'net-1',
    rangeStart: overrides.rangeStart ?? '10.0.0.1',
    rangeEnd: overrides.rangeEnd ?? '10.0.0.254',
    type: overrides.type ?? 'dynamic',
    assignedCount: overrides.assignedCount !== undefined ? overrides.assignedCount : 10,
    totalCount: overrides.totalCount ?? 100,
    nasId: overrides.nasId ?? 'nas-1',
    ipKind: overrides.ipKind !== undefined ? overrides.ipKind : null,
  };
}

function defaultMocks(pools: IpPool[] = []) {
  vi.mocked(useRadiusSessionsModule.useRadiusSessionsPaginated).mockReturnValue(
    mockQuery({ data: emptyEnvelope })
  );
  vi.mocked(useNasModule.useNasServers).mockReturnValue(
    mockQuery({ data: [{ id: 'nas-1', name: 'Router Principal', type: 'radius_orchestrator', ipAddress: '10.75.0.1', nasIpAddress: '10.75.0.1', radiusSecret: '', apiPort: null, apiLogin: null, apiPassword: null, status: 'active', lastSeen: null, clientCount: 0, description: '', displayType: undefined }] })
  );
  vi.mocked(useNasModule.useCreateNasServer).mockReturnValue(mockMutation());
  vi.mocked(useNasModule.useUpdateNasServer).mockReturnValue(mockMutation());
  vi.mocked(useNasModule.useDeleteNasServer).mockReturnValue(mockMutation());
  vi.mocked(useNetworkModule.useIpNetworks).mockReturnValue(mockQuery({ data: [], isLoading: false }));
  vi.mocked(useNetworkModule.useCreateIpNetwork).mockReturnValue(mockMutation());
  vi.mocked(useNetworkModule.useDeleteIpNetwork).mockReturnValue(mockMutation());
  vi.mocked(useNetworkModule.useIpPools).mockReturnValue(mockQuery({ data: pools }));
  vi.mocked(useNetworkModule.useCreateIpPool).mockReturnValue(mockMutation());
  vi.mocked(useNetworkModule.useDeleteIpPool).mockReturnValue(mockMutation());
  vi.mocked(useNetworkModule.useIpAssignments).mockReturnValue(mockQuery({ data: { data: [], total: 0, page: 1, pageSize: 25 } }));
  vi.mocked(useNetworkModule.useIpv6Networks).mockReturnValue(mockQuery({ data: [] }));
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

async function goToPools() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Pools IP/i }));
  return user;
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('GestionRedPage — Tab Pools IP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('P-3: KPIs null-safe', () => {
    it('excluye assignedCount=null del total de asignadas', async () => {
      const pools = [
        makePool({ id: 'p1', assignedCount: 10, totalCount: 100 }),
        makePool({ id: 'p2', assignedCount: 20, totalCount: 100 }),
        makePool({ id: 'p3', assignedCount: null, totalCount: 100 }),
      ];
      defaultMocks(pools);
      renderPage();
      await goToPools();

      const kpiRegion = screen.getByRole('region', { name: /Totales de pools/i });
      // Asignadas = 10 + 20 = 30 (null excluido del agregado)
      expect(kpiRegion).toHaveTextContent('30');
      // IPs totales = 100 + 100 + 100 = 300 (totalCount NUNCA es null → siempre incluye todos)
      expect(kpiRegion).toHaveTextContent('300');
      // Libres = Σ (totalCount - assignedCount) SOLO sobre pools con dato (design D5):
      // (100-10) + (100-20) = 170. Las 100 IPs del pool null son DESCONOCIDAS, no libres —
      // 300-30=270 mentiría inflando las libres.
      expect(kpiRegion).toHaveTextContent('170');
      expect(kpiRegion).not.toHaveTextContent('270');
    });

    it('muestra badge "1 sin dato" cuando hay un pool sin dato', async () => {
      const pools = [
        makePool({ id: 'p1', assignedCount: 10, totalCount: 100 }),
        makePool({ id: 'p2', assignedCount: null, totalCount: 100 }),
      ];
      defaultMocks(pools);
      renderPage();
      await goToPools();

      const kpiRegion = screen.getByRole('region', { name: /Totales de pools/i });
      expect(kpiRegion).toHaveTextContent('Sin dato');
      expect(kpiRegion).toHaveTextContent('1');
    });
  });

  describe('P-4: all-null → KPIs muestran "—" (NoData)', () => {
    it('cuando todos los pools tienen assignedCount=null, asignadas y libres son NoData (—)', async () => {
      const pools = [
        makePool({ id: 'p1', assignedCount: null, totalCount: 100 }),
        makePool({ id: 'p2', assignedCount: null, totalCount: 100 }),
      ];
      defaultMocks(pools);
      renderPage();
      await goToPools();

      const kpiRegion = screen.getByRole('region', { name: /Totales de pools/i });
      // NoData renderiza "—" con aria-label="Sin dato"
      const nodataElements = within(kpiRegion).getAllByRole('img', { name: /Sin dato/i });
      // Hay al menos 2 NoData: uno para Asignadas y uno para Libres
      expect(nodataElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('P-5: orden por uso desc dentro del grupo; null al final', () => {
    it('ordena 100% > 90% > 50% > null', async () => {
      const pools = [
        makePool({ id: 'p1', name: 'Pool50', assignedCount: 50, totalCount: 100, nasId: 'nas-1' }),
        makePool({ id: 'p2', name: 'PoolNull', assignedCount: null, totalCount: 100, nasId: 'nas-1' }),
        makePool({ id: 'p3', name: 'Pool100', assignedCount: 100, totalCount: 100, nasId: 'nas-1' }),
        makePool({ id: 'p4', name: 'Pool90', assignedCount: 90, totalCount: 100, nasId: 'nas-1' }),
      ];
      defaultMocks(pools);
      renderPage();
      await goToPools();

      // El orden en el DOM: Pool100, Pool90, Pool50, PoolNull
      const cells = screen.getAllByRole('cell').filter(c => c.textContent?.startsWith('Pool'));
      const names = cells.map(c => c.textContent?.split('\n')[0]);
      const pool100Idx = names.findIndex(n => n?.includes('Pool100'));
      const pool90Idx = names.findIndex(n => n?.includes('Pool90'));
      const pool50Idx = names.findIndex(n => n?.includes('Pool50'));
      const poolNullIdx = names.findIndex(n => n?.includes('PoolNull'));

      expect(pool100Idx).toBeLessThan(pool90Idx);
      expect(pool90Idx).toBeLessThan(pool50Idx);
      expect(pool50Idx).toBeLessThan(poolNullIdx);
    });
  });

  describe('P-2: grupos colapsables', () => {
    it('toggle colapsa el grupo y las filas desaparecen; header permanece', async () => {
      const pools = [
        makePool({ id: 'p1', name: 'Pool A', nasId: 'nas-1' }),
        makePool({ id: 'p2', name: 'Pool B', nasId: 'nas-1' }),
      ];
      defaultMocks(pools);
      renderPage();
      await goToPools();

      // Los pools son visibles inicialmente
      expect(screen.getByText('Pool A')).toBeInTheDocument();
      expect(screen.getByText('Pool B')).toBeInTheDocument();

      // Colapsar el grupo
      const user = userEvent.setup();
      const toggleBtn = screen.getByRole('button', { name: /Colapsar grupo/i });
      await user.click(toggleBtn);

      // Las filas de pools ya no están visibles
      expect(screen.queryByText('Pool A')).not.toBeInTheDocument();
      expect(screen.queryByText('Pool B')).not.toBeInTheDocument();

      // El header del grupo sigue visible (el botón toggle está presente)
      expect(screen.getByRole('button', { name: /Expandir grupo/i })).toBeInTheDocument();
    });

    it('re-expandir muestra las filas de nuevo', async () => {
      const pools = [makePool({ id: 'p1', name: 'Pool A', nasId: 'nas-1' })];
      defaultMocks(pools);
      renderPage();
      const user = await goToPools();

      const toggleBtn = screen.getByRole('button', { name: /Colapsar grupo/i });
      await user.click(toggleBtn); // colapsar
      await user.click(screen.getByRole('button', { name: /Expandir grupo/i })); // expandir
      expect(screen.getByText('Pool A')).toBeInTheDocument();
    });
  });

  describe('P-6: NoData en fila con assignedCount=null', () => {
    it('renderiza "—" con role=img y aria-label="Sin dato"', async () => {
      const pools = [makePool({ id: 'p1', assignedCount: null, totalCount: 100 })];
      defaultMocks(pools);
      renderPage();
      await goToPools();

      const nodataElements = screen.getAllByRole('img', { name: /Sin dato/i });
      expect(nodataElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('P-7: ipKind filtro defensivo', () => {
    it('NO muestra el filtro ipKind cuando ningún pool tiene ipKind definido', async () => {
      const pools = [makePool({ id: 'p1', ipKind: null })];
      defaultMocks(pools);
      renderPage();
      await goToPools();

      expect(screen.queryByRole('combobox', { name: /Filtrar por tipo de IP/i })).not.toBeInTheDocument();
    });

    it('SÍ muestra el filtro ipKind cuando al menos un pool tiene ipKind', async () => {
      const pools = [
        makePool({ id: 'p1', ipKind: 'cgnat' }),
        makePool({ id: 'p2', ipKind: null }),
      ];
      defaultMocks(pools);
      renderPage();
      await goToPools();

      expect(screen.getByRole('combobox', { name: /Filtrar por tipo de IP/i })).toBeInTheDocument();
    });
  });

  describe('P-1: filtros FE', () => {
    it('filtro por tipo muestra solo pools del tipo seleccionado', async () => {
      const pools = [
        makePool({ id: 'p1', name: 'Pool Dinámico', type: 'dynamic' }),
        makePool({ id: 'p2', name: 'Pool Estático', type: 'static' }),
      ];
      defaultMocks(pools);
      renderPage();
      const user = await goToPools();

      const typeSelect = screen.getByRole('combobox', { name: /Filtrar por tipo/i });
      await user.selectOptions(typeSelect, 'dynamic');

      expect(screen.getByText('Pool Dinámico')).toBeInTheDocument();
      expect(screen.queryByText('Pool Estático')).not.toBeInTheDocument();
    });

    it('filtro por NAS muestra solo pools de ese NAS', async () => {
      const pools = [
        makePool({ id: 'p1', name: 'Pool NAS1', nasId: 'nas-1' }),
        makePool({ id: 'p2', name: 'Pool NAS2', nasId: 'nas-2' }),
      ];
      defaultMocks(pools);
      renderPage();
      const user = await goToPools();

      const nasSelect = screen.getByRole('combobox', { name: /Filtrar por router/i });
      await user.selectOptions(nasSelect, 'nas-1');

      expect(screen.getByText('Pool NAS1')).toBeInTheDocument();
      expect(screen.queryByText('Pool NAS2')).not.toBeInTheDocument();
    });

    it('empty state cuando filtros dejan 0 resultados', async () => {
      const pools = [makePool({ id: 'p1', name: 'Pool A', type: 'dynamic' })];
      defaultMocks(pools);
      renderPage();
      const user = await goToPools();

      const typeSelect = screen.getByRole('combobox', { name: /Filtrar por tipo/i });
      await user.selectOptions(typeSelect, 'static'); // no hay estáticos

      expect(screen.getByText(/Sin pools para los filtros seleccionados/i)).toBeInTheDocument();
    });
  });
});
