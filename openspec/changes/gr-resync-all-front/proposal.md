# Proposal — gr-resync-all-front

## Why

The GR sync config tab (Clientes → Configuración → "Sincronización GR",
`GestionRealSyncBody`) today only lets an operator tune the periodic sync
(intervalo + estados) and read its last-run status. Two operational gaps remain:

1. **No way to force a full re-backfill.** When the periodic mirror drifts or a
   new estado is added, the only path is editing config and waiting for the next
   tick. The backend now exposes `POST /api/gestion-real/sync/resync-all`
   (RBAC `gestionReal:write`) which triggers a full re-backfill of clients +
   contracts on demand. The UI has no button for it.
2. **No estado breakdown.** The operator can see *how many* items synced
   (itemsSynced / clientCount / contractCount) but not the distribution of the
   mirrored client base per status (Activos / Deudor / Inactivo / Incobrable /
   Bajas). That breakdown already exists for the Clientes list
   (`ClientStatsCards` via `GET /api/clients/stats`) but is not surfaced on the
   sync tab where an operator validating a backfill would look for it.

## What changes

Two additions to `src/pages/customers/settings/GestionRealSyncBody.tsx`
(+ its CSS module), mirroring the existing `ConfigSection` / `StatusSection`
structure. No routing changes, no new pages, no `App.tsx` edits — this is a
component-internal change behind the existing `clients.read`-gated route.

1. **"Re-sincronizar todo" action** — a new **`MaintenanceSection`**
   (Spanish title "Mantenimiento") containing a destructive button that:
   - on click opens the existing `useConfirm` dialog (`tone: 'danger'`),
   - on confirm calls a new `useResyncAll()` mutation → `resyncAll()` api →
     `POST /gestion-real/sync/resync-all`,
   - shows pending / success / error feedback reusing the existing banner styles,
   - is disabled while pending and re-enabled after.
   - does NOT call the endpoint on cancel.

2. **Estado breakdown** — a new **`EstadoBreakdownSection`** (Spanish title
   "Distribución por estado") that REUSES the existing `useClientStats()` hook
   (`GET /api/clients/stats`, query key `['client-stats']`) and renders six
   buckets reusing the existing `.countersGrid` / `.counter` styles:
   - Total = `total`, Activos = `active`, Deudor = `late`, Inactivo = `inactive`,
     Incobrable = `blocked`, Bajas = `baja`.
   - NO new backend call and NO new api/type — the `ClientStats` type and
     `getClientStats` api already exist.

### Supporting plumbing (existing-file extensions, no new domains)

- `src/api/gestionRealSync.api.ts` — add `resyncAll()` (`POST ${BASE}/resync-all`).
- `src/hooks/useGestionRealSyncConfig.ts` — add `useResyncAll()` mutation that on
  success invalidates the status key (`['gestion-real-sync-status']`), the config
  key (`['gestionRealSync','config']`), AND the stats key (`['client-stats']`)
  so the breakdown refreshes after a backfill.

## Permission caveat (decided)

The FE permission vocabulary uses **dot** notation (`clients.read`,
`scheduling.delete`) and there is **no** `gestionReal:*`/`gestionReal.*`
permission referenced anywhere in the frontend. The backend gate is
`gestionReal:write` (colon). Because the FE cannot reliably map to that exact
string, the button is **NOT** hidden by a permission gate. It is rendered for
any user who can reach the page (already `clients.read`-gated), invokes the
endpoint, and surfaces a friendly Spanish message if the backend returns **403**
(insufficient permission). This avoids guessing a perm string and a false
client-side gate that diverges from the backend. See design.md "Permission gate".

## Scope

In scope:
- `GestionRealSyncBody.tsx` (+ `GestionRealSync.module.css`)
- `gestionRealSync.api.ts` (`resyncAll`)
- `useGestionRealSyncConfig.ts` (`useResyncAll`)
- Vitest tests for the api method, the hook, and the body (button + breakdown).

Out of scope:
- Backend endpoint (already exists).
- A `gestionReal` FE permission string / RBAC catalog change.
- The Clientes list `ClientStatsCards` (reused read-only via its hook only).
- Routing / `App.tsx` (no route count change).

## Risks

- **Stale breakdown after backfill.** Mitigated: `useResyncAll` invalidates
  `['client-stats']`; the backfill is async on the backend so counts may lag one
  poll — acceptable, the stats query has its own staleTime.
- **Perm divergence.** The 403-surfacing approach means a user without
  `gestionReal:write` sees the button but gets an error on click. Accepted per
  the caveat above; copy must make the 403 clear ("No tenés permiso…").
- **ConfigSection useEffect loop in tests.** GR hook mocks MUST use stable
  `vi.hoisted` refs (ConfigSection's `useEffect([config])` re-runs on fresh
  object identities) — already a known constraint in the existing test file.

## Next

`next_recommended: sdd-spec` → `sdd-design` → `sdd-tasks` → `sdd-apply`.
