/**
 * AlertsPage (Fase C FE, change `noc-alerts-hub`) — panel de alertas NOC.
 * spec.md `noc-alert-realtime`, Requirement "Alerts panel with filters and ACK".
 *
 *  ALP-1 loading  → skeleton (role="status")
 *  ALP-2 error    → role="alert" + botón reintentar que vuelve a pedir la lista
 *  ALP-3 empty    → sin alertas que matcheen los filtros → mensaje + CTA "limpiar filtros"
 *  ALP-4 success  → 4 estados son mutuamente excluyentes; lista renderiza
 *  ALP-5 filtros combinables (fuente/severidad/estado) narrowean la lista, Select propio
 *  ALP-6 severidad: badge dot + TEXTO (nunca solo color)
 *  ALP-7 ACK: oculto sin monitoring.acknowledge_alert; con permiso abre
 *         ConfirmModal, solo pega el POST al confirmar
 *  ALP-8 aria-live en el contador de alertas
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { NocAlertDto } from '@/types/nocAlert';

vi.mock('@/hooks/useNocAlerts', () => ({
  useNocAlertsList: vi.fn(),
  useAcknowledgeNocAlert: vi.fn(),
  useNocAlertsStream: vi.fn(),
  nocAlertsKey: ['nocAlerts', 'list'],
}));

import AlertsPage from '@/pages/alerts/AlertsPage';
import {
  useNocAlertsList,
  useAcknowledgeNocAlert,
  useNocAlertsStream,
} from '@/hooks/useNocAlerts';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';

function makeAlert(overrides: Partial<NocAlertDto> = {}): NocAlertDto {
  return {
    id: 'alert-1',
    source: 'grafana',
    alertname: 'HighLatency',
    severity: 'critical',
    status: 'firing',
    entityType: 'nas',
    entityName: 'NAS-Central-01',
    entityRef: null,
    metricName: 'latency',
    metricValue: 250,
    metricUnit: 'ms',
    threshold: 100,
    message: 'Latencia alta sostenida',
    explanation: null,
    link: null,
    startsAt: '2026-07-24T10:00:00.000Z',
    endsAt: null,
    createdAt: '2026-07-24T10:00:00.000Z',
    updatedAt: '2026-07-24T10:00:00.000Z',
    acknowledged: false,
    ackBy: null,
    ackAt: null,
    ackNote: null,
    mttaSeconds: null,
    ...overrides,
  };
}

const mockAckMutate = vi.fn();

function mockList(partial: Partial<ReturnType<typeof useNocAlertsList>>) {
  vi.mocked(useNocAlertsList).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...partial,
  } as unknown as ReturnType<typeof useNocAlertsList>);
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      {/* MemoryRouter — change `noc-alerts-config` Fase F FE agrega un <Link> a
          "/admin/alerts/config" en el header (molde: los ~12 archivos que renderizan
          <Sidebar/> ya necesitaban esto por sus NavLink). */}
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useNocAlertsStream).mockReturnValue('live');
  vi.mocked(useAcknowledgeNocAlert).mockReturnValue({
    mutate: mockAckMutate,
    isPending: false,
    isError: false,
    isSuccess: false,
  } as unknown as ReturnType<typeof useAcknowledgeNocAlert>);
});

