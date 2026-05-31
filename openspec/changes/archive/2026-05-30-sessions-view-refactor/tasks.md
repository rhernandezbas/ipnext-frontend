# Tasks — sessions-view-refactor (Frontend)

**Status**: ready
**Repo**: `ipnext-frontend`
**Strict TDD**: ACTIVE — every implementation task is preceded by a failing-test task. RED → GREEN → REFACTOR.
**Test runner**: `npm run test` (Vitest) · **Quality gate**: `npm run typecheck` (tsc --noEmit)
**Constraint**: `useActiveSessions`, `useRevokeSession`, `useRevokeAllSessions` MUST NOT be modified. Non-regression guaranteed by keeping existing tests GREEN.

---

## Phase 1 — Types (additive)

- [ ] 1.1 In `src/api/sessions.api.ts`, add `SessionHistoryResponse` interface:
  ```ts
  export interface SessionHistoryResponse {
    data: SessionDto[];
    total: number;
    page: number;
    pageSize: number;
  }
  ```
  Import `SessionDto` from `@/types/session` (already exported). Note: the BE history endpoint uses `data` (not `items`) as the array key — the interface must reflect this exactly.
  Also add `getHistory` to the `sessionsApi` object:
  ```ts
  getHistory: (page: number, pageSize: number): Promise<SessionHistoryResponse> =>
    axiosClient.get<SessionHistoryResponse>(`${BASE}/history`, { params: { page, pageSize } }).then(r => r.data),
  ```

## Phase 2 — Hook `useSessionHistory` (TDD)

