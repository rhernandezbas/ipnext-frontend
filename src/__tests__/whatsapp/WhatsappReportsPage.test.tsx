/**
 * WhatsappReportsPage — dashboard de Informes (Ola 3). Integración: orquesta los
 * 3 hooks de `useMessagingReports` (acá mockeados para verificar el WIRING) y las
 * 4 ramas de estado por fetch (loading / empty / error+retry / success), el
 * selector de rango (refetch al cambiar) y el gate de permiso.
 */
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useMessagingReports');

import * as reportsHooks from '@/hooks/useMessagingReports';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { RequirePermission } from '@/components/auth/RequirePermission';
import { mockQuery, type QueryOverrides } from '@/__tests__/_utils/reactQueryMocks';
import WhatsappReportsPage from '@/pages/whatsapp/WhatsappReportsPage/WhatsappReportsPage';
import { DAY_MS } from '@/pages/whatsapp/WhatsappReportsPage/lib/range';
import type {
  ReportsOverview,
  ReportsResolutions,
  ReportsTraffic,
} from '@/types/messagingReports';

const OVERVIEW: ReportsOverview = {
  resolvedInRange: 42,
  createdInRange: 55,
  currentOpen: 7,
  currentUnattended: 3,
  currentUnassigned: 4,
  currentPending: 2,
};
const TRAFFIC: ReportsTraffic = {
  timezone: 'America/Argentina/Buenos_Aires',
  cells: [{ dow: 1, hour: 14, count: 10 }],
};
const RESOLUTIONS: ReportsResolutions = {
  timezone: 'America/Argentina/Buenos_Aires',
  days: [{ date: '2026-07-18', count: 5 }],
};

function setHooks(over: {
  overview?: QueryOverrides<ReportsOverview>;
  traffic?: QueryOverrides<ReportsTraffic>;
  resolutions?: QueryOverrides<ReportsResolutions>;
} = {}) {
  vi.mocked(reportsHooks.useReportsOverview).mockReturnValue(
    mockQuery<ReportsOverview>({ data: OVERVIEW, ...over.overview }),
  );
  vi.mocked(reportsHooks.useReportsTraffic).mockReturnValue(
    mockQuery<ReportsTraffic>({ data: TRAFFIC, ...over.traffic }),
  );
  vi.mocked(reportsHooks.useReportsResolutions).mockReturnValue(
    mockQuery<ReportsResolutions>({ data: RESOLUTIONS, ...over.resolutions }),
  );
}

function renderPage() {
  return render(
    <MemoryRouter>
      <WhatsappReportsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setHooks();
});

describe('WhatsappReportsPage — header + éxito', () => {
  it('renderiza el breadcrumb y el título', () => {
    renderPage();
    expect(screen.getByText('WhatsApp /')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /informes/i, level: 1 })).toBeInTheDocument();
  });

  it('los tiles muestran los current* y resueltas/creadas', () => {
    renderPage();
    expect(screen.getByTestId('tile-currentOpen')).toHaveTextContent('7');
    expect(screen.getByTestId('tile-currentUnattended')).toHaveTextContent('3');
    expect(screen.getByTestId('tile-currentUnassigned')).toHaveTextContent('4');
    expect(screen.getByTestId('tile-currentPending')).toHaveTextContent('2');
    expect(screen.getByTestId('tile-resolvedInRange')).toHaveTextContent('42');
    expect(screen.getByTestId('tile-createdInRange')).toHaveTextContent('55');
  });

  it('renderiza el heatmap y las barras de resoluciones', () => {
    renderPage();
    expect(screen.getByRole('table', { name: /tráfico/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/lunes 14:00/i).dataset.level).toBe('5');
    expect(screen.getAllByTestId('resolution-bar').length).toBeGreaterThan(0);
  });
});

describe('WhatsappReportsPage — ramas de estado', () => {
  it('loading: muestra skeletons mientras cargan los fetches', () => {
    setHooks({
      overview: { data: undefined, isLoading: true, isSuccess: false },
      traffic: { data: undefined, isLoading: true, isSuccess: false },
      resolutions: { data: undefined, isLoading: true, isSuccess: false },
    });
    renderPage();
    expect(screen.getAllByTestId('reports-skeleton')).toHaveLength(3);
  });

  it('error: cada fetch fallido muestra alert reintentable y el retry llama refetch', () => {
    const refetch = vi.fn();
    setHooks({
      overview: { data: undefined, isError: true, isSuccess: false, refetch },
    });
    renderPage();
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    fireEvent.click(within(alert).getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('empty: traffic/resolutions vacíos muestran "sin datos en el rango"', () => {
    setHooks({
      traffic: { data: { timezone: 'America/Argentina/Buenos_Aires', cells: [] } },
      resolutions: { data: { timezone: 'America/Argentina/Buenos_Aires', days: [] } },
    });
    renderPage();
    expect(screen.getByText(/sin tráfico en el rango/i)).toBeInTheDocument();
    expect(screen.getByText(/sin resoluciones en el rango/i)).toBeInTheDocument();
  });
});

describe('WhatsappReportsPage — selector de rango', () => {
  it('cambiar a "Últimos 30 días" refetchea con un rango de 30 días', () => {
    renderPage();
    // rango inicial = 7 días
    const first = vi.mocked(reportsHooks.useReportsOverview).mock.calls.at(-1)![0];
    expect(new Date(first.to).getTime() - new Date(first.from).getTime()).toBe(7 * DAY_MS);

    fireEvent.click(screen.getByRole('button', { name: /últimos 30 días/i }));

    const last = vi.mocked(reportsHooks.useReportsOverview).mock.calls.at(-1)![0];
    expect(new Date(last.to).getTime() - new Date(last.from).getTime()).toBe(30 * DAY_MS);
    // los 3 fetches reciben el MISMO rango nuevo (refetch coordinado)
    const traffic = vi.mocked(reportsHooks.useReportsTraffic).mock.calls.at(-1)![0];
    expect(traffic).toEqual(last);
  });
});

describe('WhatsappReportsPage — permiso', () => {
  it('sin messaging.read no se ve la página (gate de ruta)', () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      user: null,
      roles: [],
      permissions: [],
      isLoading: false,
      isError: false,
      can: () => false,
    });
    render(
      <MemoryRouter>
        <RequirePermission permission="messaging.read">
          <WhatsappReportsPage />
        </RequirePermission>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: /no tenés permisos/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /informes/i, level: 1 })).not.toBeInTheDocument();
  });
});
