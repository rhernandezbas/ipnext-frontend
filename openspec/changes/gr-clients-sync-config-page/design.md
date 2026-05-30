# Design: gr-clients-sync-config-page

## Context

The "Gestión Real" (ingest) tab already exists as the template:
`GestionRealBody.tsx` (ConfigSection + StatusSection + NeedsReviewSection),
`gestionRealIngest.api.ts`, `useGestionRealIngest.ts`, `gestionRealIngest.ts`.
We add a sibling "Sincronización" tab for the **client sync** with the same skeleton
but a different config shape (`{ intervalMs, estados }` instead of
`{ intervalMs, windowMonths, fiberProjectId, wirelessProjectId }`) and only **2**
sections (no needs-review).

Atomic-design + container-presentational boundaries apply: the body is a page-level
container that consumes **hooks only** (never axios); axios lives in the api layer; CSS
Modules for styling. Lazy `<Suspense>` and flat-route order are untouched (this is a tab
inside an already-routed page).

## Decision 1: Mirror (copy) vs Extract a shared component

### Approach A — Extract a generic `<GrConfigBody>` shared by ingest and sync
Pull the ConfigSection + StatusSection skeleton (toggle row, interval select, save-when-dirty,
error mapping, status counters) into a parameterized component, and have both ingest and
sync render it with props/render-props for their specific fields.

- **Pros**: single source for the save-when-dirty + flag-toggle + error-banner machinery;
  DRY.
- **Cons**: the two configs diverge in shape (estados[] checkboxes vs 2 project dropdowns +
  windowMonths number), in section count (2 vs 3), and in guard logic (sync has no
  "project unmapped" guard). A generic component would need render-props / a field-schema
  abstraction — **a premature abstraction over exactly two consumers** that are likely to
  keep diverging. It also forces touching the already-shipped, already-tested ingest body
  (regression risk on a deployed feature) for zero user-facing benefit.

### Approach B — Mirror: a separate `GestionRealSyncBody.tsx` (RECOMMENDED)
Copy the structure of `GestionRealBody.tsx` into a new `GestionRealSyncBody.tsx`,
adapting fields to `{ intervalMs, estados }` and 2 sections. Share ONLY what is already a
clean, importable unit: the interval helpers in `gestionRealIngest.ts`.

- **Pros**: zero blast radius on the shipped ingest tab; each body stays simple and
  readable; the two features can evolve independently; follows the repo's existing
  "*Body per tab" convention (each settings tab is its own Body).
- **Cons**: some structural duplication (toggle row markup, save-when-dirty pattern,
  error-mapping helper). Accepted — it's shallow, mechanical duplication, not logic that
  will drift dangerously.

**Decision: B (Mirror).** Rule of three — extract only when a third consumer appears or the
duplication proves costly. With two diverging configs, mirroring is cheaper and safer.
The interval-preset helpers are the one genuinely shared, stable unit, so we **reuse**
those by import (not copy).

## Decision 2: Feature-flag toggle reuse

The ingest body already uses **generic** hooks: `useFeatureFlag(key)` (reads, treats 404
as `{ enabled:false }`) and `useSetFeatureFlag()` (`mutate({ key, enabled })` →
`PATCH /admin/feature-flags/:key`). They are key-parameterized, so **no new hook is
needed** — `GestionRealSyncBody` calls `useFeatureFlag('gestion-real-sync')` and
`useSetFeatureFlag()` directly, mirroring `handleToggleFlag` from the ingest.

Difference vs ingest: the ingest gates "turn ON" behind `projectsMapped` (the
enable-guard). The **sync has no such precondition**, so we DROP the guard entirely —
turning on/off is always allowed and writes the flag live. This keeps the sync toggle
simpler than the ingest one.

## Decision 3: estados checkbox UX

The backend whitelist is `["1","2","3","4","6"]` (note: no "5"). The UI must only ever
offer whitelisted values, so the catalog is the single source:

```
ESTADOS_CATALOG = [
  { value: '1', label: 'Activo' },
  { value: '2', label: 'Deudor' },
  { value: '3', label: 'Inactivo' },
  { value: '4', label: 'Incobrable' },
  { value: '6', label: 'Baja' },
]
```

