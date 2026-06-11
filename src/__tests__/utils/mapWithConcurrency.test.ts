/**
 * TDD — mapWithConcurrency (FE, #46 AD-7).
 * Worker-pool with bounded concurrency. Unlike the BE copy, the FE version
 * captures per-item rejections itself and returns { results, failedItems } so
 * bulk callers can keep ONLY the failed selection without wrapping fn in a
 * try/catch at every call site.
 */
import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from '@/utils/mapWithConcurrency';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('mapWithConcurrency (FE)', () => {
  it('processes ALL items and preserves order (results[i] <-> items[i])', async () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const { results, failedItems } = await mapWithConcurrency(items, 3, async (n) => {
      await tick(Math.random() * 5);
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(failedItems).toEqual([]);
  });

  it('never runs more than `limit` fns at once', async () => {
    let active = 0;
    let maxObserved = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);

    await mapWithConcurrency(items, 5, async (n) => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await tick(5 + (n % 3) * 3);
      active--;
      return n;
    });

    expect(maxObserved).toBeLessThanOrEqual(5);
    expect(maxObserved).toBeGreaterThan(1);
  });

  it('collects the SOURCE items whose fn rejected into failedItems', async () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const { results, failedItems } = await mapWithConcurrency(items, 2, async (item) => {
      if (item === 'b' || item === 'd') throw new Error(`boom ${item}`);
      return item.toUpperCase();
    });
    // Only the successful results land in `results`; order among successes preserved.
    expect(results).toEqual(['A', 'C', 'E']);
    expect(failedItems).toEqual(['b', 'd']);
  });

  it('handles an empty list', async () => {
    const { results, failedItems } = await mapWithConcurrency([], 5, async (n) => n);
    expect(results).toEqual([]);
    expect(failedItems).toEqual([]);
  });

  it('handles a limit larger than the item count', async () => {
    const { results, failedItems } = await mapWithConcurrency([1, 2], 10, async (n) => n + 1);
    expect(results).toEqual([2, 3]);
    expect(failedItems).toEqual([]);
  });
});
