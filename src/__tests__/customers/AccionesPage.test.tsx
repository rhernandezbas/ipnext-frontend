/**
 * AccionesPage — page del worklist (actions-worklist F2).
 *
 *  APG-1 render: título + 2 tabs; el contador del tab suma pending + ambiguous
 *        (ambos requieren acción del operador)
 *  APG-2 tab titularidad: cards de caso visibles
 *  APG-3 tab bajas es lazy: no montado hasta activarlo; al click aparece
 *  APG-4 filtro por status → cambia el query (page reset a 1)
 *  APG-5 estados: loading / vacío / error del tab titularidad
 *  APG-6 paginación: total > pageSize → nav visible; click → query con page 2
 *  APG-7 M3: el total se achica y la página actual queda fuera → clamp a la
 *        última página real (nada de empty-state mentiroso)
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { mockMutation, mockQuery } from '@/__tests__/_utils/reactQueryMocks';
import type { OwnershipCaseDto, RecentBajaDto, OwnershipCasesQuery } from '@/types/actions';

vi.mock('@/hooks/useActions', () => ({
  useOwnershipCases: vi.fn(),
  useRecentBajas: vi.fn(),
  useUpdateOwnershipCase: vi.fn(),
}));

import { useOwnershipCases, useRecentBajas, useUpdateOwnershipCase } from '@/hooks/useActions';
import AccionesPage from '@/pages/customers/AccionesPage';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CASE: OwnershipCaseDto = {
  id: 'case-1',
  status: 'pending',
  sourceContractId: 'ct-old',
  sourceClientId: 'cl-old',
  sourceClientName: 'Juan Viejo',
  motivoBaja: 'CAMBIO DE TITULARIDAD',
  bajaDate: null,
  targetContractId: 'ct-new',
  targetClientId: 'cl-new',
  targetClientName: 'María Nueva',
  candidates: null,
  dismissReason: null,
  checks: {
    tv: 'pending',
    pppoe: 'pending',
    equipment: { sourceActive: 1, targetActive: 0, reviewed: false, reviewedAt: null, reviewedByName: null },
  },
  detectedAt: '2026-07-08T10:00:00Z',
  updatedAt: '2026-07-08T10:00:00Z',
};

const BAJA: RecentBajaDto = {
  contractId: 'ct-baja',
  clientId: 'cl-baja',
  clientName: 'Pedro Baja',
  address: 'Calle Falsa 123',
  startDate: '2024-03-01',
  motivoBaja: 'MUDANZA',
  retirementOrder: { exists: false },
  activeEquipmentCount: 2,
};

let capturedListQueries: OwnershipCasesQuery[];

function mockCases(opts?: {
  items?: OwnershipCaseDto[];
  total?: number;
  pendingTotal?: number;
  ambiguousTotal?: number;
  isLoading?: boolean;
  isError?: boolean;
}) {
  capturedListQueries = [];
  vi.mocked(useOwnershipCases).mockImplementation((q: OwnershipCasesQuery) => {
    // El contador del page usa pageSize 1 (solo interesa total) — una query
    // por estado accionable: pending y ambiguous.
    if (q.pageSize === 1) {
      return mockQuery({
        data: {
          items: [],
          total: q.status === 'ambiguous' ? (opts?.ambiguousTotal ?? 0) : (opts?.pendingTotal ?? 0),
          page: 1,
          pageSize: 1,
        },
      }) as never;
    }
    capturedListQueries.push(q);
    return mockQuery({
      data: opts?.isLoading || opts?.isError
        ? undefined
        : { items: opts?.items ?? [], total: opts?.total ?? (opts?.items?.length ?? 0), page: q.page ?? 1, pageSize: 25 },
      isLoading: opts?.isLoading ?? false,
      isError: opts?.isError ?? false,
    }) as never;
  });
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AccionesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCases({ items: [CASE], total: 1, pendingTotal: 3, ambiguousTotal: 2 });
  vi.mocked(useRecentBajas).mockReturnValue(
    mockQuery({ data: { items: [BAJA], total: 1, page: 1, pageSize: 25 } }) as never,
  );
  vi.mocked(useUpdateOwnershipCase).mockReturnValue(
    mockMutation({ mutateAsync: vi.fn().mockResolvedValue(CASE) }) as never,
  );
});

describe('APG-1: estructura de la page', () => {
  it('renderiza el título y los 2 tabs; el contador suma pending + ambiguous', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /acciones/i })).toBeInTheDocument();
    // 3 pending + 2 ambiguous = 5 casos que requieren acción.
    expect(screen.getByRole('tab', { name: /cambios de titular \(5\)/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /bajas recientes/i })).toBeInTheDocument();
  });
});

describe('APG-2: tab titularidad', () => {
  it('muestra las cards de caso', () => {
    renderPage();
    expect(screen.getByText('Juan Viejo')).toBeInTheDocument();
    expect(screen.getByText('María Nueva')).toBeInTheDocument();
  });
});

describe('APG-3: tab bajas lazy', () => {
  it('no monta el tab de bajas hasta activarlo', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByText('Pedro Baja')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /bajas recientes/i }));
    expect(await screen.findByText('Pedro Baja')).toBeInTheDocument();
  });
});

describe('APG-4: filtro por status', () => {
  it('click en un pill de estado → query con ese status', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /^pendientes$/i }));

    await waitFor(() => {
      expect(capturedListQueries.at(-1)).toEqual({ status: 'pending', page: 1, pageSize: 25 });
    });
  });
});

describe('APG-5: estados del tab', () => {
  it('vacío → mensaje de vacío', () => {
    mockCases({ items: [], total: 0 });
    renderPage();
    expect(screen.getByText(/no hay casos/i)).toBeInTheDocument();
  });

  it('loading → indicador visible', () => {
    mockCases({ isLoading: true });
    renderPage();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('error → alerta visible', () => {
    mockCases({ isError: true });
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudieron cargar/i);
  });
});

describe('APG-6: paginación', () => {
  it('total > pageSize → nav de páginas; click 2 → query page 2', async () => {
    const user = userEvent.setup();
    mockCases({ items: [CASE], total: 60, pendingTotal: 3 });
    renderPage();

    const nav = screen.getByRole('navigation', { name: /paginación/i });
    expect(nav).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      expect(capturedListQueries.at(-1)).toEqual({ page: 2, pageSize: 25 });
    });
  });
});

describe('APG-7: clamp de página tras shrink del total (M3)', () => {
  it('en página 2 y el total cae a 1 página → re-consulta la última página real', async () => {
    const user = userEvent.setup();
    const state = { total: 60 };
    capturedListQueries = [];
    vi.mocked(useOwnershipCases).mockImplementation((q: OwnershipCasesQuery) => {
      if (q.pageSize === 1) {
        return mockQuery({ data: { items: [], total: 0, page: 1, pageSize: 1 } }) as never;
      }
      capturedListQueries.push(q);
      return mockQuery({
        data: {
          // Con el dataset achicado, la página 2 viene vacía — el clamp evita
          // quedarse mirando ese empty-state mentiroso.
          items: (q.page ?? 1) === 1 ? [CASE] : [],
          total: state.total,
          page: q.page ?? 1,
          pageSize: 25,
        },
      }) as never;
    });
    renderPage();

    // El dataset se achica (flip a done) ANTES de navegar: la página 2 ya no existe.
    state.total = 10;
    await user.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      expect(capturedListQueries.at(-1)).toEqual({ page: 1, pageSize: 25 });
    });
    // La card sigue visible — nada de "No hay casos" con 10 casos reales.
    expect(screen.getByText('Juan Viejo')).toBeInTheDocument();
  });
});
