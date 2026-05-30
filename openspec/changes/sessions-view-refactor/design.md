# Design — sessions-view-refactor (Frontend)

**Change**: `sessions-view-refactor`
**Repo**: `ipnext-frontend`
**Stack**: React 18 + TypeScript + Vite · TanStack Query · CSS Modules · Vitest + Testing Library
**Constraint**: `useActiveSessions` and `useRevokeSession` MUST NOT be modified. Non-regression is structural.

---

## 1. API layer — `getSessionHistory` in `sessions.api.ts`

**Extension**: new exported function added to the existing `sessionsApi` object (or as a standalone named export if the codebase convention allows — but looking at the existing pattern, it lives inside the `sessionsApi` object).

```ts
// src/api/sessions.api.ts (addition only)
export interface SessionHistoryResponse {
  data: SessionDto[];   // note: BE returns 'data', not 'items'
  total: number;
  page: number;
  pageSize: number;
}

// Inside sessionsApi or as a standalone:
getHistory: (page: number, pageSize: number): Promise<SessionHistoryResponse> =>
  axiosClient
    .get<SessionHistoryResponse>(`${BASE}/history`, { params: { page, pageSize } })
    .then(r => r.data),
```

**Key decision**: the BE response envelope uses `data` (not `items`, which the active sessions endpoint uses). The FE type `SessionHistoryResponse` reflects this — no aliasing at the hook layer; the component accesses `sessions.data` consistently with how `useActiveSessions` returns `data?.items`.

**`SessionDto` already includes `revokedAt: string | null`** (see `src/types/session.ts`). No type changes needed in `session.ts`. For history items, `revokedAt` is always non-null (enforced by the BE), but the type remains `string | null` — the component treats a non-null value as truthy before formatting.

---

## 2. Hook — `useSessionHistory`

File: `src/hooks/useSessions.ts` (addition only — no modifications to existing hooks).

**Two approaches considered:**

### Option A — Add `useSessionHistory` inside `useSessions.ts`
- Consistent with the "one hook file per domain" convention (`useSessions.ts` owns all session state).
- All session query keys colocate: easier to invalidate cross-queries in future.
- **Chosen.**

### Option B — Separate `useSessionHistory.ts` file
- More isolated, easier to tree-shake.
- But the existing project convention is ONE hook file per domain (see `useSessions.ts` containing `useActiveSessions` + `useRevokeSession` + `useRevokeAllSessions`). Breaking that for a single new hook is noise.

**Implementation:**

```ts
export const SESSION_HISTORY_QUERY_KEY = ['admin', 'sessions', 'history'] as const;

export function useSessionHistory(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: [...SESSION_HISTORY_QUERY_KEY, { page, pageSize }],
    queryFn: () => sessionsApi.getHistory(page, pageSize),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
```

- Default params `page = 1, pageSize = 20` match the BE defaults per spec (REQ-SV-4).
- `staleTime: 30_000` mirrors `useActiveSessions` — historial is read-only and doesn't change frequently.
- `SESSION_HISTORY_QUERY_KEY` is SEPARATE from `SESSIONS_QUERY_KEY` — revoking a session should NOT invalidate the history query automatically (they're independent reads). If in a future iteration `useRevokeSession.onSuccess` needs to invalidate both, that's one line of change.
- Exposes `{ sessions: data?.data ?? [], total: data?.total ?? 0, isLoading, isError }` — the hook unwraps the `data` envelope to give the component a flat `sessions` array. This matches what `useActiveSessions` does with `data?.items`.

**Actual hook return shape** — the hook returns the full TanStack Query result object. The component destructures as needed:
```ts
const { data, isLoading, isError } = useSessionHistory();
const sessions = data?.data ?? [];
const total = data?.total ?? 0;
```

---

## 3. `SessionsBody` — two-section layout

**Current structure**: single `<div>` with one `DataTable` and pagination.

**Refactored structure**:
```
<div class={styles.body}>
  <section data-testid="active-sessions-section">
    <h2>Sesiones activas</h2>
    [loading skeleton | empty state | DataTable + pagination]
  </section>

  <section data-testid="history-section">
    <h2>Historial</h2>
    [loading skeleton | empty state | DataTable (no actions)]
  </section>
</div>
```

**Semantic separation**: each section uses `data-testid` attributes (invariant I-2) to allow deterministic assertion in tests that "Forzar logout" button is NOT inside `data-testid="history-section"`.

**Independent loading states**: `useActiveSessions` and `useSessionHistory` run in parallel — each section renders its own loading indicator when `isLoading` is true. A slow history fetch does NOT block the active sessions table (REQ-SV-2 scenario "Cargando historial").

**Active sessions section**: unchanged logic — same `columns` definition, same `handleForceLogout`, same pagination state `page` + `setPage`. The only change is wrapping the existing markup in a `<section>` with the heading.

**History section**: new columns definition (Actor, IP, Navegador, Inicio `loginAt`, Revocada `revokedAt`). No actions column. `revokedAt` formatted with the existing `formatDate()` helper (already handles ISO 8601 → locale string, already handles `null` → `'—'`).

**History pagination**: per spec, the UI starts with default `page=1, pageSize=20` (fixed). Pagination controls for history are OUT OF SCOPE for this change — the hook is parameterized but the component calls `useSessionHistory()` with no args (defaults only). A `historyPage` state would be added in a future iteration.

---

## 4. `revokedAt` formatting

The existing `formatDate(dateStr: string | null): string` helper in `SessionsBody.tsx` already does:
```ts
new Date(dateStr).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
```
This produces `29/05/2026 14:33` — exactly what REQ-SV-5 requires. No new formatting logic.

---

## 5. CSS Modules

The existing `SessionsBody.module.css` is extended (or a new section is added) for:
- `section` wrapper spacing between the two sections
- `h2` heading styles reusing existing design tokens

**No new token introduction** — reuse `var(--space-*)` and `var(--font-size-*)` from the global token file. No OKLCH (SessionsBody uses the HSL/hex color system; keep it consistent).

---

## 6. Test strategy

### Hook tests (`useSessionHistory`)
4 scenarios — mirror `useActiveSessions` test shape in `useSessions.test.ts`:
1. Returns history data from the API.
2. Passes `page` and `pageSize` params to the API call.
3. Default params → calls `getHistory(1, 20)`.
4. `isLoading: true` state before resolution.

### `SessionsBody` render tests (additions to existing test file or new sibling)
4+ scenarios — extend `SessionsBody.test.tsx` (new `describe` block or new sibling file `SessionsBody.history.test.tsx`):
1. Renders "Sesiones activas" heading + active sessions table.
2. Renders "Historial" heading + history table.
3. "Forzar logout" button is NOT inside the `data-testid="history-section"` container.
4. History section shows empty state when history is empty.
5. History section shows `revokedAt` formatted date (not raw ISO string).
6. Both sections render independently when one is loading.

**Non-regression**: existing `SessionsBody.test.tsx` tests MUST pass without modification (they test the active-sessions behavior which is conserved).

---

## 7. Invariants enforcement in tests

- I-1 (no Forzar logout in history): `within(screen.getByTestId('history-section'))` → `queryAllByRole('button', { name: /forzar logout/i })` → `toHaveLength(0)`.
- I-2 (semantic separation): assert `data-testid="active-sessions-section"` and `data-testid="history-section"` are present.
- I-3 (`useActiveSessions` not modified): test file imports the hook — if the export shape changes, TypeScript will catch it. The existing test suite provides the non-regression guarantee.
