# Design — gr-resync-all-front

## Context

`GestionRealSyncBody` is a presentational composition of two sub-sections
(`ConfigSection`, `StatusSection`) that consume hooks only — axios lives in the
api layer (`gestionRealSync.api.ts` + `gestionReal.api.ts`), TanStack Query in
the hook layer. Styling is via the local CSS module
(`GestionRealSync.module.css`) using design tokens. We extend this file in place,
adding two sibling sections and the supporting api/hook, with zero new domains
and zero routing changes. Atomic-design + container-presentational boundaries are
preserved (the body stays a page-level composition over hooks).

## Where the additions go

`GestionRealSyncBody` composes, in order:

```
<div className={styles.body}>
  <ConfigSection />              ← existing
  <MaintenanceSection />         ← NEW (button)
  <EstadoBreakdownSection />     ← NEW (stats breakdown)
  <StatusSection />              ← existing
</div>
```

Rationale for order: Mantenimiento (the destructive action) sits right after
Configuración because both are operator *actions*; the two read-only views
(Distribución, Estado) follow. Distribución precedes Estado so the per-status
breakdown and the last-run counters read as a single "current state" block.

## Decision 1 — Confirmation: reuse `useConfirm` (no `window.confirm`)

`useConfirm()` (from `@/context/ConfirmContext`) is the project's promise-based
replacement for `window.confirm`, already used across ~15 pages. It returns a
`confirm(input): Promise<boolean>` and supports `{ message, title, tone:'danger',
confirmLabel, cancelLabel }`.

Approach chosen:
```ts
const confirm = useConfirm();
async function handleResync() {
  if (resync.isPending) return;
  const ok = await confirm({
    title: 'Re-sincronizar todo',
    message: 'Esto vuelve a traer TODOS los clientes y contratos desde Gestión Real. Puede tardar varios minutos. ¿Continuar?',
    tone: 'danger',
    confirmLabel: 'Re-sincronizar',
  });
  if (ok) resync.mutate();
}
```

Compared alternative — `window.confirm`: rejected. The project explicitly
migrated away from it (`reemplazar window.confirm por hook useConfirm`); it is
unstyled, blocking, and untestable with RTL. `useConfirm` is the established
pattern and is trivially stubbable in tests.

## Decision 2 — Feedback state

Reuse the existing banner vocabulary (`.banner` + `.bannerError` /
`.bannerSuccess`) and button (`.btnPrimary`) already defined in the CSS module,
plus one new `.btnDanger` variant for the destructive button (mirrors
`.btnPrimary` shape with a danger background token). Pending/success/error are
read straight off the mutation object (`isPending`, `isSuccess`, `isError`,
`error`) — same shape `ConfigSection` already uses for `useUpdateSyncConfig`.

Error mapping mirrors the existing `mapSaveError` helper: a small
`mapResyncError(err)` that returns the permission message for status 403 and a
generic retry message otherwise. This is the SAME pattern as the existing
`mapSaveError`, kept local to the file.

## Decision 3 — Permission gate: surface 403, do NOT pre-gate (the caveat)

Investigated:
- FE permission strings are **dot-notation** (`clients.read`,
  `scheduling.delete`, `tickets.*`), checked via `useMyPermissions().can(...)` /
  `<Can permission="...">`.
- There is **no** `gestionReal:*` or `gestionReal.*` permission anywhere in the
  frontend (grep across `src` returns only `gestionRealSync` query keys and api
  identifiers, never a permission token).
- The backend gate for the endpoint is `gestionReal:write` (colon notation).

Therefore a client-side `<Can permission="gestionReal:write">` gate would be a
**guess** — the FE has never seen that permission, and dot-vs-colon notation
diverges from every other FE perm. Hiding the button on a guessed string risks
hiding it from users who actually have the backend permission (false negative),
or showing it falsely.

