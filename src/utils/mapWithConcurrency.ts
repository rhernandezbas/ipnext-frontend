/**
 * Maps `items` through async `fn` with at most `limit` concurrent executions —
 * a worker-pool model: up to `limit` workers each pull the next index until the
 * queue drains. Pure (no infra). FE port of the BE util (src/application/util).
 *
 * Unlike the BE version, this one CAPTURES per-item rejections itself: when
 * `fn(item)` rejects, the source `item` is collected into `failedItems` instead
 * of propagating. Successful return values land in `results` in completion-safe
 * order (one entry per success). Bulk callers use `failedItems` to re-select
 * only the rows that failed, so the operator can retry them.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<{ results: R[]; failedItems: T[] }> {
  // Per-index slots keep success/failure aligned to the source order, so the
  // final results/failedItems arrays mirror the input order regardless of which
  // worker finished first.
  const outcomes = new Array<{ ok: true; value: R } | { ok: false }>(items.length);
  const workers = Math.max(1, Math.min(limit, items.length));
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      try {
        outcomes[index] = { ok: true, value: await fn(items[index]) };
      } catch {
        outcomes[index] = { ok: false };
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));

  const results: R[] = [];
  const failedItems: T[] = [];
  for (let i = 0; i < items.length; i++) {
    const outcome = outcomes[i];
    if (outcome.ok) results.push(outcome.value);
    else failedItems.push(items[i]);
  }
  return { results, failedItems };
}
