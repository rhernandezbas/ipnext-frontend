/**
 * RecentBajasTab — worklist de bajas recientes (actions-worklist F2).
 *
 *  RBT-1 fila: cliente como link a la ficha + dirección + inicio + motivo
 *  RBT-2 badge retiro: exists → "Orden de retiro ✓" (verde)
 *  RBT-3 badge retiro: sin orden con equipos activos → "Sin orden — N equipos" (alarma)
 *  RBT-4 badge retiro: sin orden y 0 equipos → "Sin orden" (neutro)
 *  RBT-5 paginación → query con la página pedida
 *  RBT-6 estados: vacío / error
 *  RBT-7 M3: el total se achica y la página queda fuera → clamp a la última real
 *  (No se muestra fecha de baja: el DTO no la tiene — limitación aceptada.)
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';
import type { RecentBajaDto, RecentBajasQuery } from '@/types/actions';

vi.mock('@/hooks/useActions', () => ({
  useRecentBajas: vi.fn(),
}));

import { useRecentBajas } from '@/hooks/useActions';
import { RecentBajasTab } from '@/pages/customers/AccionesPage/components/RecentBajasTab';

const baja = (over: Partial<RecentBajaDto>): RecentBajaDto => ({
  contractId: 'ct-1',
  clientId: 'cl-1',
  clientName: 'Pedro Baja',
  address: 'Calle Falsa 123',
  startDate: '2024-03-01',
  motivoBaja: 'MUDANZA',
  retirementOrder: { exists: false },
  activeEquipmentCount: 0,
  ...over,
});

let capturedQueries: RecentBajasQuery[];

function mockBajas(items: RecentBajaDto[], opts?: { total?: number; isError?: boolean }) {
  capturedQueries = [];
  vi.mocked(useRecentBajas).mockImplementation((q: RecentBajasQuery) => {
    capturedQueries.push(q);
    return mockQuery({
      data: opts?.isError
        ? undefined
        : { items, total: opts?.total ?? items.length, page: q.page ?? 1, pageSize: 25 },
      isError: opts?.isError ?? false,
    }) as never;
  });
}

function renderTab() {
  return render(
    <MemoryRouter>
      <RecentBajasTab />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RBT-1: fila de baja', () => {
  it('cliente linkea a la ficha; dirección, inicio y motivo visibles', () => {
    mockBajas([baja({})]);
    renderTab();

    const link = screen.getByRole('link', { name: /pedro baja/i });
    expect(link).toHaveAttribute('href', '/admin/customers/cl-1');
    expect(screen.getByText('Calle Falsa 123')).toBeInTheDocument();
    expect(screen.getByText(/01 mar 2024/i)).toBeInTheDocument();
    expect(screen.getByText('MUDANZA')).toBeInTheDocument();
  });
});

describe('RBT-2/3/4: badge del retiro-check', () => {
  it('con orden de retiro → badge verde con tilde', () => {
    mockBajas([baja({ retirementOrder: { exists: true, taskId: 'task-9' } })]);
    renderTab();
    expect(screen.getByText(/orden de retiro ✓/i)).toBeInTheDocument();
  });

  it('sin orden y con equipos activos → alarma con el conteo', () => {
    mockBajas([baja({ retirementOrder: { exists: false }, activeEquipmentCount: 2 })]);
    renderTab();
    expect(screen.getByText(/sin orden — 2 equipos/i)).toBeInTheDocument();
  });

  it('sin orden y con 1 equipo activo → singular', () => {
    mockBajas([baja({ retirementOrder: { exists: false }, activeEquipmentCount: 1 })]);
    renderTab();
    expect(screen.getByText(/sin orden — 1 equipo$/i)).toBeInTheDocument();
  });

  it('sin orden y sin equipos → neutro', () => {
    mockBajas([baja({ retirementOrder: { exists: false }, activeEquipmentCount: 0 })]);
    renderTab();
    expect(screen.getByText(/^sin orden$/i)).toBeInTheDocument();
  });
});

describe('RBT-5: paginación', () => {
  it('click en la página 2 → query {page: 2, pageSize: 25}', async () => {
    const user = userEvent.setup();
    mockBajas([baja({})], { total: 60 });
    renderTab();

    await user.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      expect(capturedQueries.at(-1)).toEqual({ page: 2, pageSize: 25 });
    });
  });
});

describe('RBT-7: clamp de página tras shrink del total (M3)', () => {
  it('en página 2 y el total cae a 1 página → re-consulta la última página real', async () => {
    const user = userEvent.setup();
    const state = { total: 60 };
    capturedQueries = [];
    vi.mocked(useRecentBajas).mockImplementation((q: RecentBajasQuery) => {
      capturedQueries.push(q);
      return mockQuery({
        data: {
          items: (q.page ?? 1) === 1 ? [baja({})] : [],
          total: state.total,
          page: q.page ?? 1,
          pageSize: 25,
        },
      }) as never;
    });
    renderTab();

    // El dataset se achica ANTES de navegar: la página 2 ya no existe.
    state.total = 10;
    await user.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      expect(capturedQueries.at(-1)).toEqual({ page: 1, pageSize: 25 });
    });
    // La fila sigue visible — nada de tabla vacía con 10 bajas reales.
    expect(screen.getByRole('link', { name: /pedro baja/i })).toBeInTheDocument();
  });
});

describe('RBT-6: estados', () => {
  it('vacío → mensaje', () => {
    mockBajas([]);
    renderTab();
    expect(screen.getByText(/no hay bajas recientes/i)).toBeInTheDocument();
  });

  it('error → alerta', () => {
    mockBajas([], { isError: true });
    renderTab();
    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudieron cargar/i);
  });
});