- [ ] 2.1 [RED] Create `src/__tests__/hooks/useSessionHistory.test.ts`:
  - Mock `@/api/sessions.api` adding `getHistory: vi.fn()` to the `sessionsApi` mock (extend the existing mock shape — do NOT modify the `useActiveSessions`/`useRevokeSession` mock or existing tests will fail).
  - Scenario 1: `useSessionHistory()` with no args calls `sessionsApi.getHistory(1, 20)` (default params, REQ-SV-4 default call).
  - Scenario 2: `useSessionHistory(2, 10)` calls `sessionsApi.getHistory(2, 10)` (explicit params, REQ-SV-4 explicit).
  - Scenario 3: when API resolves `{ data: [...], total: 25, page: 1, pageSize: 20 }`, `result.current.data` contains the full response object (REQ-SV-4 data returned).
  - Scenario 4: `isLoading: true` before the query resolves (loading state).
  - Use the same `renderHook` + `QueryClientProvider` wrapper pattern as `useSessions.test.ts`.
  - Confirm all assertions FAIL (hook doesn't exist yet).
- [ ] 2.2 [GREEN] In `src/hooks/useSessions.ts`, add:
  - `export const SESSION_HISTORY_QUERY_KEY = ['admin', 'sessions', 'history'] as const`
  - `export function useSessionHistory(page = 1, pageSize = 20)` — uses `useQuery`, calls `sessionsApi.getHistory(page, pageSize)`, `staleTime: 30_000`, `placeholderData: keepPreviousData`.
  - Import `SESSION_HISTORY_QUERY_KEY` and `useSessionHistory` in the test file (they are now exported).
  - Run tests → GREEN. Existing `useSessions.test.ts` tests MUST remain GREEN — verify.

## Phase 3 — `SessionsBody` Refactor (TDD)

- [ ] 3.1 [RED] Create `src/__tests__/system/SessionsBody.history.test.tsx` (new file, keeps the existing `SessionsBody.test.tsx` untouched):
  - Mock `@/hooks/useSessions` extending the existing mock to also include `useSessionHistory: vi.fn()` and `SESSION_HISTORY_QUERY_KEY`.
  - Helper `makeHistoryResponse(overrides?)` → `{ data: [{ id: 'h-1', actorLogin: 'ex-admin', ip: '10.0.0.1', userAgent: 'Firefox', loginAt: '2026-04-01T10:00:00Z', lastSeenAt: '2026-04-01T10:30:00Z', revokedAt: '2026-04-01T12:00:00Z', createdAt: '2026-04-01T10:00:00Z', rbacUserId: 'u1' }], total: 1, page: 1, pageSize: 20 }`.
  - Scenario 1 (REQ-SV-1): `useActiveSessions` returns active sessions, `useSessionHistory` returns empty — render `SessionsBody` → `screen.getByRole('heading', { name: /sesiones activas/i })` present; active session actor visible.
  - Scenario 2 (REQ-SV-2): `useSessionHistory` returns 1 history item — render → `screen.getByRole('heading', { name: /historial/i })` present; `ex-admin` visible.
  - Scenario 3 (REQ-SV-3 / I-1): render with history data → `within(screen.getByTestId('history-section')).queryAllByRole('button', { name: /forzar logout/i })` has length 0.
  - Scenario 4 (REQ-SV-2 empty state): `useSessionHistory` returns `{ data: [], total: 0 }` → history section shows "No hay sesiones en el historial".
  - Scenario 5 (REQ-SV-5): `revokedAt: '2026-05-29T14:33:00.000Z'` → formatted date visible (NOT the raw ISO string); assert `screen.queryByText('2026-05-29T14:33:00.000Z')` is null AND a date-like string is present.
  - Scenario 6 (REQ-SV-2 loading): `useSessionHistory` returns `isLoading: true` → history section shows loading indicator; active section renders normally (not blocked).
  - Confirm all FAIL.
- [ ] 3.2 [GREEN] Refactor `src/pages/system/admin/SessionsBody.tsx`:
  - Add `import { useSessionHistory } from '@/hooks/useSessions'` at the top.
  - Call `const { data: historyData, isLoading: historyLoading } = useSessionHistory()` inside the component (after the existing `useActiveSessions` call). No page state for history (uses defaults `page=1, pageSize=20`).
  - Derive: `const historyItems = historyData?.data ?? []`.
  - Wrap the existing active-sessions block in `<section data-testid="active-sessions-section">` with an `<h2>Sesiones activas</h2>` heading.
  - Add new `<section data-testid="history-section">` block with:
    - `<h2>Historial</h2>`
    - loading indicator when `historyLoading`
    - `DataTable` with history columns (Actor, IP, Navegador, Inicio, Revocada) — NO actions column
    - `emptyMessage="No hay sesiones en el historial."`
  - History columns definition uses `formatDate(row.revokedAt)` for the Revocada cell (reuses existing `formatDate` helper — no new import needed).
  - Run tests → GREEN. Existing `SessionsBody.test.tsx` MUST remain GREEN.

## Phase 4 — CSS Modules

- [ ] 4.1 [GREEN] In `src/pages/system/admin/SessionsBody.module.css`, add styles for the two sections:
  - `.section` or scoped to `section` — add `margin-bottom: var(--space-8)` (or equivalent token) between sections.
  - `.sectionHeading` — h2 style using design tokens (`var(--font-size-lg)`, `var(--color-text-primary)` or equivalent).
  - Do NOT introduce new color values — reuse existing tokens. Keep the HSL color system (no OKLCH).
  - No snapshot test needed for CSS — visual review is sufficient.

## Phase 5 — Quality Gates

- [ ] 5.1 Run full session test suite: `npm run test -- sessions useSessions SessionsBody` → all GREEN (existing + new).
- [ ] 5.2 Run `npm run typecheck` → 0 errors.
- [ ] 5.3 Verify invariants:
  - `useActiveSessions` import in `SessionsBody.tsx` is unchanged — verify `git diff` shows NO removal or change to the existing hook call.
  - `data-testid="history-section"` contains no `button[name="Forzar logout"]` — covered by Scenario 3 test.

---

## Task Summary

| Phase | Focus | Type | Count |
|-------|-------|------|-------|
| 1 | API type + function | additive | 1 |
| 2 | `useSessionHistory` hook | RED+GREEN | 2 |
| 3 | `SessionsBody` refactor | RED+GREEN | 2 |
| 4 | CSS Modules | GREEN | 1 |
| 5 | Quality gates | verify | 3 |
| **Total** | | | **9** |

New test files: 2 (`useSessionHistory.test.ts`, `SessionsBody.history.test.tsx`).
New/modified source files: 3 (`sessions.api.ts`, `useSessions.ts`, `SessionsBody.tsx` + CSS module).
