/**
 * useRadiusAuthFailures — rango relativo (ventana deslizante) + auto-refresh.
 *
 * Diseño clave (ventana deslizante):
 *   - El PRESET (`relativeRange`) viaja en el queryKey, NO el `from` calculado.
 *   - La `queryFn` calcula `from = new Date(Date.now() - ms)` AL MOMENTO del fetch.
 *   - Resultado: el queryKey es ESTABLE para un preset dado (no cambia con el tiempo),
 *     así el refetchInterval desliza la ventana sin invalidar el cache → sin
 *     refetch-storm.
 *
 * Estrategia de test: mockeamos `useQuery` para CAPTURAR las options que el hook
 * construye (queryKey / queryFn / refetchInterval). Como el hook sólo llama a
 * `useQuery`, podemos invocarlo como función pura (sin render) y verificar el
 * contrato sin depender de la maquinaria asíncrona de TanStack.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...actual, useQuery: vi.fn() };
});

vi.mock('@/api/networkAudit.api', () => ({
  getRadiusEvents: vi.fn(),
  getNe8000Audit: vi.fn(),
  getRadiusAuthFailures: vi.fn(),
}));

import { useQuery } from '@tanstack/react-query';
import { getRadiusAuthFailures } from '@/api/networkAudit.api';
import {
  useRadiusAuthFailures,
  RELATIVE_RANGE_MS,
} from '@/hooks/useRadiusAuthFailures';
import type { UseRadiusAuthFailuresOptions } from '@/hooks/useRadiusAuthFailures';
import type { PaginatedRadiusAuthEvents } from '@/types/networkAudit';

const NOW = new Date('2026-06-30T12:00:00.000Z');

const PAGINATED: PaginatedRadiusAuthEvents = {
  data: [],
  total: 0,
  page: 1,
  limit: 50,
  hasNext: false,
  countsByReason: { session_stuck: 0, user_not_found: 0, other: 0 },
};

/** Captura las options que el hook pasa a useQuery (invocándolo como función pura). */
function captureOptions(arg: UseRadiusAuthFailuresOptions) {
  let captured: Record<string, unknown> = {};
  vi.mocked(useQuery).mockImplementation((opts: unknown) => {
    captured = opts as Record<string, unknown>;
    return { data: undefined } as unknown as ReturnType<typeof useQuery>;
  });
  useRadiusAuthFailures(arg);
  return captured as {
    queryKey: [string, Record<string, unknown>];
    queryFn: () => Promise<unknown>;
    refetchInterval: number | false;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(getRadiusAuthFailures).mockResolvedValue(PAGINATED);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useRadiusAuthFailures — ventana deslizante (relativeRange)', () => {
  it('el queryKey lleva el PRESET, no el `from` calculado', () => {
    const opts = captureOptions({ relativeRange: '5m', reply: 'Access-Reject' });
    expect(opts.queryKey[0]).toBe('radius-auth-failures');
    expect(opts.queryKey[1]).toMatchObject({ relativeRange: '5m', reply: 'Access-Reject' });
    // El `from` NO está en el queryKey (se calcula recién en la queryFn).
    expect(opts.queryKey[1].from).toBeUndefined();
  });

  it('el queryKey es ESTABLE para un mismo preset aunque avance el reloj (sin refetch-storm)', () => {
    const a = captureOptions({ relativeRange: '5m', reply: 'Access-Reject' });
    // Avanza el reloj 3 minutos — simula renders posteriores / ticks del auto-refresh.
    vi.setSystemTime(new Date(NOW.getTime() + 3 * 60_000));
    const b = captureOptions({ relativeRange: '5m', reply: 'Access-Reject' });
    expect(a.queryKey).toEqual(b.queryKey);
  });

  it('la queryFn calcula from = now - 5min al momento del fetch ("5m")', async () => {
    const opts = captureOptions({ relativeRange: '5m', reply: 'Access-Reject' });
    await opts.queryFn();
    expect(getRadiusAuthFailures).toHaveBeenCalledWith(
      expect.objectContaining({
        from: new Date(NOW.getTime() - RELATIVE_RANGE_MS['5m']).toISOString(),
        reply: 'Access-Reject',
      }),
    );
  });

  it('la ventana DESLIZA: dos fetches en momentos distintos calculan `from` distintos con el mismo queryKey', async () => {
    const opts1 = captureOptions({ relativeRange: '5m' });
    await opts1.queryFn();
    const firstFrom = vi.mocked(getRadiusAuthFailures).mock.calls[0][0].from;

    // 2 minutos después, el MISMO preset → nuevo fetch con `from` corrido.
    vi.setSystemTime(new Date(NOW.getTime() + 2 * 60_000));
    const opts2 = captureOptions({ relativeRange: '5m' });
    await opts2.queryFn();
    const secondFrom = vi.mocked(getRadiusAuthFailures).mock.calls[1][0].from;

    expect(secondFrom).not.toBe(firstFrom);
    expect(new Date(secondFrom!).getTime() - new Date(firstFrom!).getTime()).toBe(2 * 60_000);
    // Pero el queryKey no cambió → no se invalida el cache.
    expect(opts1.queryKey).toEqual(opts2.queryKey);
  });

  it.each([
    ['5m', 5 * 60_000],
    ['1h', 60 * 60_000],
    ['24h', 24 * 60 * 60_000],
    ['7d', 7 * 24 * 60 * 60_000],
  ] as const)('preset "%s" → from = now - %d ms', async (range, ms) => {
    const opts = captureOptions({ relativeRange: range });
    await opts.queryFn();
    expect(getRadiusAuthFailures).toHaveBeenCalledWith(
      expect.objectContaining({ from: new Date(NOW.getTime() - ms).toISOString() }),
    );
  });

  it('en modo relativo la queryFn ignora cualquier `to` (sólo ventana hasta ahora)', async () => {
    const opts = captureOptions({ relativeRange: '1h' });
    await opts.queryFn();
    const callArg = vi.mocked(getRadiusAuthFailures).mock.calls[0][0];
    expect(callArg.to).toBeUndefined();
  });

  it('sin relativeRange usa el rango absoluto from/to tal cual (modo absoluto)', async () => {
    const opts = captureOptions({ from: '2026-06-01', to: '2026-06-30', reply: 'Access-Reject' });
    await opts.queryFn();
    expect(getRadiusAuthFailures).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-06-01', to: '2026-06-30' }),
    );
  });

  it('NO reenvía relativeRange ni autoRefresh al API (los consume el hook)', async () => {
    const opts = captureOptions({ relativeRange: '5m', autoRefresh: true });
    await opts.queryFn();
    const callArg = vi.mocked(getRadiusAuthFailures).mock.calls[0][0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty('relativeRange');
    expect(callArg).not.toHaveProperty('autoRefresh');
  });
});

