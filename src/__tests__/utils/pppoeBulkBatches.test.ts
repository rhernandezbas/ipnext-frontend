/**
 * TDD — pppoeBulkBatches (pppoe-bulk-select-filter v2, tasks 4.1-4.3).
 * `chunkIds` is a pure helper (no React, no api) tested in isolation.
 * `runPppoeBulkBatches` is the sequential orchestrator, tested with a fake
 * `sendBatch` (mirrors bulkChangePlan) — no React, no real HTTP.
 */
import { describe, it, expect, vi } from 'vitest';
import { chunkIds, runPppoeBulkBatches, BULK_BATCH_SIZE } from '@/utils/pppoeBulkBatches';
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
// chunkIds — tamaño de lote 25 (fix pppoe-bulk-batch-timeout: BULK_BATCH_SIZE
// baja de 200 a 25 porque un lote de 200 con throttle de 300ms tarda 2-4min y
// el proxy corta la conexión antes de que la respuesta vuelva).
// ─────────────────────────────────────────────────────────────────────────────
describe('chunkIds — tamaño de lote 25 (BULK_BATCH_SIZE, fix timeout)', () => {
  it('26 ids → 2 lotes (25 + 1)', () => {
    const ids = Array.from({ length: 26 }, (_, i) => `id-${i}`);
    const chunks = chunkIds(ids, 25);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(25);
    expect(chunks[1]).toHaveLength(1);
  });

  it('25 ids → 1 solo lote de 25 (múltiplo exacto)', () => {
    const ids = Array.from({ length: 25 }, (_, i) => `id-${i}`);
    const chunks = chunkIds(ids, 25);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(25);
  });

  it('24 ids → 1 solo lote de 24', () => {
    const ids = Array.from({ length: 24 }, (_, i) => `id-${i}`);
    const chunks = chunkIds(ids, 25);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(24);
  });

  it('60 ids con tamaño 25 → 3 lotes (25 + 25 + 10)', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `id-${i}`);
    const chunks = chunkIds(ids, 25);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(25);
    expect(chunks[1]).toHaveLength(25);
    expect(chunks[2]).toHaveLength(10);
  });

  it('BULK_BATCH_SIZE exportado es 25', () => {
    expect(BULK_BATCH_SIZE).toBe(25);
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
  // Nota fix pppoe-bulk-batch-timeout + ola 2: `unconfirmed` y `cancelled` son
  // campos NUEVOS (aditivos) del resultado — este test se reescribe
  // honestamente para incluirlos (antes el toEqual exacto no los contemplaba
  // porque no existían).
  it('selección vacía: no llama a sendBatch, agregado vacío, sin corte, sin unconfirmed, sin cancelled', async () => {
    const sendBatch = vi.fn();
    const result = await runPppoeBulkBatches([], sendBatch, { batchSize: 200 });
    expect(sendBatch).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: [], failed: [], cut: null, unconfirmed: [], cancelled: null });
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

// ─────────────────────────────────────────────────────────────────────────────
// runPppoeBulkBatches — default de batchSize (fix pppoe-bulk-batch-timeout):
// sin `batchSize` explícito, el default deja de ser 200 y pasa a ser
// BULK_BATCH_SIZE (25).
// ─────────────────────────────────────────────────────────────────────────────
describe('runPppoeBulkBatches — default de batchSize es BULK_BATCH_SIZE (25), no 200', () => {
  it('sin opts, 30 ids → 2 requests (25 + 5), NO 1 request de 30', async () => {
    const ids = makeIds(30);
    const sendBatch = vi.fn().mockImplementation(async (batch: string[]) => ({ ok: batch, failed: [] }));

    await runPppoeBulkBatches(ids, sendBatch);

    expect(sendBatch).toHaveBeenCalledTimes(2);
    expect(sendBatch.mock.calls[0][0]).toHaveLength(25);
    expect(sendBatch.mock.calls[1][0]).toHaveLength(5);
  });

  it('sin opts, 25 ids → 1 solo request', async () => {
    const ids = makeIds(25);
    const sendBatch = vi.fn().mockResolvedValueOnce({ ok: ids, failed: [] });

    await runPppoeBulkBatches(ids, sendBatch);

    expect(sendBatch).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runPppoeBulkBatches — campo `unconfirmed` (fix pppoe-bulk-batch-timeout):
// el corte por rechazo de TRANSPORTE ya no puede afirmar "0 aplicados" — el
// lote rechazado queda con estado DESCONOCIDO (`unconfirmed`), distinto de los
// lotes que sí resolvieron (`ok`/`failed`, best-effort real).
// ─────────────────────────────────────────────────────────────────────────────
describe('runPppoeBulkBatches — `unconfirmed` en el corte (semántica honesta)', () => {
  it('sin corte, unconfirmed es un array vacío', async () => {
    const ids = makeIds(50);
    const sendBatch = vi.fn().mockResolvedValue({ ok: ids, failed: [] });
    const result = await runPppoeBulkBatches(ids, sendBatch, { batchSize: 25 });
    expect(result.unconfirmed).toEqual([]);
  });

  it('un rechazo de transporte expone unconfirmed = los ids EXACTOS del lote rechazado', async () => {
    const ids = makeIds(75); // 3 lotes de 25 con batchSize:25
    const batch1Result: PppoeBulkBatchResult = { ok: ids.slice(0, 25), failed: [] };
    const sendBatch = vi
      .fn()
      .mockResolvedValueOnce(batch1Result)
      .mockRejectedValueOnce(new Error('network down'));

    const result = await runPppoeBulkBatches(ids, sendBatch, { batchSize: 25 });

    expect(sendBatch).toHaveBeenCalledTimes(2); // el 3er lote nunca se manda
    expect(result.cut).toEqual({ cutAtBatch: 2, totalBatches: 3 });
    expect(result.unconfirmed).toEqual(ids.slice(25, 50));
  });

  it('preserva ok/failed del lote 1 Y expone unconfirmed del lote 2 cuando el lote 2 rechaza', async () => {
    const ids = makeIds(75);
    const batch1Ok = ids.slice(0, 20);
    const batch1Failed = ids.slice(20, 25).map((id) => ({ id, username: `u-${id}`, error: 'router caído' }));
    const sendBatch = vi
      .fn()
      .mockResolvedValueOnce({ ok: batch1Ok, failed: batch1Failed })
      .mockRejectedValueOnce(new Error('network down'));

    const result = await runPppoeBulkBatches(ids, sendBatch, { batchSize: 25 });

    expect(result.ok).toEqual(batch1Ok);
    expect(result.failed).toEqual(batch1Failed); // el corte no descarta los failed del lote 1
    expect(result.unconfirmed).toEqual(ids.slice(25, 50)); // el lote 2 entero, estado desconocido
    expect(result.cut).toEqual({ cutAtBatch: 2, totalBatches: 3 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runPppoeBulkBatches — `shouldCancel` / `cancelled` (ola 2, pedido del
// usuario 2026-07-02: "esto hazlo async, y que se pueda cortar todos"). El
// chequeo ocurre ANTES de mandar cada lote (incluido el primero) — a
// diferencia de `cut` (rechazo de transporte de un lote YA enviado),
// `cancelled` nunca deja nada en estado "en vuelo": el último lote enviado
// siempre resolvió (ok/failed reales) o nunca se mandó.
// ─────────────────────────────────────────────────────────────────────────────
describe('runPppoeBulkBatches — `shouldCancel`/`cancelled` (ola 2: cancelación real entre lotes)', () => {
  it('sin `shouldCancel`, `cancelled` queda null (comportamiento intacto)', async () => {
    const ids = makeIds(30);
    const sendBatch = vi.fn().mockImplementation(async (batch: string[]) => ({ ok: batch, failed: [] }));

    const result = await runPppoeBulkBatches(ids, sendBatch, { batchSize: 25 });

    expect(result.cancelled).toBeNull();
    expect(sendBatch).toHaveBeenCalledTimes(2);
  });

  it('`shouldCancel` ya es `true` desde el arranque: no manda NINGÚN lote, cancelled.atBatch=1', async () => {
    const ids = makeIds(50); // 2 lotes de 25
    const sendBatch = vi.fn();

    const result = await runPppoeBulkBatches(ids, sendBatch, { batchSize: 25, shouldCancel: () => true });

    expect(sendBatch).not.toHaveBeenCalled();
    expect(result.ok).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(result.cut).toBeNull();
    expect(result.cancelled).toEqual({ atBatch: 1, totalBatches: 2 });
  });

  it('4 lotes, cancela DESPUÉS de que el 2º resuelva: se envían 2, cancelled.atBatch=3, ok/failed solo de los enviados', async () => {
    const ids = makeIds(100); // 4 lotes de 25
    let cancelled = false;
    const sendBatch = vi.fn(async (batch: string[]): Promise<PppoeBulkBatchResult> => {
      const res = { ok: batch, failed: [] };
      // El operador corta recién DESPUÉS de que el 2º lote resuelve — simula
      // el click de "Cortar" mientras el lote 2 estaba en vuelo.
      if (sendBatch.mock.calls.length === 2) cancelled = true;
      return res;
    });

    const result = await runPppoeBulkBatches(ids, sendBatch, {
      batchSize: 25,
      shouldCancel: () => cancelled,
    });

    expect(sendBatch).toHaveBeenCalledTimes(2); // los lotes 3 y 4 NUNCA se mandan
    expect(result.ok).toEqual(ids.slice(0, 50)); // solo lo YA enviado
    expect(result.failed).toEqual([]);
    expect(result.cut).toBeNull(); // ambos lotes enviados resolvieron OK — no hubo rechazo de transporte
    expect(result.cancelled).toEqual({ atBatch: 3, totalBatches: 4 });
  });

  it('preserva los `failed` best-effort de los lotes enviados antes de cortar', async () => {
    const ids = makeIds(75); // 3 lotes de 25
    const batch1Ok = ids.slice(0, 20);
    const batch1Failed = ids.slice(20, 25).map((id) => ({ id, username: `u-${id}`, error: 'router caído' }));
    let cancelled = false;
    const sendBatch = vi
      .fn()
      .mockImplementationOnce(async () => {
        cancelled = true; // se corta DESPUÉS de que este lote resuelva
        return { ok: batch1Ok, failed: batch1Failed };
      });

    const result = await runPppoeBulkBatches(ids, sendBatch, { batchSize: 25, shouldCancel: () => cancelled });

    expect(sendBatch).toHaveBeenCalledTimes(1); // el lote 2 nunca se manda
    expect(result.ok).toEqual(batch1Ok);
    expect(result.failed).toEqual(batch1Failed);
    expect(result.cancelled).toEqual({ atBatch: 2, totalBatches: 3 });
  });

  // Interacción cancel+cut (documentada en el módulo): el operador corta
  // MIENTRAS el lote en vuelo termina rechazando por transporte — el
  // resultado lleva `cut` + `unconfirmed` Y `cancelled` a la vez, sobre el
  // MISMO lote (el que rechazó es, justamente, el que estaba en vuelo cuando
  // se pidió cortar).
  it('cut + cancelled combinados: el lote en vuelo rechaza por transporte MIENTRAS el operador ya había pedido cortar', async () => {
    const ids = makeIds(75); // 3 lotes de 25
    let cancelFlag = false;
    const sendBatch = vi
      .fn()
      .mockImplementationOnce(async (batch: string[]) => ({ ok: batch, failed: [] })) // lote 1 ok
      .mockImplementationOnce(async () => {
        cancelFlag = true; // el operador clickea "Cortar" MIENTRAS este lote está en vuelo
        throw new Error('network down'); // y el lote igual rechaza por transporte
      });

    const result = await runPppoeBulkBatches(ids, sendBatch, { batchSize: 25, shouldCancel: () => cancelFlag });

    expect(sendBatch).toHaveBeenCalledTimes(2); // el lote 3 NUNCA se manda
    expect(result.ok).toEqual(ids.slice(0, 25));
    expect(result.cut).toEqual({ cutAtBatch: 2, totalBatches: 3 });
    expect(result.unconfirmed).toEqual(ids.slice(25, 50));
    expect(result.cancelled).toEqual({ atBatch: 2, totalBatches: 3 }); // mismo lote que el `cut`
  });

  it('`shouldCancel` se chequea ANTES de `onProgress`/`sendBatch`: si ya está cancelado, ninguno de los dos se llama para ese lote', async () => {
    const ids = makeIds(50); // 2 lotes de 25
    const sendBatch = vi.fn();
    const onProgress = vi.fn();

    const result = await runPppoeBulkBatches(ids, sendBatch, {
      batchSize: 25,
      shouldCancel: () => true,
      onProgress,
    });

    expect(sendBatch).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
    expect(result.cancelled).toEqual({ atBatch: 1, totalBatches: 2 });
  });
});