- **Rendering**: a fieldset of checkboxes, one per catalog entry. `checked` =
  `form.estados.includes(value)`. Toggling adds/removes the value from `form.estados`.
- **Why checkboxes (not a multi-select)**: the set is tiny and fixed (5 options); checkboxes
  are the most accessible, lowest-friction control and match the plain-HTML, CSS-Modules
  style of the existing settings tabs (no extra multi-select dependency).
- **Order/normalization**: persist `estados` in catalog order (filter the catalog by
  membership) so the saved array is deterministic and dirty-comparison is stable regardless
  of click order.
- **Empty set**: `estados: []` is a valid partial PUT (backend accepts it). We allow Guardar
  but surface a hint ("Sin estados seleccionados no se sincroniza ningún cliente.") rather
  than hard-blocking — matches the open question; final call deferred to apply but the hint
  path is the recommendation.
- **Dirty comparison**: compare estados as sets (same length + every element present), not
  by reference, so re-checking back to the original state correctly reports "clean".

## Decision 4: Form state & save-when-dirty (mirrored)

Mirror the ingest `FormState` pattern: hold a local mutable `FormState { intervalMs:number;
estados:string[] }`, seed it from the loaded config in a `useEffect`, compute `dirty` via a
shallow/`formEquals` compare (with set-equality for estados), disable Guardar unless dirty,
clear stale save feedback on edit, and store `intervalMs` RAW so a loaded non-preset value
survives an untouched save. Reuse the ingest's `mapSaveError` shape (400 `VALIDATION_ERROR`
→ Spanish) — copied, since it's a tiny pure helper.

## Decision 5: CSS module

Reuse `GestionReal.module.css` (already has `section`/`card`/`toggleRow`/`switch`/`select`/
`banner`/`formActions`/`lastRun`/`countersGrid`/`counter` token classes) by importing it
from the sync body, adding only an estados-checkbox class if a new one is needed. Rationale:
the visual language is identical; a second module would duplicate tokens. (If apply finds the
import path awkward across files, a thin `GestionRealSync.module.css` that composes the same
tokens is an acceptable fallback — no user-visible difference.)

## Data flow

```
GestionRealSyncBody (container)
├─ ConfigSection
│   ├─ useSyncConfig() ............... GET /gestion-real/sync/config
│   ├─ useUpdateSyncConfig() ......... PUT /gestion-real/sync/config (invalidate config+status)
│   ├─ useFeatureFlag('gestion-real-sync') ... GET  /admin/feature-flags/gestion-real-sync
│   └─ useSetFeatureFlag() ........... PATCH /admin/feature-flags/gestion-real-sync
└─ StatusSection
    └─ useGestionRealSyncStatus() .... GET /gestion-real/sync/status   (REUSED, unchanged)
```

api layer: `gestionRealSync.api.ts` (config GET/PUT) + existing `gestionReal.api.ts`
(status). Hooks never expose axios; the body never imports axios.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| estados dirty-compare by reference → false "dirty"/"clean" | Set-equality compare; persist in catalog order |
| Sending a non-whitelisted estado | UI only offers catalog values; backend also validates |
| Touching the shipped ingest body during mirror | Mirror is a NEW file; ingest is read-only reference |
| CSS import coupling between two bodies | Acceptable; fallback to a composing module if awkward |
| Status endpoint 401/404 when flag off | `useGestionRealSyncStatus` already has `retry:false` |

## Testing strategy (strict TDD)

Vitest + @testing-library/react, jsdom, tests in `src/__tests__/` mirroring `src/`.
Red → green → refactor, test-first, per the openspec `strict_tdd: true`.
Mock the api module for hook tests; mock the hooks (`useSyncConfig`, `useUpdateSyncConfig`,
`useGestionRealSyncStatus`, `useFeatureFlag`, `useSetFeatureFlag`) for body tests. Verify
with `npx vitest run` + `tsc --noEmit`. No new routes, so flat-route order is untouched.
