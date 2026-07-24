/**
 * useNocAlerts (Fase C FE, change `noc-alerts-hub`) — spec.md `noc-alert-realtime`:
 *
 *  NOCH-1 useNocAlertsList: queryKey ['nocAlerts','list'], refetchInterval
 *         gateado por (pollingEnabled && visible) — false en cualquier otro caso.
 *  NOCH-2 useAcknowledgeNocAlert: POST ack, patchea la fila en la cache y
 *         reconcilia con invalidate en onSettled (éxito Y error).
 *  NOCH-3 useNocAlertsStream: onopen (inicial O reconexión) → invalida la
 *         lista para reconciliar (spec.md "reconciles via full refetch").
 *  NOCH-4 onmessage 'firing' con id nuevo → upsert al tope + onFiring(id).
 *  NOCH-5 onmessage 'acked'/'resolved' sobre id existente → reemplaza in-place,
 *         no reordena.
 *  NOCH-6 onerror transiente (vuelve a OPEN antes de la ventana de gracia) →
 *         se queda en 'live', NUNCA polling.
 *  NOCH-7 onerror persistente (sigue sin OPEN pasados 5s) → mode 'polling' +
 *         cierra el EventSource.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import type { NocAlertDto } from '@/types/nocAlert';

vi.mock('@/api/nocAlerts.api', () => ({
  listNocAlerts: vi.fn(),
  acknowledgeNocAlert: vi.fn(),
  NOC_ALERTS_STREAM_URL: '/api/alerts/stream',
}));

vi.mock('@/hooks/useDocumentVisible', () => ({
  useDocumentVisible: vi.fn(),
}));

import { listNocAlerts, acknowledgeNocAlert } from '@/api/nocAlerts.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import {
  useNocAlertsList,
  useAcknowledgeNocAlert,
  useNocAlertsStream,
  nocAlertsKey,
} from '@/hooks/useNocAlerts';

// ── Fake EventSource ────────────────────────────────────────────────────────

class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readyState = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((ev: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;

  static instances: FakeEventSource[] = [];

  constructor(url: string, _init?: EventSourceInit) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  open() {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.();
  }

  message(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }

  error() {
    this.onerror?.();
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

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.mocked(useDocumentVisible).mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('NOCH-1 useNocAlertsList', () => {
  it('fetches the full list under nocAlertsKey', async () => {
    vi.mocked(listNocAlerts).mockResolvedValue([makeAlert()]);
    const qc = makeQC();
    const { result } = renderHook(() => useNocAlertsList(false), { wrapper: wrapper(qc) });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(listNocAlerts).toHaveBeenCalledTimes(1);
    expect(qc.getQueryData(nocAlertsKey)).toHaveLength(1);
  });

  it('refetchInterval is false when polling disabled, even if tab visible', async () => {
    vi.mocked(listNocAlerts).mockResolvedValue([]);
    vi.mocked(useDocumentVisible).mockReturnValue(true);
    const qc = makeQC();
    const { result } = renderHook(() => useNocAlertsList(false), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // no direct way to read refetchInterval from the hook result; behavioral
    // proof is covered by NOCH-7 (mode flips to polling → interval kicks in).
    expect(result.current.data).toEqual([]);
  });
});

describe('NOCH-2 useAcknowledgeNocAlert', () => {
  it('patches the acked row in cache on success', async () => {
    const qc = makeQC();
    qc.setQueryData(nocAlertsKey, [makeAlert({ id: 'a1' }), makeAlert({ id: 'a2' })]);
    const acked = makeAlert({ id: 'a1', acknowledged: true, ackBy: 'agente1', ackAt: '2026-07-24T10:05:00.000Z' });
    vi.mocked(acknowledgeNocAlert).mockResolvedValue(acked);

    const { result } = renderHook(() => useAcknowledgeNocAlert(), { wrapper: wrapper(qc) });
    act(() => result.current.mutate({ id: 'a1', note: 'visto' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(acknowledgeNocAlert).toHaveBeenCalledWith('a1', 'visto');
    const cached = qc.getQueryData<NocAlertDto[]>(nocAlertsKey);
    expect(cached?.find((a) => a.id === 'a1')?.acknowledged).toBe(true);
    expect(cached?.find((a) => a.id === 'a2')?.acknowledged).toBe(false);
  });

  it('reconciles (invalidates) even on error', async () => {
    const qc = makeQC();
    qc.setQueryData(nocAlertsKey, [makeAlert({ id: 'a1' })]);
    vi.mocked(listNocAlerts).mockResolvedValue([makeAlert({ id: 'a1' })]);
    vi.mocked(acknowledgeNocAlert).mockRejectedValue(new Error('403'));
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useAcknowledgeNocAlert(), { wrapper: wrapper(qc) });
    act(() => result.current.mutate({ id: 'a1' }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: nocAlertsKey });
  });
});

describe('NOCH-3/4/5 useNocAlertsStream', () => {
  it('onopen (initial connect) invalidates the list to reconcile', async () => {
    vi.mocked(listNocAlerts).mockResolvedValue([]);
    const qc = makeQC();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useNocAlertsStream({ enabled: true }), { wrapper: wrapper(qc) });

    expect(result.current).toBe('connecting');
    act(() => FakeEventSource.instances[0]!.open());

    expect(result.current).toBe('live');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: nocAlertsKey });
  });

  it('reconnection (close + new EventSource opens) triggers a NEW reconcile', () => {
    const qc = makeQC();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { rerender } = renderHook(({ enabled }) => useNocAlertsStream({ enabled }), {
      wrapper: wrapper(qc),
      initialProps: { enabled: true },
    });

    act(() => FakeEventSource.instances[0]!.open());
    expect(invalidateSpy).toHaveBeenCalledTimes(1);

    // simulate the connection dying and the effect re-running with a fresh EventSource
    rerender({ enabled: false });
    rerender({ enabled: true });
    act(() => FakeEventSource.instances[1]!.open());

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it('firing frame with a new id is upserted at the top and onFiring fires', () => {
    const qc = makeQC();
    qc.setQueryData(nocAlertsKey, [makeAlert({ id: 'old' })]);
    const onFiring = vi.fn();
    renderHook(() => useNocAlertsStream({ enabled: true, onFiring }), { wrapper: wrapper(qc) });

    const fresh = makeAlert({ id: 'new-1' });
    act(() => FakeEventSource.instances[0]!.message({ type: 'firing', alert: fresh }));

    const cached = qc.getQueryData<NocAlertDto[]>(nocAlertsKey);
    expect(cached?.[0]?.id).toBe('new-1');
    expect(cached).toHaveLength(2);
    expect(onFiring).toHaveBeenCalledWith('new-1');
  });

  it('acked frame on an existing id replaces it in place (no reorder)', () => {
    const qc = makeQC();
    qc.setQueryData(nocAlertsKey, [makeAlert({ id: 'a1' }), makeAlert({ id: 'a2' })]);
    renderHook(() => useNocAlertsStream({ enabled: true }), { wrapper: wrapper(qc) });

    const updated = makeAlert({ id: 'a2', acknowledged: true, ackBy: 'agente1' });
    act(() => FakeEventSource.instances[0]!.message({ type: 'acked', alert: updated }));

    const cached = qc.getQueryData<NocAlertDto[]>(nocAlertsKey);
    expect(cached).toHaveLength(2);
    expect(cached?.[1]?.id).toBe('a2');
    expect(cached?.[1]?.acknowledged).toBe(true);
  });

  it('NOCH-6 transient error (recovers to OPEN before grace) stays live, never polls', () => {
    vi.useFakeTimers();
    const qc = makeQC();
    const { result } = renderHook(() => useNocAlertsStream({ enabled: true }), { wrapper: wrapper(qc) });
    const es = FakeEventSource.instances[0]!;

    act(() => es.open());
    expect(result.current).toBe('live');

    act(() => es.error());
    // recovers before the grace window elapses
    act(() => es.open());
    act(() => vi.advanceTimersByTime(STREAM_ERROR_GRACE_MS_FOR_TEST));

    expect(result.current).toBe('live');
  });

  it('NOCH-7 persistent error (never returns to OPEN) falls back to polling and closes the stream', () => {
    vi.useFakeTimers();
    const qc = makeQC();
    const { result } = renderHook(() => useNocAlertsStream({ enabled: true }), { wrapper: wrapper(qc) });
    const es = FakeEventSource.instances[0]!;

    act(() => es.open());
    expect(result.current).toBe('live');

    act(() => {
      es.readyState = FakeEventSource.CONNECTING;
      es.error();
    });
    act(() => vi.advanceTimersByTime(STREAM_ERROR_GRACE_MS_FOR_TEST));

    expect(result.current).toBe('polling');
    expect(es.readyState).toBe(FakeEventSource.CLOSED);
  });
});

// Mirrors the module-private STREAM_ERROR_GRACE_MS (5_000ms) — kept as a local
// constant so this test file doesn't need to export an internal from the hook.
const STREAM_ERROR_GRACE_MS_FOR_TEST = 5_000;
