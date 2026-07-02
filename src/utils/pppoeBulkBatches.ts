/**
 * Chunking + sequential batch orchestration for the PPPoE bulk change-plan
 * "select all of the filter" flow (pppoe-bulk-select-filter v2, hardened by
 * pppoe-bulk-batch-timeout, ola 2: cancelación real).
 *
 * The BE bulk endpoint (`POST /pppoe/bulk/change-plan`) keeps its per-request
 * cap of 200 ids (MAX_BULK_IDS, unchanged — NOT touched by this change). The
 * FE's own batch size is SEPARATE and much smaller: `BULK_BATCH_SIZE = 25`
 * (fix pppoe-bulk-batch-timeout — a lote of 200 items with a 300ms per-item
 * throttle on the BE takes 2-4 minutes; the proxy cuts the connection well
 * before that, well under the BE's own cap). Selections above `BULK_BATCH_SIZE`
 * are partitioned into batches of <=`BULK_BATCH_SIZE` and sent SEQUENTIALLY
 * (never in parallel — a burst of parallel bulk requests would hammer the
 * RADIUS). Results across batches are aggregated into one summary.
 *
 * Full-batch rejection (network down / proxy timeout / 500 / 401 — NOT the
 * per-item `failed` entries inside a resolved 200) cuts the remaining batches.
 * IMPORTANT (pppoe-bulk-batch-timeout): a transport-level rejection does NOT
 * mean the BE didn't apply the batch — the BE may keep processing in the
 * background after the proxy drops the connection (confirmed in prod: a
 * "rejected" batch of 200 was fully applied server-side). The rejected
 * batch's ids are reported as `unconfirmed` (status unknown), NEVER as
 * "0 applied". Individual `failed` items are best-effort (existing bulk
 * semantics) and never cut the run.
 *
 * OLA 2 (pedido del usuario 2026-07-02) — cancelación real del operador:
 * `shouldCancel` es chequeada ANTES de enviar cada lote (incluido el primero).
 * Si devuelve `true`, el orquestador NO manda más lotes y reporta `cancelled`
 * (`{ atBatch, totalBatches }` — en el caso PURO, sin `cut`, `atBatch` es el
 * índice 1-based del PRIMER lote que YA NO se envía; ver el JSDoc de
 * `PppoeBulkBatchCancelled` para el caso cut+cancelled, donde `atBatch` es en
 * cambio el lote que SÍ se mandó y rechazó — fix re-review F2). `cancelled`
 * es un campo DISTINTO de `cut`: el corte por transporte deja un lote en
 * estado `unconfirmed` (rechazó mid-vuelo, estado desconocido); la
 * cancelación del operador NUNCA deja nada `unconfirmed` — el chequeo ocurre
 * ANTES de enviar, así que el último lote enviado siempre llegó a resolver
 * (ok/failed reales) o nunca se mandó.
 * Interacción cancel+cut: si el operador cancela MIENTRAS el lote en vuelo
 * termina rechazando por transporte, el resultado lleva `cut` + `unconfirmed`
 * Y `cancelled` a la vez (ver el chequeo extra dentro del `catch`) — el
 * consumidor (UI) debe priorizar el mensaje de `cut` (más grave) y sumar la
 * nota de cancelación manual.
 */

/**
 * Batch size the FE uses for sequential bulk sends (pppoe-bulk-batch-timeout).
 * Deliberately SMALL and separate from the BE's per-request guard (200,
 * MAX_BULK_IDS, unchanged) and from the FE's selection/confirmation cap
 * (BULK_SELECTION_CAP=200 in PppoeManagementTab.tsx, also unchanged) — a
 * batch of 25 items takes ~10-30s even with the BE's serial 300ms throttle,
 * comfortably inside any proxy timeout.
 */
export const BULK_BATCH_SIZE = 25;