describe('useRadiusAuthFailures — auto-refresh (refetchInterval condicional)', () => {
  it('refetchInterval = 30000 cuando autoRefresh está ON', () => {
    const opts = captureOptions({ relativeRange: '5m', autoRefresh: true });
    expect(opts.refetchInterval).toBe(30_000);
  });

  it('refetchInterval = false cuando autoRefresh está OFF', () => {
    const opts = captureOptions({ relativeRange: '5m', autoRefresh: false });
    expect(opts.refetchInterval).toBe(false);
  });

  it('refetchInterval = false por defecto (sin autoRefresh)', () => {
    const opts = captureOptions({ reply: 'Access-Reject' });
    expect(opts.refetchInterval).toBe(false);
  });

  it('autoRefresh NO viaja en el queryKey (es flag de comportamiento, no de datos)', () => {
    const opts = captureOptions({ relativeRange: '5m', autoRefresh: true });
    expect(opts.queryKey[1]).not.toHaveProperty('autoRefresh');
  });

  // BAJO 3: el auto-refresh sólo corre con la pestaña visible → NO se setea
  // refetchIntervalInBackground (queda en el default `false` de TanStack).
  it('NO setea refetchIntervalInBackground (sólo refresca con la pestaña visible)', () => {
    const opts = captureOptions({ relativeRange: '5m', autoRefresh: true });
    expect((opts as Record<string, unknown>).refetchIntervalInBackground).toBeUndefined();
  });
});

// ── MEDIO 1 (defensa en profundidad): la queryFn se blinda contra un preset raro ──
// Si un valor fuera de RELATIVE_RANGE_MS se cuela por otra vía (casteo), la
// queryFn NO debe tirar RangeError por `new Date(NaN)`: cae al modo absoluto.
describe('useRadiusAuthFailures — guard defensivo de la queryFn (preset raro)', () => {
  it('un relativeRange fuera de RELATIVE_RANGE_MS NO lanza RangeError y cae al modo absoluto', async () => {
    const opts = captureOptions({ relativeRange: 'nope' } as unknown as UseRadiusAuthFailuresOptions);
    await expect(opts.queryFn()).resolves.toBeDefined();
    const callArg = vi.mocked(getRadiusAuthFailures).mock.calls[0][0];
    // No se calculó un `from` relativo basura (NaN.toISOString()).
    expect(callArg.from).toBeUndefined();
  });
});
