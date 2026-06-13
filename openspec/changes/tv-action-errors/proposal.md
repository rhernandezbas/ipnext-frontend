# Change Proposal: tv-action-errors (FE side)

## Issues
- #1 — After an OTT toggle error the chip showed stale state; user had to log out/in.
- #4 — The "link CIC" action sometimes returned a 500 (INTERNAL_ERROR) from the BE
  even though the action had already succeeded on the partner side. The UI kept the
  pre-action cache and showed a "link failed" state that did not match reality.

## Root Cause
`useSetOtt` and `useLinkCic` only called `qc.invalidateQueries` inside `onSuccess`.
When the BE returned an error the mutation settled in `onError` and the cache was never
invalidated — so the UI was left showing whatever state it had before the action, not
the actual server state.

## Fix (FE)
Both hooks now also invalidate in `onError`:

### `useSetOtt` (`~line 207`, `src/hooks/useGigared.ts`)
- `onError` → `qc.invalidateQueries({ queryKey: accountKey(customerId) })`
- Scope is narrow (per-customer account only). `ALL_ACCOUNTS_ROOT` is invalidated
  only on success to avoid a full-list re-fetch for a failed OTT toggle.

### `useLinkCic` (`~line 144`, `src/hooks/useGigared.ts`)
- Extract a shared `invalidateLinkCicKeys()` helper used by both `onSuccess` and
  `onError`, covering:
  - `accountKey(customerId)`
  - `SUMMARY_KEY`
  - `ACCOUNTS_ROOT`
  - `ALL_ACCOUNTS_ROOT`
  - `['client-contracts', customerId]`
- `onSuccess` additionally invalidates `SERVICE_HISTORY_ROOT` (unchanged behaviour).
- `onError` calls only the shared helper (no service-history invalidation on error —
  a failed link does not modify the service history).

### `ACCOUNTS_ROOT` export
`ACCOUNTS_ROOT` was previously module-private. It is now exported so tests can assert
against the exact key reference.

## BE side
The BE already returns a structured `{ error, code: 'INTERNAL_ERROR' }` on 500. No FE
change is needed to parse that beyond the existing `errorDetail` handling in the API
layer. The FE fix is purely about cache invalidation on error.

## Tests
File: `src/__tests__/hooks/useGigared.test.ts`

New describe blocks added (7 new tests, all TDD red → green):
- `#1 fix — useSetOtt invalidates account on error` (2 tests)
- `#4 fix — useLinkCic invalidates full set on error` (5 tests — one per key)

All 23 tests pass. `tsc --noEmit` clean.