/** Pure — splits `arr` into chunks of at most `size` items each, preserving order. */
export function chunkIds<T>(arr: readonly T[], size: number): T[][] {
  if (size <= 0) throw new Error('chunkIds: size must be > 0');
  if (arr.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Shape of a single batch's result — mirrors `BulkChangePlanResult` (pppoe.api.ts). */
export interface PppoeBulkBatchResult {
  ok: string[];
  failed: { id: string; username: string; error: string }[];
}

export interface PppoeBulkBatchProgress {
  /** 1-based index of the batch currently in flight. */
  batchIndex: number;
  totalBatches: number;
  /** ids in this specific batch. */
  batchIds: string[];
  /** total ids across ALL batches (the full selection). */
  totalIds: number;
}

export interface PppoeBulkBatchCut {
  cutAtBatch: number;
  totalBatches: number;
}

/**
 * Ola 2 (pedido del usuario 2026-07-02): cancelación real del operador.
 *
 * `atBatch` es 1-based, pero su significado depende de si convive con `cut`
 * (fix re-review F2 — el doc original solo cubría el caso sin `cut`):
 * - Cancelación PURA (sin `cut`): `atBatch` es el índice del PRIMER lote que
 *   NO se envía por la cancelación — los lotes `1..atBatch-1` sí se enviaron
 *   y resolvieron (ok/failed reales).
 * - Cancelación + `cut` (lote en vuelo rechazado por transporte justo cuando
 *   se pedía cortar — ver doc de módulo): acá `atBatch` coincide con
 *   `cut.cutAtBatch`, el lote que SÍ se envió y rechazó (no uno sin enviar).
 *   La UI (PppoeManagementTab.tsx) nunca muestra `atBatch` numéricamente en
 *   este caso — el mensaje de `cut` (más grave, estado desconocido) es el
 *   primario y solo se suma una nota de que además hubo corte manual.
 */
export interface PppoeBulkBatchCancelled {
  atBatch: number;
  totalBatches: number;
}

export interface RunPppoeBulkBatchesResult extends PppoeBulkBatchResult {
  /** null = every batch was sent; non-null = a batch rejected and the rest were skipped. */
  cut: PppoeBulkBatchCut | null;
  /**
   * Ids of the batch that REJECTED by transport failure (network down / proxy
   * timeout — the cause of the `cut`). Their server-side status is UNKNOWN:
   * the BE may have finished applying them after the connection dropped
   * (pppoe-bulk-batch-timeout — confirmed in prod). Empty when `cut` is null.
   * Batches after the cut point are never sent and are NOT included here —
   * they stay implicitly unconfirmed too (never added to `ok`/`failed`).
   */
  unconfirmed: string[];
  /**
   * Ola 2: null = el operador NUNCA pidió cortar (o no se pasó `shouldCancel`).
   * Non-null = la corrida se detuvo porque `shouldCancel()` devolvió `true`
   * antes de mandar el lote `atBatch`. Puede convivir con `cut` (ver doc de
   * módulo) — en ese caso el lote `atBatch` coincide con el lote que rechazó.
   */
  cancelled: PppoeBulkBatchCancelled | null;
}

/**
 * Sends `ids` in sequential batches of `batchSize` (default `BULK_BATCH_SIZE`,
 * 25) via `sendBatch`. Aggregates `{ ok, failed }` across ALL batches sent.
 * If `sendBatch` REJECTS for a batch (full-batch transport failure), cuts the
 * remaining batches, reports that batch's ids as `unconfirmed` (status
 * unknown — NOT "0 applied", see module doc), and returns the partial
 * aggregate with `cut` set. Per-item `failed` entries inside a resolved batch
 * do NOT cut the run.
 *
 * Ola 2: `opts.shouldCancel` (if provided) is checked BEFORE sending every
 * batch, including the first. A `true` return stops the run immediately —
 * see `cancelled` in the result and the module doc for the cancel+cut
 * interaction.
 */
export async function runPppoeBulkBatches(
  ids: readonly string[],
  sendBatch: (batchIds: string[]) => Promise<PppoeBulkBatchResult>,
  opts: {
    batchSize?: number;
    onProgress?: (progress: PppoeBulkBatchProgress) => void;
    shouldCancel?: () => boolean;
  } = {},
): Promise<RunPppoeBulkBatchesResult> {
  const batchSize = opts.batchSize ?? BULK_BATCH_SIZE;
  const batches = chunkIds(ids, batchSize);
  const result: RunPppoeBulkBatchesResult = {
    ok: [],
    failed: [],
    cut: null,
    unconfirmed: [],
    cancelled: null,
  };

  for (let i = 0; i < batches.length; i++) {
    // Ola 2: chequeo de cancelación ANTES de mandar el lote — si el operador
    // ya pidió cortar, ni siquiera se dispara el request de este lote.
    if (opts.shouldCancel?.()) {
      result.cancelled = { atBatch: i + 1, totalBatches: batches.length };
      return result;
    }
    const batchIds = batches[i];
    opts.onProgress?.({
      batchIndex: i + 1,
      totalBatches: batches.length,
      batchIds,
      totalIds: ids.length,
    });
    try {
      // Sequential by construction: each iteration awaits before the next starts.
      const res = await sendBatch(batchIds);
      result.ok.push(...res.ok);
      result.failed.push(...res.failed);
    } catch {
      result.cut = { cutAtBatch: i + 1, totalBatches: batches.length };
      result.unconfirmed = batchIds;
      // Ola 2: el operador pudo haber cortado MIENTRAS este lote estaba en
      // vuelo (rechazó por transporte de todos modos) — ambos campos conviven.
      if (opts.shouldCancel?.()) {
        result.cancelled = { atBatch: i + 1, totalBatches: batches.length };
      }
      return result;
    }
  }
  return result;
}