**Decision:** render the button unconditionally for anyone who reaches the tab
(already gated by the route's `clients.read`). The authoritative gate stays on
the backend; a 403 response is surfaced as a clear Spanish banner ("No tenés
permiso para re-sincronizar."). This keeps the FE honest about what it actually
knows.

Compared alternative — gate with `useMyPermissions().can('gestionReal:write')`:
rejected for now because the permission string is not part of the FE catalog and
the notation differs. If/when the backend exposes a normalized
`gestionReal.write` (dot) permission in the `/auth/me` payload (the RBAC catalog
already lists moduleId/moduleLabel per the recent backend commit), this can be
upgraded to ALSO hide/disable the button — a one-line `<Can>` wrap — without
changing the 403 behavior. Noted as a forward hook, not implemented now.

## Decision 4 — Breakdown reuses `useClientStats`, no new fetch

`useClientStats()` (`@/hooks/useCustomers`, query key `['client-stats']`,
`getClientStats` → `GET /clients/stats`, returns `ClientStats {total, active,
late, inactive, blocked, baja}`) already powers `ClientStatsCards`. The new
section calls the SAME hook. Field→label mapping is fixed per the requirement:

| field    | label      |
|----------|------------|
| total    | Total      |
| active   | Activos    |
| late     | Deudor     |
| inactive | Inactivo   |
| blocked  | Incobrable |
| baja     | Bajas      |

Presentation: reuse the existing `.countersGrid` / `.counter` / `.counterValue`
/ `.counterLabel` styles (the same visual the Estado section uses), rendered as
a static array of `{ key, label }` mapped over `data`. Numbers via
`toLocaleString('es-AR')` (matching `ClientStatsCards` and the `es` formatter in
the body). No filter/click behavior — this is read-only, unlike
`ClientStatsCards` which is a clickable filter. We deliberately do NOT reuse the
`ClientStatsCards` component itself because it requires `activeStatus` /
`onStatusClick` filter props and its own clickable-card CSS; a plain breakdown
list is the right altitude here.

Compared alternative — import `ClientStatsCards`: rejected; it is a filter
control coupled to the Clientes list page state, wrong semantics for a read-only
status panel.

## Hook invalidation design

`useResyncAll` invalidates three keys on success:
- `['gestion-real-sync-status']` — last-run status refreshes,
- `['gestionRealSync','config']` — config consistency (mirrors
  `useUpdateSyncConfig`),
- `['client-stats']` — the new breakdown refreshes after the backfill.

The backfill is asynchronous server-side, so counts may lag by one poll; this is
acceptable and documented in proposal risks. No optimistic update.

## Testing strategy (Vitest + RTL)

- **api test** (`gestionRealSync.api.test.ts`, extend existing): mock axios,
  assert `resyncAll()` issues `POST /gestion-real/sync/resync-all` and returns
  `response.data`.
- **hook test** (`useGestionRealSyncConfig.test.ts`, extend existing): mock the
  api module, spy `invalidateQueries`, assert the three keys on success.
- **body test** (new `GestionRealSyncBody.resync.test.tsx`): mock ALL hooks the
  body consumes. CRITICAL — GR hook mocks (`useSyncConfig`, etc.) MUST return
  **stable `vi.hoisted` refs**, because `ConfigSection`'s `useEffect([config])`
  re-runs (and can loop) on fresh object identities each render. Stub
  `useConfirm` to resolve `true`/`false` per scenario; stub `useResyncAll` with a
  `mutate` spy and the pending/success/error flags; stub `useClientStats` with
  the fixture. Assert: button present + enabled, confirm→mutate called once,
  cancel→mutate not called, pending disables + shows copy, success/403/generic
  banners, and the six breakdown labels+values.

All tests follow STRICT TDD: write the failing test first, then the minimal
implementation. Test command: `npx vitest run`.

## Files touched

- `src/api/gestionRealSync.api.ts` — add `resyncAll`.
- `src/hooks/useGestionRealSyncConfig.ts` — add `useResyncAll`.
- `src/pages/customers/settings/GestionRealSyncBody.tsx` — add
  `MaintenanceSection` + `EstadoBreakdownSection`, wire into `GestionRealSyncBody`.
- `src/pages/customers/settings/GestionRealSync.module.css` — add `.btnDanger`
  (+ any reused-class tweaks). No new module.
- Tests: `src/__tests__/api/gestionRealSync.api.test.ts` (new or extend),
  `src/__tests__/hooks/useGestionRealSyncConfig.test.ts` (extend),
  `src/__tests__/pages/customers/settings/GestionRealSyncBody.resync.test.tsx` (new).
