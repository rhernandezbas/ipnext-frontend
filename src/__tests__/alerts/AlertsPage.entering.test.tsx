/**
 * AlertsPage — la animación de entrada de fila se dispara por CAMBIO DE ESTADO,
 * no por FRAME del stream (change `noc-alerts-hub`, panel NOC).
 *
 *  ALP-E1 alerta NUEVA (fingerprint que no estaba) → la fila entra con `data-entering`
 *  ALP-E2 RE-ANUNCIO de una alerta que YA está firing → NO re-anima (el parpadeo)
 *  ALP-E3 RESURRECCIÓN (estaba `resolved` y vuelve a firing) → SÍ anima
 *  ALP-E4 el ciclo completo: entra, se limpia por timeout, y un re-anuncio
 *         posterior NO la vuelve a marcar
 *
 * Por qué este archivo y no `AlertsPage.test.tsx`: ese suite mockea el módulo
 * `@/hooks/useNocAlerts` ENTERO con dobles INERTES (`useNocAlertsStream` devuelve
 * el string 'live' y jamás llama a `onNewFiring`), así que por construcción no
 * puede observar qué pasa cuando llega un frame. Acá el arnés es REACTIVO: hooks
 * REALES + `EventSource` falso empujando frames de verdad a la cache de
 * react-query, que es la única forma de que el re-render que produce el
 * parpadeo ocurra en el test como ocurre en el navegador.
 */
import { render, screen, act, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { NocAlertDto } from '@/types/nocAlert';

vi.mock('@/api/nocAlerts.api', () => ({
  listNocAlerts: vi.fn(),
  acknowledgeNocAlert: vi.fn(),
  NOC_ALERTS_STREAM_URL: '/api/alerts/stream',
}));

import AlertsPage from '@/pages/alerts/AlertsPage';
import { listNocAlerts } from '@/api/nocAlerts.api';
import { nocAlertsKey } from '@/hooks/useNocAlerts';

// ── Fake EventSource (mismo molde que useNocAlerts.test.ts) ─────────────────

class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readyState = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((ev: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;

  static instances: FakeEventSource[] = [];

  constructor(_url: string, _init?: EventSourceInit) {
    FakeEventSource.instances.push(this);
  }

  message(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }

  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
}

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

/** Mismo timeout que `ROW_ENTER_MS + 40` en AlertsPage.tsx. */
const ROW_ENTER_CLEAR_MS = 320;

/** Fila (li) de la LISTA que contiene ese alertname. Se busca DENTRO de la
 *  lista a propósito: el resumen por tipo (arriba) también imprime el
 *  `alertname`, así que un `getByText` global matchea dos nodos. */
function rowOf(alertname: string): HTMLElement {
  const list = screen.getByRole('list', { name: 'Lista de alertas' });
  const el = within(list).getByText(alertname).closest('li');
  if (!el) throw new Error(`No hay fila para "${alertname}"`);
  return el as HTMLElement;
}

function isEntering(alertname: string): boolean {
  return rowOf(alertname).hasAttribute('data-entering');
}

/** Siembra la cache con lo que el panel YA está mostrando y monta la página con
 *  los hooks REALES. No se llama a `onopen` a propósito: eso invalidaría la
 *  query (reconciliación por refetch) y mezclaría dos caminos distintos — acá
 *  se mide exclusivamente qué hace un frame del stream. */
function renderWithSeed(seed: NocAlertDto[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(nocAlertsKey, seed);
  vi.mocked(listNocAlerts).mockResolvedValue(seed);

  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { qc, es: () => FakeEventSource.instances[0]! };
}

beforeEach(() => {
  vi.clearAllMocks();
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('ALP-E1 alerta nueva', () => {
  it('un firing de un fingerprint que NO estaba marca la fila para animar', () => {
    const { es } = renderWithSeed([makeAlert({ id: 'vieja', alertname: 'YaEstaba' })]);

    const nueva = makeAlert({ id: 'nueva', alertname: 'NodoCaido' });
    act(() => es().message({ type: 'firing', alert: nueva }));

    expect(isEntering('NodoCaido')).toBe(true);
  });
});

describe('ALP-E2 re-anuncio (el parpadeo)', () => {
  it('un firing sobre una alerta que YA está firing en el panel NO la re-anima', () => {
    const yaFiring = makeAlert({ id: 'a1', alertname: 'HighLatency', status: 'firing' });
    const { es } = renderWithSeed([yaFiring]);

    expect(isEntering('HighLatency')).toBe(false);

    // El colector pasa de FLANCO a NIVEL: re-anuncia cada fingerprint activo
    // 1× cada 30 min. Mismo estado, mismo fingerprint — sólo cambia `updatedAt`
    // (por eso structural sharing de react-query tampoco lo filtra).
    act(() =>
      es().message({
        type: 'firing',
        alert: { ...yaFiring, updatedAt: '2026-07-24T10:30:00.000Z' },
      }),
    );

    expect(isEntering('HighLatency')).toBe(false);
  });

  it('N re-anuncios seguidos no marcan la fila ni una sola vez', () => {
    const yaFiring = makeAlert({ id: 'a1', alertname: 'HighLatency', status: 'firing' });
    const { es } = renderWithSeed([yaFiring]);

    for (let i = 0; i < 5; i++) {
      act(() =>
        es().message({
          type: 'firing',
          alert: { ...yaFiring, updatedAt: `2026-07-24T1${i}:30:00.000Z` },
        }),
      );
      expect(isEntering('HighLatency')).toBe(false);
    }
  });
});

describe('ALP-E3 resurrección (el caso legítimo)', () => {
  it('una alerta RESUELTA que vuelve a disparar SÍ es nueva y SÍ anima', () => {
    const resuelta = makeAlert({ id: 'a1', alertname: 'HighLatency', status: 'resolved' });
    const { es } = renderWithSeed([resuelta]);

    expect(isEntering('HighLatency')).toBe(false);

    act(() =>
      es().message({
        type: 'firing',
        alert: { ...resuelta, status: 'firing', endsAt: null },
      }),
    );

    expect(isEntering('HighLatency')).toBe(true);
  });
});

describe('ALP-E4 ciclo completo (entra → se limpia → re-anuncio)', () => {
  it('tras limpiarse el marcador, un re-anuncio NO lo vuelve a poner', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { es } = renderWithSeed([]);

    const nueva = makeAlert({ id: 'nueva', alertname: 'NodoCaido' });
    act(() => es().message({ type: 'firing', alert: nueva }));
    expect(isEntering('NodoCaido')).toBe(true);

    // La animación termina y AlertsPage limpia el marcador.
    act(() => void vi.advanceTimersByTime(ROW_ENTER_CLEAR_MS + 10));
    expect(isEntering('NodoCaido')).toBe(false);

    // 30 min después llega el re-anuncio por NIVEL. Nada cambió → no se re-anima.
    act(() =>
      es().message({
        type: 'firing',
        alert: { ...nueva, updatedAt: '2026-07-24T10:30:00.000Z' },
      }),
    );
    expect(isEntering('NodoCaido')).toBe(false);
  });
});
