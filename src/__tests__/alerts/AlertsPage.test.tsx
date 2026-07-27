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
    // Scoped a la LISTA — change `noc-alerts-dashboard` agregó un resumen arriba
    // que también puede mostrar "HighLatency" (top incidencias), así que un
    // `getByText` sin scope encontraría 2 coincidencias legítimas.
    const list = screen.getByRole('list', { name: /lista de alertas/i });
    expect(within(list).getByText('HighLatency')).toBeInTheDocument();
    expect(within(list).getByText('PacketLoss')).toBeInTheDocument();
  });

  it('severity badge shows a visible TEXT label, not only a color dot', () => {
    mockList({ data: [makeAlert({ severity: 'critical' })], isLoading: false, isError: false });
    renderPage();
    const list = screen.getByRole('list', { name: /lista de alertas/i });
    expect(within(list).getByText(/cr[ií]tica/i)).toBeInTheDocument();
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

    const list = screen.getByRole('list', { name: /lista de alertas/i });
    expect(within(list).getByText('AlertGrafana')).toBeInTheDocument();
    expect(within(list).getByText('AlertFiber')).toBeInTheDocument();

    const severitySelect = screen.getByRole('combobox', { name: /severidad/i });
    await userEvent.click(severitySelect);
    await userEvent.click(screen.getByRole('option', { name: /cr[ií]tica/i }));

    expect(within(list).getByText('AlertGrafana')).toBeInTheDocument();
    expect(within(list).queryByText('AlertFiber')).not.toBeInTheDocument();
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

/**
 * ALP-9..12 — resumen indicativo por severidad/tipo (change
 * `noc-alerts-dashboard`). Decisión de diseño clave: los tiles/breakdown son
 * un recuento GLOBAL de alertas ACTIVAS (`status === 'firing'`), NO afectado
 * por los filtros de la lista — así una crítica nunca "desaparece" del
 * resumen solo porque el operario filtró por otra cosa (ese es justo el
 * problema real: 16 críticas enterradas entre 400 alertas). El texto
 * "N alertas visibles" (ya existente) sigue reflejando la lista FILTRADA, y
 * el resumen se etiqueta explícitamente como global para que ambos números
 * conviviendo en pantalla no se lean como una contradicción.
 */
// Las 3 severidades viven en un role="group" DEDICADO (aria-label "por
// severidad") — separado del <ul role="list"> de la lista de abajo y del
// breakdown por tipo, que TAMBIÉN son botones y también pueden decir
// "Crítica"/"Advertencia" (el badge dentro de cada fila del breakdown).
// Module-scoped (no solo de ALP-9) — la reusan A2/A4 más abajo.
function getSeverityGroup() {
  const summary = screen.getByRole('region', { name: /resumen/i });
  return within(summary).getByRole('group', { name: /por severidad/i });
}

describe('ALP-9 severity summary tiles (global, unaffected by list filters)', () => {
  it('counts ONLY active (firing) alerts by severity, ignoring resolved ones', () => {
    mockList({
      data: [
        makeAlert({ id: 'a1', severity: 'critical', status: 'firing' }),
        makeAlert({ id: 'a2', severity: 'critical', status: 'firing' }),
        makeAlert({ id: 'a3', severity: 'warning', status: 'firing' }),
        makeAlert({ id: 'a4', severity: 'info', status: 'firing' }),
        makeAlert({ id: 'a5', severity: 'info', status: 'resolved' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const group = getSeverityGroup();
    const critical = within(group).getByRole('button', { name: /cr[ií]tica/i });
    const warning = within(group).getByRole('button', { name: /advertencia/i });
    const info = within(group).getByRole('button', { name: /^info/i });

    expect(within(critical).getByText('2')).toBeInTheDocument();
    expect(within(warning).getByText('1')).toBeInTheDocument();
    expect(within(info).getByText('1')).toBeInTheDocument();
  });

  it('stays GLOBAL when the list filters narrow the visible list down', async () => {
    mockList({
      data: [
        makeAlert({ id: 'a1', severity: 'critical', status: 'firing', source: 'fiber-collector' }),
        makeAlert({ id: 'a2', severity: 'critical', status: 'firing', source: 'grafana' }),
        makeAlert({ id: 'a3', severity: 'warning', status: 'firing', source: 'grafana' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const criticalBefore = within(getSeverityGroup()).getByRole('button', { name: /cr[ií]tica/i });
    expect(within(criticalBefore).getByText('2')).toBeInTheDocument();

    const sourceSelect = screen.getByRole('combobox', { name: /fuente/i });
    await userEvent.click(sourceSelect);
    await userEvent.click(screen.getByRole('option', { name: 'Grafana' }));

    // La lista de abajo ahora muestra solo 2 (grafana) — el resumen sigue en 2 críticas GLOBAL.
    const criticalAfter = within(getSeverityGroup()).getByRole('button', { name: /cr[ií]tica/i });
    expect(within(criticalAfter).getByText('2')).toBeInTheDocument();
  });

  it('clicking a severity tile toggles the severity filter on the visible list (aria-pressed)', async () => {
    mockList({
      data: [
        makeAlert({ id: 'a1', severity: 'critical', status: 'firing', alertname: 'AlertCrit' }),
        makeAlert({ id: 'a2', severity: 'warning', status: 'firing', alertname: 'AlertWarn' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const criticalTile = within(getSeverityGroup()).getByRole('button', { name: /cr[ií]tica/i });
    expect(criticalTile).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(criticalTile);

    // Scoped a la LISTA: el breakdown (resumen) es GLOBAL y sigue mostrando
    // "AlertWarn" aunque la LISTA de abajo ya la haya filtrado afuera.
    const list = screen.getByRole('list', { name: /lista de alertas/i });
    expect(within(list).getByText('AlertCrit')).toBeInTheDocument();
    expect(within(list).queryByText('AlertWarn')).not.toBeInTheDocument();
    expect(criticalTile).toHaveAttribute('aria-pressed', 'true');

    // click again → toggles OFF, la lista vuelve a mostrar ambas
    await userEvent.click(criticalTile);
    expect(within(list).getByText('AlertWarn')).toBeInTheDocument();
    expect(criticalTile).toHaveAttribute('aria-pressed', 'false');
  });

  /**
   * A2 (review adversarial): el tile decía "2" pero clickearlo mostraba
   * "5 alertas visibles" — `toggleSeverityFilter` seteaba `severity` pero NO
   * `status`, y el default de `status` es '' (todos los estados), así que la
   * lista de abajo mostraba activas + resueltas del mismo tipo. Probe
   * original: 2 info firing + 3 info resolved → tile "2", lista "5".
   */
  it('A2: clicking a severity tile also filters the list to firing — the count matches the tile', async () => {
    mockList({
      data: [
        makeAlert({ id: 'f1', severity: 'info', status: 'firing' }),
        makeAlert({ id: 'f2', severity: 'info', status: 'firing' }),
        makeAlert({ id: 'r1', severity: 'info', status: 'resolved' }),
        makeAlert({ id: 'r2', severity: 'info', status: 'resolved' }),
        makeAlert({ id: 'r3', severity: 'info', status: 'resolved' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const infoTile = within(getSeverityGroup()).getByRole('button', { name: /^info/i });
    expect(within(infoTile).getByText('2')).toBeInTheDocument();

    await userEvent.click(infoTile);

    // El tile prometía 2 — la lista debe mostrar EXACTAMENTE 2, no 5.
    expect(screen.getByText(/2 alertas visibles/i)).toBeInTheDocument();
    expect(screen.queryByText(/5 alertas visibles/i)).not.toBeInTheDocument();

    // `Select` es un combobox propio (WAI-ARIA "Select-Only Combobox", NO un
    // <select> nativo) — el valor elegido se lee del texto visible del trigger.
    const statusSelect = screen.getByRole('combobox', { name: /estado/i });
    expect(statusSelect).toHaveTextContent(/^activa/i);

    // Toggle OFF: vuelve a mostrar todas (activas + resueltas).
    await userEvent.click(infoTile);
    expect(screen.getByText(/5 alertas visibles/i)).toBeInTheDocument();
  });
});

describe('A4 (review adversarial): no aria-live/aria-atomic on raw KPI numbers', () => {
  it('the severity tile values are NOT live regions (avoids announcing a bare number on every SSE tick)', () => {
    mockList({
      data: [makeAlert({ id: 'a1', severity: 'critical', status: 'firing' })],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const criticalTile = within(getSeverityGroup()).getByRole('button', { name: /cr[ií]tica/i });
    expect(criticalTile.querySelector('[aria-live]')).toBeNull();
  });
});

describe('B13 (review adversarial): "no data yet" must not read as "network is healthy"', () => {
  it('shows "sin datos" (not "la red está en orden") when data is undefined without loading/error', () => {
    mockList({ data: undefined, isLoading: false, isError: false });
    renderPage();

    const summary = screen.getByRole('region', { name: /resumen/i });
    expect(within(summary).getByText(/sin datos para mostrar/i)).toBeInTheDocument();
    expect(within(summary).queryByText(/la red está en orden/i)).not.toBeInTheDocument();
  });

  it('still shows "la red está en orden" when data genuinely resolved to zero active alerts', () => {
    mockList({ data: [], isLoading: false, isError: false });
    renderPage();

    const summary = screen.getByRole('region', { name: /resumen/i });
    expect(within(summary).getByText(/sin alertas activas.*la red está en orden/i)).toBeInTheDocument();
  });
});

describe('ALP-10 ack-pending indicator', () => {
  it('shows how many ACTIVE alerts are still unacknowledged (global)', () => {
    mockList({
      data: [
        makeAlert({ id: 'a1', status: 'firing', acknowledged: false }),
        makeAlert({ id: 'a2', status: 'firing', acknowledged: true, ackBy: 'juan' }),
        makeAlert({ id: 'a3', status: 'firing', acknowledged: false }),
        makeAlert({ id: 'a4', status: 'resolved', acknowledged: false }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const summary = screen.getByRole('region', { name: /resumen/i });
    // M9 (review adversarial): el tile de ACK ya NO es `role="status"` — era
    // una live region que anunciaba en cada tick del SSE solo para que un
    // test lo encontrara, y rompía el claim de "un solo role=status" en el
    // estado de éxito (ver ALP-12 más abajo). Se ubica por testid.
    const ackTile = within(summary).getByTestId('kpi-tile-ack');
    expect(within(ackTile).getByText(/sin reconocer/i)).toBeInTheDocument();
    expect(within(ackTile).getByText('2')).toBeInTheDocument();
  });

  it('M9: does not use role="status" — success state has zero role=status regions', () => {
    mockList({
      data: [makeAlert({ id: 'a1', status: 'firing', acknowledged: false })],
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });
});

describe('ALP-11 incident type breakdown (top N)', () => {
  /**
   * A3 (review adversarial): el orden YA NO es por conteo bruto — ordenar
   * así reproducía el problema que el resumen vino a resolver (con la
   * distribución real de prod, 305 info/63 warning/16 critical, los primeros
   * 6 por conteo eran todos info y un `NAS DOWN` critical quedaba afuera).
   * Orden real: severidad DOMINANTE primero (critical > warning > info),
   * conteo DESPUÉS dentro de la misma severidad.
   */
  it('ranks by dominant severity first, then by count within the same severity', () => {
    mockList({
      data: [
        ...Array.from({ length: 3 }, (_, i) =>
          makeAlert({ id: `los-${i}`, alertname: 'ONU LOS', severity: 'critical', status: 'firing', source: 'fiber-collector' }),
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          makeAlert({ id: `rec-${i}`, alertname: 'ONU recovered', severity: 'info', status: 'firing', source: 'fiber-collector' }),
        ),
        makeAlert({ id: 'pon-1', alertname: 'PON signal degraded', severity: 'warning', status: 'firing', source: 'fiber-collector' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const summary = screen.getByRole('region', { name: /resumen/i });
    const rows = within(summary).getAllByRole('button', { name: /onu recovered|onu los|pon signal degraded/i });

    // "ONU LOS" es critical (3) → SIEMPRE primero, aunque "ONU recovered" (info, 5)
    // tenga más volumen. "PON signal degraded" es warning (1) → segundo.
    // "ONU recovered" (info, 5) → último pese a ser el más numeroso.
    expect(rows[0]).toHaveTextContent('ONU LOS');
    expect(rows[0]).toHaveTextContent('3');
    expect(rows[1]).toHaveTextContent('PON signal degraded');
    expect(rows[2]).toHaveTextContent('ONU recovered');
    expect(rows[2]).toHaveTextContent('5');
  });

  it('A3: a low-count critical type is NEVER pushed out of the top-N by high-volume info types (prod-shaped data)', () => {
    // Forma de prod: 5 tipos info con MUCHO volumen (llenarían las 6 posiciones
    // por conteo bruto ellos solos) + 1 tipo warning + 1 tipo critical con
    // apenas 1 alerta. TOP_TYPES_LIMIT=6 — con orden por conteo bruto el
    // critical queda afuera (probe original del review). Con severidad
    // primero, el critical SIEMPRE entra.
    mockList({
      data: [
        ...Array.from({ length: 10 }, (_, i) => makeAlert({ id: `i1-${i}`, alertname: 'ONU recovered', severity: 'info', status: 'firing' })),
        ...Array.from({ length: 9 }, (_, i) => makeAlert({ id: `i2-${i}`, alertname: 'Signal fluctuation', severity: 'info', status: 'firing' })),
        ...Array.from({ length: 8 }, (_, i) => makeAlert({ id: `i3-${i}`, alertname: 'ONU rebooted', severity: 'info', status: 'firing' })),
        ...Array.from({ length: 7 }, (_, i) => makeAlert({ id: `i4-${i}`, alertname: 'Low RX power', severity: 'info', status: 'firing' })),
        ...Array.from({ length: 6 }, (_, i) => makeAlert({ id: `i5-${i}`, alertname: 'ONU registered', severity: 'info', status: 'firing' })),
        ...Array.from({ length: 5 }, (_, i) => makeAlert({ id: `w1-${i}`, alertname: 'PON signal degraded', severity: 'warning', status: 'firing' })),
        makeAlert({ id: 'crit-1', alertname: 'NAS DOWN', severity: 'critical', status: 'firing' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const summary = screen.getByRole('region', { name: /resumen/i });
    // El critical debe estar presente Y primero — la garantía dura del fix.
    const critRow = within(summary).getByRole('button', { name: /nas down/i });
    expect(critRow).toBeInTheDocument();

    const allRows = within(summary).getAllByRole('button', {
      name: /onu recovered|signal fluctuation|onu rebooted|low rx power|onu registered|pon signal degraded|nas down/i,
    });
    expect(allRows[0]).toHaveTextContent('NAS DOWN');
  });

  it('clicking a type row toggles the alertname filter and narrows the visible list', async () => {
    mockList({
      data: [
        makeAlert({ id: 'a1', alertname: 'ONU LOS', status: 'firing' }),
        makeAlert({ id: 'a2', alertname: 'PON signal degraded', status: 'firing' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const summary = screen.getByRole('region', { name: /resumen/i });
    const losRow = within(summary).getByRole('button', { name: /onu los/i });
    await userEvent.click(losRow);

    expect(screen.getByText(/1 alerta visible/i)).toBeInTheDocument();
    expect(losRow).toHaveAttribute('aria-pressed', 'true');

    // "Limpiar filtros" quita también el filtro de tipo (mismo estado reusado).
    await userEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }));
    expect(screen.getByText(/2 alertas visibles/i)).toBeInTheDocument();
  });
});

describe('ALP-12 summary state branches (loading/error/empty/success)', () => {
  it('loading: renders without crashing while the list loads (no duplicate role=status)', () => {
    mockList({ isLoading: true, data: undefined });
    renderPage();
    // Sigue habiendo EXACTAMENTE un role=status (el skeleton de la lista) —
    // el resumen en loading es puramente visual (aria-hidden), no duplica el anuncio.
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('error: does not duplicate role=alert (el bloque de error de la lista ya lo cubre)', () => {
    mockList({ isError: true, isLoading: false, data: undefined });
    renderPage();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('empty: shows an explicit "sin alertas activas" message instead of zeroed tiles', () => {
    mockList({ data: [], isLoading: false, isError: false });
    renderPage();
    const summary = screen.getByRole('region', { name: /resumen/i });
    expect(within(summary).getByText(/sin alertas activas/i)).toBeInTheDocument();
    expect(within(summary).queryByRole('button')).not.toBeInTheDocument();
  });
});
