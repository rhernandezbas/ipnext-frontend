/**
 * TDD — pppoeBulkBatches (pppoe-bulk-select-filter v2, tasks 4.1-4.3).
 * `chunkIds` is a pure helper (no React, no api) tested in isolation.
 * `runPppoeBulkBatches` is the sequential orchestrator, tested with a fake
 * `sendBatch` (mirrors bulkChangePlan) — no React, no real HTTP.
 */
import { describe, it, expect, vi } from 'vitest';
import { chunkIds, runPppoeBulkBatches } from '@/utils/pppoeBulkBatches';
import type { PppoeBulkBatchResult } from '@/utils/pppoeBulkBatches';

// ─────────────────────────────────────────────────────────────────────────────
// chunkIds — pure, edge cases: 0/1/200/201/400/401
// ─────────────────────────────────────────────────────────────────────────────
describe('chunkIds', () => {
  it('devuelve [] para un array vacío', () => {
    expect(chunkIds([], 200)).toEqual([]);
  });

  it('un solo id → un solo lote de 1', () => {
    const ids = ['a'];
    expect(chunkIds(ids, 200)).toEqual([['a']]);
  });

  it('exactamente 200 → un solo lote de 200 (múltiplo exacto)', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `id-${i}`);
    const chunks = chunkIds(ids, 200);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(200);
  });

  it('201 → 2 lotes (200 + 1)', () => {
    const ids = Array.from({ length: 201 }, (_, i) => `id-${i}`);
    const chunks = chunkIds(ids, 200);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(200);
    expect(chunks[1]).toHaveLength(1);
  });

  it('400 → 2 lotes (200 + 200, múltiplo exacto)', () => {
    const ids = Array.from({ length: 400 }, (_, i) => `id-${i}`);
    const chunks = chunkIds(ids, 200);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(200);
    expect(chunks[1]).toHaveLength(200);
  });

  it('401 → 3 lotes (200 + 200 + 1)', () => {
    const ids = Array.from({ length: 401 }, (_, i) => `id-${i}`);
    const chunks = chunkIds(ids, 200);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(200);
    expect(chunks[1]).toHaveLength(200);
    expect(chunks[2]).toHaveLength(1);
  });

  it('340 → 2 lotes (200 + 140), preserva el orden de los ids', () => {
    const ids = Array.from({ length: 340 }, (_, i) => `id-${i}`);
    const chunks = chunkIds(ids, 200);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(200);
    expect(chunks[1]).toHaveLength(140);
    expect(chunks[0][0]).toBe('id-0');
    expect(chunks[0][199]).toBe('id-199');
    expect(chunks[1][0]).toBe('id-200');
    expect(chunks[1][139]).toBe('id-339');
  });

  it('size >= len → un solo lote con todos los ids', () => {
    const ids = ['a', 'b', 'c'];
    expect(chunkIds(ids, 200)).toEqual([['a', 'b', 'c']]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runPppoeBulkBatches — orquestador secuencial + agregación + corte
// ─────────────────────────────────────────────────────────────────────────────
function makeIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `id-${i}`);
}

describe('runPppoeBulkBatches — envío secuencial', () => {
  it('envía los lotes DE A UNO: el lote 2 no arranca hasta que el 1 resuelve', async () => {
    const order: string[] = [];
    const ids = makeIds(400);
    const sendBatch = vi.fn(async (batch: string[]): Promise<PppoeBulkBatchResult> => {
      order.push(`start-${batch.length}`);
      await new Promise((r) => setTimeout(r, 15));
      order.push(`end-${batch.length}`);
      return { ok: batch, failed: [] };
    });

    await runPppoeBulkBatches(ids, sendBatch, { batchSize: 200 });

    expect(order).toEqual(['start-200', 'end-200', 'start-200', 'end-200']);
    expect(sendBatch).toHaveBeenCalledTimes(2);
  });

  it('340 ids → 2 requests: el primero con 200, el segundo con 140', async () => {
    const ids = makeIds(340);
    const sendBatch = vi.fn(async (batch: string[]): Promise<PppoeBulkBatchResult> => ({
      ok: batch,
      failed: [],
    }));

    await runPppoeBulkBatches(ids, sendBatch, { batchSize: 200 });

    expect(sendBatch).toHaveBeenNthCalledWith(1, expect.arrayContaining(ids.slice(0, 200)));
    expect(sendBatch.mock.calls[0][0]).toHaveLength(200);
    expect(sendBatch.mock.calls[1][0]).toHaveLength(140);
  });

  it('reporta progreso por lote con batchIndex/totalBatches/totalIds', async () => {
    const ids = makeIds(340);
    const progresses: unknown[] = [];
    const sendBatch = vi.fn(async (batch: string[]): Promise<PppoeBulkBatchResult> => ({
      ok: batch,
      failed: [],
    }));

    await runPppoeBulkBatches(ids, sendBatch, {
      batchSize: 200,
      onProgress: (p) => progresses.push(p),
    });

    expect(progresses).toEqual([
      { batchIndex: 1, totalBatches: 2, batchIds: ids.slice(0, 200), totalIds: 340 },
      { batchIndex: 2, totalBatches: 2, batchIds: ids.slice(200), totalIds: 340 },
    ]);
  });
});

describe('runPppoeBulkBatches — agregación cross-lote', () => {
  it('agrega ok/failed de los 2 lotes en un resumen único (190+10 y 135+5 → ok=325, failed=15)', async () => {
    const ids = makeIds(340);
    const batch1Ok = ids.slice(0, 190);
    const batch1Failed = ids.slice(190, 200).map((id) => ({ id, username: `u-${id}`, error: 'router caído' }));
    const batch2Ok = ids.slice(200, 335);
    const batch2Failed = ids.slice(335, 340).map((id) => ({ id, username: `u-${id}`, error: 'PPPOE_NOT_FOUND' }));

    const sendBatch = vi
      .fn()
      .mockResolvedValueOnce({ ok: batch1Ok, failed: batch1Failed })
      .mockResolvedValueOnce({ ok: batch2Ok, failed: batch2Failed });

    const result = await runPppoeBulkBatches(ids, sendBatch, { batchSize: 200 });

    expect(result.ok).toHaveLength(325);
    expect(result.failed).toHaveLength(15);
    expect(result.failed).toEqual([...batch1Failed, ...batch2Failed]);
    expect(result.cut).toBeNull();
  });
});

describe('runPppoeBulkBatches — corte por fallo de lote entero', () => {
  it('500 ids (3 lotes): el 2º lote RECHAZA → corta, agrega solo el lote 1, no manda el 3º', async () => {
    const ids = makeIds(500); // 200 + 200 + 100
    const batch1Result: PppoeBulkBatchResult = { ok: ids.slice(0, 200), failed: [] };
    const sendBatch = vi
      .fn()
      .mockResolvedValueOnce(batch1Result)
      .mockRejectedValueOnce(new Error('network down'));

    const result = await runPppoeBulkBatches(ids, sendBatch, { batchSize: 200 });

    expect(sendBatch).toHaveBeenCalledTimes(2); // el 3er lote NUNCA se manda
    expect(result.ok).toEqual(batch1Result.ok);
    expect(result.failed).toEqual([]);
    expect(result.cut).toEqual({ cutAtBatch: 2, totalBatches: 3 });
  });

  it('los ítems `failed` individuales (best-effort, batch resuelve 200) NO cortan el envío', async () => {
    const ids = makeIds(340); // 2 lotes
    const sendBatch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: ids.slice(0, 150),
        failed: ids.slice(150, 200).map((id) => ({ id, username: `u-${id}`, error: 'router caído' })),
      })
      .mockResolvedValueOnce({ ok: ids.slice(200), failed: [] });

    const result = await runPppoeBulkBatches(ids, sendBatch, { batchSize: 200 });

    expect(sendBatch).toHaveBeenCalledTimes(2); // el lote 2 SÍ se envía
    expect(result.cut).toBeNull();
    expect(result.ok).toHaveLength(150 + 140);
    expect(result.failed).toHaveLength(50);
  });

  // W3 — el lote 1 resuelve OK PARCIAL (con `failed` poblado) y el lote 2
  // RECHAZA entero: el agregado debe preservar los `ok` Y LOS `failed` del
  // lote 1, además del corte reportado. Antes de este test solo había
  // cobertura de "lote 1 100% ok, lote 2 rechaza" — este caso pinea que el
  // corte no descarta los `failed` best-effort ya reportados por el lote 1.
  it('preserva los ok Y LOS FAILED del lote 1 cuando el lote 2 rechaza entero (corte)', async () => {
    const ids = makeIds(500); // 200 + 200 + 100
    const batch1Ok = ids.slice(0, 150);
    const batch1Failed = ids.slice(150, 200).map((id) => ({ id, username: `u-${id}`, error: 'router caído' }));
    const sendBatch = vi
      .fn()
      .mockResolvedValueOnce({ ok: batch1Ok, failed: batch1Failed })
      .mockRejectedValueOnce(new Error('network down'));

    const result = await runPppoeBulkBatches(ids, sendBatch, { batchSize: 200 });

    expect(sendBatch).toHaveBeenCalledTimes(2); // el 3er lote NUNCA se manda
    expect(result.ok).toEqual(batch1Ok);
    expect(result.failed).toEqual(batch1Failed); // el corte NO descarta los failed del lote 1
    expect(result.cut).toEqual({ cutAtBatch: 2, totalBatches: 3 });
  });
});

describe('runPppoeBulkBatches — casos borde', () => {
  it('selección vacía: no llama a sendBatch, agregado vacío, sin corte', async () => {
    const sendBatch = vi.fn();
    const result = await runPppoeBulkBatches([], sendBatch, { batchSize: 200 });
    expect(sendBatch).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: [], failed: [], cut: null });
  });

  it('N<=200 (un solo lote): un único request, sin corte', async () => {
    const ids = makeIds(150);
    const sendBatch = vi.fn().mockResolvedValueOnce({ ok: ids, failed: [] });
    const result = await runPppoeBulkBatches(ids, sendBatch, { batchSize: 200 });
    expect(sendBatch).toHaveBeenCalledTimes(1);
    expect(result.ok).toEqual(ids);
    expect(result.cut).toBeNull();
  });
});
