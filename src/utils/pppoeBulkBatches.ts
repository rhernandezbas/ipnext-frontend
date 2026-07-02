/**
 * Chunking + sequential batch orchestration for the PPPoE bulk change-plan
 * "select all of the filter" flow (pppoe-bulk-select-filter v2).
 *
 * The BE bulk endpoint (`POST /pppoe/bulk/change-plan`) keeps its per-request
 * cap of 200 ids (MAX_BULK_IDS, unchanged — NOT touched by this change). For
 * selections above that cap the FE partitions the ids into batches of <=200
 * and sends them SEQUENTIALLY (never in parallel — a burst of parallel bulk
 * requests would hammer the RADIUS). Results across batches are aggregated
 * into one summary.
 *
 * Full-batch rejection (network down / 500 / 401 — NOT the per-item `failed`
 * entries inside a resolved 200) cuts the remaining batches and reports what
 * was already applied plus which batch it cut at. Individual `failed` items
 * are best-effort (existing bulk semantics) and never cut the run.
 */

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

export interface RunPppoeBulkBatchesResult extends PppoeBulkBatchResult {
  /** null = every batch was sent; non-null = a batch rejected and the rest were skipped. */
  cut: PppoeBulkBatchCut | null;
}

/**
 * Sends `ids` in sequential batches of `batchSize` (default 200) via
 * `sendBatch`. Aggregates `{ ok, failed }` across ALL batches sent.
 * If `sendBatch` REJECTS for a batch (full-batch failure), cuts the
 * remaining batches and returns the partial aggregate with `cut` set.
 * Per-item `failed` entries inside a resolved batch do NOT cut the run.
 */
export async function runPppoeBulkBatches(
  ids: readonly string[],
  sendBatch: (batchIds: string[]) => Promise<PppoeBulkBatchResult>,
  opts: { batchSize?: number; onProgress?: (progress: PppoeBulkBatchProgress) => void } = {},
): Promise<RunPppoeBulkBatchesResult> {
  const batchSize = opts.batchSize ?? 200;
  const batches = chunkIds(ids, batchSize);
  const result: RunPppoeBulkBatchesResult = { ok: [], failed: [], cut: null };

  for (let i = 0; i < batches.length; i++) {
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
      return result;
    }
  }
  return result;
}