describe('ALP-1 loading', () => {
  it('shows a skeleton while the list is loading', () => {
    mockList({ isLoading: true, data: undefined });
    renderPage();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('ALP-2 error', () => {
  it('shows role=alert with a retry that refetches', async () => {
    const refetch = vi.fn();
    mockList({ isError: true, isLoading: false, data: undefined, refetch });
    renderPage();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

describe('ALP-3 empty', () => {
  it('shows an explanatory empty state with no alerts at all', () => {
    mockList({ data: [], isLoading: false, isError: false });
    renderPage();
    expect(screen.getByText(/no hay alertas/i)).toBeInTheDocument();
  });

  it('shows "limpiar filtros" CTA when filters narrow to zero results', async () => {
    mockList({ data: [makeAlert({ source: 'grafana' })], isLoading: false, isError: false });
    renderPage();

    const sourceSelect = screen.getByRole('combobox', { name: /fuente/i });
    await userEvent.click(sourceSelect);
    await userEvent.click(screen.getByRole('option', { name: 'fiber-collector' }));

    expect(screen.getByText(/ninguna alerta coincide/i)).toBeInTheDocument();
    // Aparece 2 veces (atajo junto a los filtros + CTA explícita del empty state) — ambas son intencionales.
    expect(screen.getAllByRole('button', { name: /limpiar filtros/i }).length).toBeGreaterThan(0);
  });
});

describe('ALP-4/5/6 success', () => {
  it('renders the list, one item per alert, mutually exclusive with other states', () => {
    mockList({
      data: [
        makeAlert({ id: 'a1', alertname: 'HighLatency' }),
        makeAlert({ id: 'a2', alertname: 'PacketLoss', severity: 'warning', status: 'resolved' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    expect(screen.queryByRole('status', { name: /cargando/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('HighLatency')).toBeInTheDocument();
    expect(screen.getByText('PacketLoss')).toBeInTheDocument();
  });

  it('severity badge shows a visible TEXT label, not only a color dot', () => {
    mockList({ data: [makeAlert({ severity: 'critical' })], isLoading: false, isError: false });
    renderPage();
    expect(screen.getByText(/cr[ií]tica/i)).toBeInTheDocument();
  });

  it('filters combine (source + severity + status) to narrow the list', async () => {
    mockList({
      data: [
        makeAlert({ id: 'a1', source: 'grafana', severity: 'critical', status: 'firing', alertname: 'AlertGrafana' }),
        makeAlert({ id: 'a2', source: 'fiber-collector', severity: 'warning', status: 'resolved', alertname: 'AlertFiber' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    expect(screen.getByText('AlertGrafana')).toBeInTheDocument();
    expect(screen.getByText('AlertFiber')).toBeInTheDocument();

    const severitySelect = screen.getByRole('combobox', { name: /severidad/i });
    await userEvent.click(severitySelect);
    await userEvent.click(screen.getByRole('option', { name: /cr[ií]tica/i }));

    expect(screen.getByText('AlertGrafana')).toBeInTheDocument();
    expect(screen.queryByText('AlertFiber')).not.toBeInTheDocument();
  });
});

describe('ALP-7 ACK gating + confirmation', () => {
  it('hides the ACK action without monitoring.acknowledge_alert', () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      user: null,
      roles: [],
      permissions: ['monitoring.read'],
      isLoading: false,
      isError: false,
      can: (p: string | string[]) => {
        const list = Array.isArray(p) ? p : [p];
        return list.includes('monitoring.read');
      },
    } as UseMyPermissionsResult);

    mockList({ data: [makeAlert()], isLoading: false, isError: false });
    renderPage();

    expect(screen.queryByRole('button', { name: /reconocer/i })).not.toBeInTheDocument();
  });

  it('with permission: opens ConfirmModal and only POSTs on confirm', async () => {
    vi.mocked(useMyPermissions).mockReturnValue({
      user: null,
      roles: [],
      permissions: ['monitoring.read', 'monitoring.acknowledge_alert'],
      isLoading: false,
      isError: false,
      can: () => true,
    } as UseMyPermissionsResult);

    mockList({ data: [makeAlert({ id: 'a1' })], isLoading: false, isError: false });
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /reconocer/i }));
    // ConfirmModal open — the mutation must NOT have fired yet.
    expect(mockAckMutate).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /confirmar/i }));

    expect(mockAckMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1' }),
      expect.anything(),
    );
  });
});

describe('ALP-8 accessibility', () => {
  it('exposes an aria-live counter for the alert list', () => {
    mockList({ data: [makeAlert()], isLoading: false, isError: false });
    renderPage();
    const live = document.querySelector('[aria-live]');
    expect(live).not.toBeNull();
  });
});
