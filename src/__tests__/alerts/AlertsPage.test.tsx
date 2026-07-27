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

  /**
   * MEDIO-1 (2ª review adversarial): el fix A2 era UNIDIRECCIONAL. El tile
   * escribía `severity` + `status`, pero su `aria-pressed` solo miraba
   * `severity` — así que si después el operario tocaba el <Select> de Estado
   * a mano, el tile seguía diciendo "presionado" y prometiendo N mientras la
   * lista mostraba otra cosa. Probe: 1 critical firing + 2 critical resolved.
   * El estado "presionado" tiene que reflejar la condición COMPLETA que el
   * tile representa (severidad Y status=firing), no media condición.
   */
  it('MEDIO-1: the tile un-presses when the manual Estado filter no longer matches what the tile promises', async () => {
    mockList({
      data: [
        makeAlert({ id: 'f1', severity: 'critical', status: 'firing' }),
        makeAlert({ id: 'r1', severity: 'critical', status: 'resolved' }),
        makeAlert({ id: 'r2', severity: 'critical', status: 'resolved' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const criticalTile = within(getSeverityGroup()).getByRole('button', { name: /cr[ií]tica/i });
    await userEvent.click(criticalTile);
    expect(criticalTile).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/1 alerta visible/i)).toBeInTheDocument();

    // El operario cambia Estado a mano → el filtro real deja de ser "esta
    // severidad ACTIVA", que es lo único que el tile promete.
    const statusSelect = screen.getByRole('combobox', { name: /estado/i });
    await userEvent.click(statusSelect);
    await userEvent.click(screen.getByRole('option', { name: /resuelta/i }));

    expect(screen.getByText(/2 alertas visibles/i)).toBeInTheDocument();
    expect(criticalTile).toHaveAttribute('aria-pressed', 'false');
  });

  /**
   * MEDIO-2 (2ª review adversarial): que el click del tile PISE el `status`
   * manual es defendible (acción atómica). Que el DES-toggle lo BORRE no lo
   * es: el operario había elegido "Resuelta" a mano y al des-togglear quedaba
   * en "Todos los estados". El des-toggle tiene que RESTAURAR lo previo.
   */
  it('MEDIO-2: un-toggling the tile RESTORES the status the user had picked by hand', async () => {
    mockList({
      data: [
        makeAlert({ id: 'f1', severity: 'critical', status: 'firing' }),
        makeAlert({ id: 'r1', severity: 'critical', status: 'resolved' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const statusSelect = screen.getByRole('combobox', { name: /estado/i });
    await userEvent.click(statusSelect);
    await userEvent.click(screen.getByRole('option', { name: /resuelta/i }));
    expect(statusSelect).toHaveTextContent(/^resuelta/i);

    const criticalTile = within(getSeverityGroup()).getByRole('button', { name: /cr[ií]tica/i });
    await userEvent.click(criticalTile);
    expect(statusSelect).toHaveTextContent(/^activa/i); // pisado — acción atómica, aceptado

    await userEvent.click(criticalTile);
    // NO "Todos los estados": vuelve lo que el operario había elegido.
    expect(statusSelect).toHaveTextContent(/^resuelta/i);
    expect(screen.getByText(/1 alerta visible/i)).toBeInTheDocument();
  });
});

/**
 * MEDIO-1 (3ª review adversarial) — fuga del reducer.
 *
 * `disengageSummary` decidía si quedaba algún control del resumen enganchado
 * con `filters.severity !== '' || filters.alertname !== ''`, o sea INFIRIENDO
 * el enganche de que un campo estuviera no-vacío. Pero una `severity` puesta a
 * mano con el <Select> también deja el campo no-vacío, y el reducer la contaba
 * como "hay un control enganchado que sostiene el 'firing'" → nunca restauraba
 * el status. Resultado: `Estado: Activa` PEGADO, que el operario nunca puso, y
 * un tile con `aria-pressed=true` que nadie clickeó.
 *
 * Es el mismo defecto que MEDIO-2 (2ª review) cerró, sobreviviendo en la
 * dimensión que el reducer no modelaba. El fix no es otro parche a la
 * condición: es MODELAR el enganche explícitamente (`engaged.severity` /
 * `engaged.alertname`), de forma que "puesto por un control del resumen" y
 * "campo no vacío" dejen de ser lo mismo.
 */
describe('MEDIO-1 (3ª review adversarial): the reducer models summary ENGAGEMENT, not "field is non-empty"', () => {
  function mixedData() {
    mockList({
      data: [
        makeAlert({ id: 'w-los-f', alertname: 'ONU LOS', severity: 'warning', status: 'firing' }),
        makeAlert({ id: 'w-los-r', alertname: 'ONU LOS', severity: 'warning', status: 'resolved' }),
        makeAlert({ id: 'w-pon-f', alertname: 'PON signal degraded', severity: 'warning', status: 'firing' }),
        makeAlert({ id: 'c-nas-f', alertname: 'NAS DOWN', severity: 'critical', status: 'firing' }),
        makeAlert({ id: 'i-rec-r', alertname: 'ONU recovered', severity: 'info', status: 'resolved' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();
  }

  it('door 1: hand-picked severity + engage a type row + DISengage it → the status goes back, no phantom pressed tile', async () => {
    mixedData();

    // El operario elige Severidad a mano. NO es un tile enganchado.
    const severitySelect = screen.getByRole('combobox', { name: /severidad/i });
    await userEvent.click(severitySelect);
    await userEvent.click(screen.getByRole('option', { name: /advertencia/i }));

    const statusSelect = screen.getByRole('combobox', { name: /estado/i });
    expect(statusSelect).toHaveTextContent(/^todos los estados/i);

    // Engancha una fila del breakdown y la desengancha.
    const summary = screen.getByRole('region', { name: /resumen/i });
    const losRow = within(summary).getByRole('button', { name: /onu los/i });
    await userEvent.click(losRow);
    expect(statusSelect).toHaveTextContent(/^activa/i);
    await userEvent.click(losRow);

    // El 'firing' lo puso la FILA, y la fila ya no está: se restaura.
    expect(statusSelect).toHaveTextContent(/^todos los estados/i);
    // Y el tile de Advertencia NUNCA se clickeó → jamás puede verse presionado.
    const warningTile = within(getSeverityGroup()).getByRole('button', { name: /advertencia/i });
    expect(warningTile).toHaveAttribute('aria-pressed', 'false');
  });

  it('door 2: engage a severity tile, then clear it with the <Select> → the status is not left stuck on "Activa"', async () => {
    mixedData();

    const warningTile = within(getSeverityGroup()).getByRole('button', { name: /advertencia/i });
    await userEvent.click(warningTile);
    const statusSelect = screen.getByRole('combobox', { name: /estado/i });
    expect(statusSelect).toHaveTextContent(/^activa/i);

    // El operario limpia la severidad a mano: el tile ya no sostiene nada.
    const severitySelect = screen.getByRole('combobox', { name: /severidad/i });
    await userEvent.click(severitySelect);
    await userEvent.click(screen.getByRole('option', { name: /todas las severidades/i }));

    expect(statusSelect).toHaveTextContent(/^todos los estados/i);
    expect(warningTile).toHaveAttribute('aria-pressed', 'false');
  });

  it('door 3: hand-picked severity + engage a type row + the "quitar filtro de tipo" chip → same restore', async () => {
    mixedData();

    const severitySelect = screen.getByRole('combobox', { name: /severidad/i });
    await userEvent.click(severitySelect);
    await userEvent.click(screen.getByRole('option', { name: /advertencia/i }));

    const summary = screen.getByRole('region', { name: /resumen/i });
    await userEvent.click(within(summary).getByRole('button', { name: /onu los/i }));

    const statusSelect = screen.getByRole('combobox', { name: /estado/i });
    expect(statusSelect).toHaveTextContent(/^activa/i);

    await userEvent.click(screen.getByRole('button', { name: /quitar filtro de tipo/i }));
    expect(statusSelect).toHaveTextContent(/^todos los estados/i);
  });

  it('a severity set BY HAND never presses the tile — pressed means "I clicked it"', async () => {
    mixedData();

    const severitySelect = screen.getByRole('combobox', { name: /severidad/i });
    await userEvent.click(severitySelect);
    await userEvent.click(screen.getByRole('option', { name: /advertencia/i }));

    const statusSelect = screen.getByRole('combobox', { name: /estado/i });
    await userEvent.click(statusSelect);
    await userEvent.click(screen.getByRole('option', { name: /^activa/i }));

    // El filtro real es severity=warning + status=firing — EXACTAMENTE lo que
    // el tile representa — pero el operario nunca tocó el tile. No está
    // presionado, y esa es la diferencia entre "el filtro coincide" y "este
    // control está enganchado".
    const warningTile = within(getSeverityGroup()).getByRole('button', { name: /advertencia/i });
    expect(warningTile).toHaveAttribute('aria-pressed', 'false');

    // Invariante de la 2ª review, INTACTO: un botón que se ve suelto, al
    // clickearlo, se presiona (el toggle y el predicado son el mismo).
    await userEvent.click(warningTile);
    expect(warningTile).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(warningTile);
    expect(warningTile).toHaveAttribute('aria-pressed', 'false');
  });

  /**
   * Regresión del refactor: encadenar tile → tile (sin soltar el primero) tiene
   * que PRESERVAR el status original — no guardar el `'firing'` que dejó el
   * primer tile. Estaba verificado a mano en la 2ª review pero sin test, y es
   * exactamente el área que `engaged` + `settle` reescribieron.
   */
  it('chaining tile → tile keeps the ORIGINAL status, and only ONE tile is pressed at a time', async () => {
    mixedData();

    const statusSelect = screen.getByRole('combobox', { name: /estado/i });
    await userEvent.click(statusSelect);
    await userEvent.click(screen.getByRole('option', { name: /resuelta/i }));

    const group = getSeverityGroup();
    const criticalTile = within(group).getByRole('button', { name: /cr[ií]tica/i });
    const warningTile = within(group).getByRole('button', { name: /advertencia/i });

    await userEvent.click(criticalTile);
    expect(criticalTile).toHaveAttribute('aria-pressed', 'true');

    // Encadeno al segundo tile SIN soltar el primero.
    await userEvent.click(warningTile);
    expect(criticalTile).toHaveAttribute('aria-pressed', 'false');
    expect(warningTile).toHaveAttribute('aria-pressed', 'true');
    expect(statusSelect).toHaveTextContent(/^activa/i);

    // Al soltar, vuelve 'Resuelta' — NO el 'Activa' que dejó el primer tile.
    await userEvent.click(warningTile);
    expect(statusSelect).toHaveTextContent(/^resuelta/i);
  });

  it('`status: ""` (todos los estados) sobrevive el round-trip — se restaura con ?? y no con ||', async () => {
    mixedData();

    const statusSelect = screen.getByRole('combobox', { name: /estado/i });
    expect(statusSelect).toHaveTextContent(/^todos los estados/i);

    const criticalTile = within(getSeverityGroup()).getByRole('button', { name: /cr[ií]tica/i });
    await userEvent.click(criticalTile);
    expect(statusSelect).toHaveTextContent(/^activa/i);
    await userEvent.click(criticalTile);
    expect(statusSelect).toHaveTextContent(/^todos los estados/i);
  });

  /**
   * Corolario del hallazgo: el test `MEDIO-2: un-toggling the tile RESTORES the
   * status the user had picked by hand` promete más de lo que cubre — solo vale
   * si NO hay nada más enganchado. Acá SÍ lo hay: dos controles del resumen
   * enganchados a la vez. El status previo tiene que sobrevivir a los dos y
   * restaurarse UNA sola vez, al soltar el último.
   */
  it('MEDIO-2 reforzado: with TWO summary controls engaged, the hand-picked status survives until the LAST one is released', async () => {
    mixedData();

    const statusSelect = screen.getByRole('combobox', { name: /estado/i });
    await userEvent.click(statusSelect);
    await userEvent.click(screen.getByRole('option', { name: /resuelta/i }));
    expect(statusSelect).toHaveTextContent(/^resuelta/i);

    const warningTile = within(getSeverityGroup()).getByRole('button', { name: /advertencia/i });
    const summary = screen.getByRole('region', { name: /resumen/i });
    const losRow = within(summary).getByRole('button', { name: /onu los/i });

    await userEvent.click(warningTile);
    await userEvent.click(losRow);
    expect(statusSelect).toHaveTextContent(/^activa/i);

    // Suelto el PRIMERO: la fila sigue enganchada y sostiene el 'firing'.
    await userEvent.click(warningTile);
    expect(statusSelect).toHaveTextContent(/^activa/i);
    expect(losRow).toHaveAttribute('aria-pressed', 'true');

    // Suelto el ÚLTIMO: recién ahí vuelve lo que el operario había elegido.
    await userEvent.click(losRow);
    expect(statusSelect).toHaveTextContent(/^resuelta/i);
    expect(warningTile).toHaveAttribute('aria-pressed', 'false');
    expect(losRow).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('A4 (review adversarial): no aria-live/aria-atomic on raw KPI numbers', () => {
  /**
   * BAJO-2 (2ª review adversarial): el test original solo miraba el tile de
   * CRÍTICA (`criticalTile.querySelector('[aria-live]')`). Una regresión que
   * metiera `aria-live` en el tile de Advertencia, en el de Info, en el de ACK
   * o en una fila del breakdown pasaba igual. Barrido COMPLETO del resumen:
   * ninguna live region (ni `aria-live`, ni `aria-atomic`, ni `role=status`,
   * ni `role=alert`) puede vivir adentro — el `.count` de la lista ya cubre
   * "algo cambió" y estos números cambian en CADA tick del SSE.
   */
  function summaryWithEveryTileAndRow() {
    mockList({
      data: [
        makeAlert({ id: 'c1', severity: 'critical', status: 'firing', alertname: 'NAS DOWN' }),
        makeAlert({ id: 'w1', severity: 'warning', status: 'firing', alertname: 'PON signal degraded' }),
        makeAlert({ id: 'i1', severity: 'info', status: 'firing', alertname: 'ONU recovered' }),
        makeAlert({ id: 'i2', severity: 'info', status: 'firing', alertname: 'ONU recovered', acknowledged: true, ackBy: 'juan' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();
    return screen.getByRole('region', { name: /resumen/i });
  }

  it('NO element inside the summary is a live region (all 3 severity tiles + ACK tile + every breakdown row)', () => {
    const summary = summaryWithEveryTileAndRow();
    expect(summary.querySelectorAll('[aria-live], [aria-atomic], [role="status"], [role="alert"]')).toHaveLength(0);
  });

  it('explicitly: each severity tile, the ACK tile and each breakdown row carry no aria-live themselves', () => {
    const summary = summaryWithEveryTileAndRow();
    const tiles = within(getSeverityGroup()).getAllByRole('button');
    const ackTile = within(summary).getByTestId('kpi-tile-ack');
    const rows = within(summary).getAllByRole('button', { name: /nas down|pon signal degraded|onu recovered/i });

    expect(tiles).toHaveLength(3);
    expect(rows).toHaveLength(3);

    for (const el of [...tiles, ackTile, ...rows]) {
      expect(el.hasAttribute('aria-live')).toBe(false);
      expect(el.hasAttribute('aria-atomic')).toBe(false);
      expect(el.querySelector('[aria-live], [aria-atomic]')).toBeNull();
    }
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

  /**
   * MEDIO-3 (2ª review adversarial): B13 quedó a mitad de camino. El RESUMEN
   * decía "Sin datos para mostrar." pero la LISTA, 200px más abajo, seguía
   * afirmando "No hay alertas activas en este momento." con `data === undefined`.
   * `hasData` nunca se consultaba en la rama de la lista. Afirmar "no hay
   * alertas activas" por AUSENCIA de datos es exactamente lo que B13 declaró
   * peligroso en un panel NOC.
   */
  it('MEDIO-3: the LIST empty branch also says "sin datos" — never "no hay alertas activas" — when data is undefined', () => {
    mockList({ data: undefined, isLoading: false, isError: false });
    renderPage();

    expect(screen.queryByText(/no hay alertas activas/i)).not.toBeInTheDocument();
    // Resumen Y lista: los dos bloques dicen lo mismo, "no sé" en vez de "no hay".
    expect(screen.getAllByText(/sin datos para mostrar/i)).toHaveLength(2);
  });

  it('MEDIO-3: with data genuinely empty the LIST still says "no hay alertas" (no falso "sin datos")', () => {
    mockList({ data: [], isLoading: false, isError: false });
    renderPage();

    expect(screen.getByText(/no hay alertas/i)).toBeInTheDocument();
    expect(screen.queryByText(/sin datos para mostrar/i)).not.toBeInTheDocument();
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
   * A3 (1ª review adversarial): el orden YA NO es por conteo bruto — ordenar
   * así reproducía el problema que el resumen vino a resolver (con la
   * distribución real de prod, 305 info/63 warning/16 critical, los primeros
   * 6 por conteo eran todos info y un `NAS DOWN` critical quedaba afuera).
   *
   * BAJO-2 (3ª review adversarial): este test se llamaba "ranks by DOMINANT
   * severity" y su fixture usaba solo tipos PUROS — donde dominante == máxima —
   * así que CERTIFICABA la implementación vieja: pasaba igual rankeando por la
   * severidad modal, que es justo lo que Foco 2 (2ª review) mató. El nombre
   * prometía un contrato que el test no distinguía.
   *
   * Fixture reforzado: los tipos ahora MEZCLAN severidades y la modal de los
   * tres es `info`. Con ranking por severidad DOMINANTE los tres empatan y el
   * orden cae al conteo → "ONU recovered" (8) primero. Con severidad MÁXIMA
   * (el contrato real) manda la gravedad: critical → warning → info.
   */
  it('ranks by MAXIMUM severity first, then by count within the same severity', () => {
    mockList({
      data: [
        // maxSeverity=critical, modal=info (1 crit + 4 info) → total 5.
        makeAlert({ id: 'los-c', alertname: 'ONU LOS', severity: 'critical', status: 'firing', source: 'fiber-collector' }),
        ...Array.from({ length: 4 }, (_, i) =>
          makeAlert({ id: `los-i-${i}`, alertname: 'ONU LOS', severity: 'info', status: 'firing', source: 'fiber-collector' }),
        ),
        // maxSeverity=warning, modal=info (1 warn + 3 info) → total 4.
        makeAlert({ id: 'pon-w', alertname: 'PON signal degraded', severity: 'warning', status: 'firing', source: 'fiber-collector' }),
        ...Array.from({ length: 3 }, (_, i) =>
          makeAlert({ id: `pon-i-${i}`, alertname: 'PON signal degraded', severity: 'info', status: 'firing', source: 'fiber-collector' }),
        ),
        // maxSeverity=info PURO, y el MÁS numeroso de los tres → total 8.
        ...Array.from({ length: 8 }, (_, i) =>
          makeAlert({ id: `rec-${i}`, alertname: 'ONU recovered', severity: 'info', status: 'firing', source: 'fiber-collector' }),
        ),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const summary = screen.getByRole('region', { name: /resumen/i });
    const rows = within(summary).getAllByRole('button', { name: /onu recovered|onu los|pon signal degraded/i });

    // "ONU LOS" contiene 1 critical → SIEMPRE primero, aunque su severidad
    // MODAL sea info y "ONU recovered" (8) tenga casi el doble de volumen.
    expect(rows[0]).toHaveTextContent('ONU LOS');
    expect(rows[0]).toHaveTextContent('5');
    expect(rows[1]).toHaveTextContent('PON signal degraded');
    expect(rows[2]).toHaveTextContent('ONU recovered');
    expect(rows[2]).toHaveTextContent('8');

    // Y el badge visible sigue mostrando la MÁXIMA, no la modal.
    expect(within(rows[0] as HTMLElement).getByText(/cr[ií]tica/i)).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText(/advertencia/i)).toBeInTheDocument();
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

  /**
   * Foco 2 (2ª review adversarial, CONFIRMADO contra el backend): la severidad
   * NO está acoplada al `alertname` — `GrafanaWebhookSource.ts` la toma del
   * label POR ALERTA (la inferencia por alertname es solo fallback) y el
   * ingest genérico valida `alertname` y `severity` como campos independientes.
   * O sea: un mismo tipo PUEDE mezclar severidades. Rankear por la severidad
   * MODAL (la más frecuente) hace que un tipo con 20 info + 1 critical se
   * muestre como "Info" y quede FUERA del top-6, escondiendo el critical.
   * En un panel NOC sobre-avisar es más seguro que sub-avisar: el ranking va
   * por la severidad MÁXIMA presente.
   */
  it('Foco 2: a MIXED type (20 info + 1 critical) ranks by its MAXIMUM severity — it is never evicted from the top-N', () => {
    mockList({
      data: [
        // 6 tipos info PUROS con más volumen que el mixto: por conteo (o por
        // severidad modal, que para todos ellos es info) llenan las 6 posiciones.
        ...Array.from({ length: 30 }, (_, i) => makeAlert({ id: `p1-${i}`, alertname: 'ONU recovered', severity: 'info', status: 'firing' })),
        ...Array.from({ length: 29 }, (_, i) => makeAlert({ id: `p2-${i}`, alertname: 'Signal fluctuation', severity: 'info', status: 'firing' })),
        ...Array.from({ length: 28 }, (_, i) => makeAlert({ id: `p3-${i}`, alertname: 'ONU rebooted', severity: 'info', status: 'firing' })),
        ...Array.from({ length: 27 }, (_, i) => makeAlert({ id: `p4-${i}`, alertname: 'Low RX power', severity: 'info', status: 'firing' })),
        ...Array.from({ length: 26 }, (_, i) => makeAlert({ id: `p5-${i}`, alertname: 'ONU registered', severity: 'info', status: 'firing' })),
        ...Array.from({ length: 25 }, (_, i) => makeAlert({ id: `p6-${i}`, alertname: 'ONU dying gasp', severity: 'info', status: 'firing' })),
        // El tipo MEZCLADO: modal = info (20), máxima = critical (1). Total 21
        // → séptimo por conteo, y séptimo también por severidad modal → EVICTED.
        ...Array.from({ length: 20 }, (_, i) => makeAlert({ id: `mx-i-${i}`, alertname: 'OLT port flapping', severity: 'info', status: 'firing' })),
        makeAlert({ id: 'mx-c', alertname: 'OLT port flapping', severity: 'critical', status: 'firing' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const summary = screen.getByRole('region', { name: /resumen/i });
    const rows = within(summary).getAllByRole('button', {
      name: /onu recovered|signal fluctuation|onu rebooted|low rx power|onu registered|onu dying gasp|olt port flapping/i,
    });

    // Entra al top-N Y va PRIMERO: contiene una critical.
    expect(rows[0]).toHaveTextContent('OLT port flapping');
    // El badge muestra la MÁXIMA (Crítica), no la modal (Info).
    expect(within(rows[0] as HTMLElement).getByText(/cr[ií]tica/i)).toBeInTheDocument();
    // …y el desglose real viaja en el nombre accesible, para no sobre-representar:
    // "1 Crítica" + "20 Info" dentro del mismo tipo.
    expect(rows[0]).toHaveAccessibleName(/1 cr[ií]tica/i);
    expect(rows[0]).toHaveAccessibleName(/20 info/i);
  });

  /**
   * BAJO-3 (3ª review adversarial): el badge muestra la severidad MÁXIMA, así
   * que 200 info + 1 critical se ve `201 · OLT flap · Crítica` con la barra
   * roja llena. El desglose real YA viajaba en el `aria-label` (perfecto para
   * lector de pantalla) y en el `title` — pero el `title` requiere HOVER, que
   * en touch no existe. El operario VIDENTE en una tablet no tenía forma de
   * ver que la crítica era 1 de 201.
   *
   * Fix de bajo riesgo: cuando el tipo MEZCLA severidades, al lado del badge
   * se muestra cuántas son de la severidad máxima ("Crítica ×1"). Sobre-avisar
   * sigue siendo la política (el tipo NO se degrada ni se saca del podio), pero
   * la magnitud deja de ser invisible sin hover.
   */
  it('BAJO-3: a MIXED type shows the max-severity count VISIBLY (no hover needed), not only in the aria-label', () => {
    mockList({
      data: [
        ...Array.from({ length: 200 }, (_, i) =>
          makeAlert({ id: `mx-i-${i}`, alertname: 'OLT port flapping', severity: 'info', status: 'firing' }),
        ),
        makeAlert({ id: 'mx-c', alertname: 'OLT port flapping', severity: 'critical', status: 'firing' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const summary = screen.getByRole('region', { name: /resumen/i });
    const row = within(summary).getByRole('button', { name: /olt port flapping/i });

    // El total sigue siendo 201 y el badge sigue diciendo Crítica (sobre-avisar).
    expect(within(row).getByText('201')).toBeInTheDocument();
    expect(within(row).getByText(/cr[ií]tica/i)).toBeInTheDocument();
    // …pero AHORA se ve, sin hover, que la crítica es UNA.
    expect(within(row).getByText('×1')).toBeInTheDocument();
    // El desglose completo sigue en el nombre accesible (no se degradó nada).
    expect(row).toHaveAccessibleName(/1 cr[ií]tica/i);
    expect(row).toHaveAccessibleName(/200 info/i);
  });

  it('BAJO-3: a PURE type gets NO mix indicator — el tipo puro no gana ruido', () => {
    mockList({
      data: Array.from({ length: 7 }, (_, i) =>
        makeAlert({ id: `p-${i}`, alertname: 'ONU recovered', severity: 'info', status: 'firing' }),
      ),
      isLoading: false,
      isError: false,
    });
    renderPage();

    const summary = screen.getByRole('region', { name: /resumen/i });
    const row = within(summary).getByRole('button', { name: /onu recovered/i });
    expect(within(row).getByText('7')).toBeInTheDocument();
    expect(within(row).queryByText(/^×/)).toBeNull();
  });

  it('Foco 2: a PURE info type keeps showing Info (the max-severity rule does not inflate anything)', () => {
    mockList({
      data: [
        ...Array.from({ length: 3 }, (_, i) => makeAlert({ id: `pi-${i}`, alertname: 'ONU recovered', severity: 'info', status: 'firing' })),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const summary = screen.getByRole('region', { name: /resumen/i });
    const row = within(summary).getByRole('button', { name: /onu recovered/i });
    expect(within(row).getByText(/^info$/i)).toBeInTheDocument();
    expect(within(row).queryByText(/cr[ií]tica|advertencia/i)).not.toBeInTheDocument();
  });

  /**
   * MEDIO-1 / hermano: la fila del breakdown tiene EXACTAMENTE el mismo
   * contrato que el tile de severidad — su conteo es GLOBAL sobre ACTIVAS —
   * y arrastraba el mismo defecto A2: prometía N y la lista mostraba
   * activas + resueltas de ese tipo. Probe: 1 firing + 3 resolved del mismo
   * alertname → la fila dice 1, la lista decía 4.
   */
  it('MEDIO-1 (hermano): clicking a type row also filters the list to firing — the count matches the row', async () => {
    mockList({
      data: [
        makeAlert({ id: 'f1', alertname: 'ONU LOS', status: 'firing' }),
        makeAlert({ id: 'r1', alertname: 'ONU LOS', status: 'resolved' }),
        makeAlert({ id: 'r2', alertname: 'ONU LOS', status: 'resolved' }),
        makeAlert({ id: 'r3', alertname: 'ONU LOS', status: 'resolved' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const summary = screen.getByRole('region', { name: /resumen/i });
    const losRow = within(summary).getByRole('button', { name: /onu los/i });
    expect(within(losRow).getByText('1')).toBeInTheDocument();

    await userEvent.click(losRow);
    expect(screen.getByText(/1 alerta visible/i)).toBeInTheDocument();
    expect(screen.queryByText(/4 alertas visibles/i)).not.toBeInTheDocument();
    expect(losRow).toHaveAttribute('aria-pressed', 'true');

    // …y el estado "presionado" refleja la condición COMPLETA: si el operario
    // cambia Estado a mano, la fila deja de prometer lo que promete.
    const statusSelect = screen.getByRole('combobox', { name: /estado/i });
    await userEvent.click(statusSelect);
    await userEvent.click(screen.getByRole('option', { name: /resuelta/i }));
    expect(losRow).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/3 alertas visibles/i)).toBeInTheDocument();
  });

  /**
   * MEDIO-3 (3ª review adversarial): el comentario de `computeTypeBreakdown`
   * describía una cadena de sort de 4 claves (severidad → volumen → FUENTE →
   * nombre). El sort real tiene 3: `SEVERITY_RANK` → `count` → `alertname`;
   * NO hay clave de fuente. Este test fija la cadena REAL para que el
   * comentario no vuelva a despegarse del código: mismo `maxSeverity`, mismo
   * `count`, fuentes distintas — si la fuente desempatara alfabéticamente
   * ganaría "Bravo" (fiber-collector < grafana); gana "Alpha", por nombre.
   */
  it('MEDIO-3: the sort chain is severity → count → alertname — dominantSource is NOT a sort key', () => {
    mockList({
      data: [
        makeAlert({ id: 'b1', alertname: 'Bravo', severity: 'critical', status: 'firing', source: 'fiber-collector' }),
        makeAlert({ id: 'a1', alertname: 'Alpha', severity: 'critical', status: 'firing', source: 'grafana' }),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const summary = screen.getByRole('region', { name: /resumen/i });
    const rows = within(summary).getAllByRole('button', { name: /^(alpha|bravo):/i });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Alpha');
    expect(rows[1]).toHaveTextContent('Bravo');
  });

  /**
   * MEDIO-2 (3ª review adversarial): `TOP_TYPES_LIMIT` no tenía NINGUNA
   * cobertura. Revert probado por el revisor: `.slice(0, limit)` →
   * `.slice(0, 999)` y los 113 tests pasaban igual. Sin esto, borrar el
   * `.slice` hace que el panel escupa 400 filas — exactamente el muro de ruido
   * que el resumen vino a evitar — sin que nada chille.
   *
   * El límite se testea por su EFECTO observable: cuántas filas renderiza el
   * breakdown. `getAllByRole('listitem')` scopeado al resumen son las filas del
   * breakdown (el `<ul>` de la lista de alertas vive FUERA de la región).
   */
  it('MEDIO-2: the breakdown renders AT MOST TOP_TYPES_LIMIT (6) rows, no matter how many types are firing', () => {
    // 9 tipos distintos, TODOS activos, todos con conteos distintos para que el
    // orden sea determinístico. Sin el `.slice` se renderizarían los 9.
    const names = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9'];
    mockList({
      data: names.flatMap((name, idx) =>
        Array.from({ length: names.length - idx }, (_, i) =>
          makeAlert({ id: `${name}-${i}`, alertname: name, severity: 'info', status: 'firing' }),
        ),
      ),
      isLoading: false,
      isError: false,
    });
    renderPage();

    const summary = screen.getByRole('region', { name: /resumen/i });
    const rows = within(summary).getAllByRole('listitem');
    expect(rows).toHaveLength(6);

    // …y las que entran son las 6 de MÁS volumen (misma severidad → manda el
    // conteo): T1..T6 dentro, T7..T9 afuera.
    for (const inside of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']) {
      expect(within(summary).getByRole('button', { name: new RegExp(`^${inside}:`) })).toBeInTheDocument();
    }
    for (const outside of ['T7', 'T8', 'T9']) {
      expect(within(summary).queryByRole('button', { name: new RegExp(`^${outside}:`) })).toBeNull();
    }
  });

  /**
   * ALTO-1 (3ª review adversarial) — el hermano silencioso del fix A3. El
   * denominador de la mini-barra era `typeBreakdown[0].count`, y desde A3 la
   * fila `[0]` es la MÁS GRAVE, no la de más volumen. Con el caso NORMAL del
   * panel (los criticals son de BAJO volumen: 1 critical + 12 warning + 30
   * info) los anchos salían 100% / 1200% / 3000% y, como
   * `.breakdownBarTrack` tiene `overflow: hidden`, las TRES se veían idénticas
   * y llenas: el medidor no comunicaba nada y el tipo con 1 alerta se veía
   * igual que el de 30.
   *
   * El denominador tiene que ser el conteo MÁXIMO de las filas MOSTRADAS,
   * independiente del orden en que se muestren.
   */
  it('ALTO-1: the mini-bar scales against the MAX count of the shown rows, not against the first (most severe) row', () => {
    mockList({
      data: [
        makeAlert({ id: 'c1', alertname: 'NAS DOWN', severity: 'critical', status: 'firing' }),
        ...Array.from({ length: 12 }, (_, i) =>
          makeAlert({ id: `w-${i}`, alertname: 'PON signal degraded', severity: 'warning', status: 'firing' }),
        ),
        ...Array.from({ length: 30 }, (_, i) =>
          makeAlert({ id: `i-${i}`, alertname: 'ONU recovered', severity: 'info', status: 'firing' }),
        ),
      ],
      isLoading: false,
      isError: false,
    });
    renderPage();

    const summary = screen.getByRole('region', { name: /resumen/i });
    const rows = within(summary).getAllByRole('button', {
      name: /nas down|pon signal degraded|onu recovered/i,
    });
    const widths = rows.map((row) => {
      const fill = row.querySelector('.breakdownBarFill') as HTMLElement | null;
      if (!fill) throw new Error('La fila del breakdown no tiene mini-barra.');
      return parseFloat(fill.style.width);
    });

    // Orden por severidad (A3): NAS DOWN (1) → PON (12) → ONU recovered (30).
    expect(rows[0]).toHaveTextContent('NAS DOWN');
    expect(rows[2]).toHaveTextContent('ONU recovered');

    // NINGUNA barra puede pasarse del track (el `overflow: hidden` las
    // aplastaba todas contra el 100% y las volvía indistinguibles).
    for (const w of widths) expect(w).toBeLessThanOrEqual(100);

    // El más voluminoso llena la barra; los otros son proporcionales A ÉL.
    expect(widths[2]).toBeCloseTo(100, 5);
    expect(widths[1]).toBeCloseTo(40, 5);
    expect(widths[0]).toBeCloseTo(100 / 30, 5);

    // Y por lo tanto se DISTINGUEN entre sí: 1 alerta no se ve como 30.
    expect(widths[0]).toBeLessThan(widths[1]);
    expect(widths[1]).toBeLessThan(widths[2]);
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
