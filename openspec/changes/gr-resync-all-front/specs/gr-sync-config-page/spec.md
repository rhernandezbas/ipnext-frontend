# Spec delta — gr-sync-config-page (gr-resync-all-front)

Capability: the GR sync configuration tab (`GestionRealSyncBody`, Clientes →
Configuración → "Sincronización GR"). This delta ADDS two sections; it does not
modify the existing Configuración / Estado behavior.

RFC 2119 keywords are used (MUST, SHOULD, MAY).

---

## ADDED Requirement: Re-sincronizar todo action

The tab MUST present a "Mantenimiento" section with a destructive
"Re-sincronizar todo" button that triggers a full GR re-backfill via
`POST /api/gestion-real/sync/resync-all`, guarded by a confirmation dialog.

### Scenario: button is rendered in the Mantenimiento section
- **Given** the GR sync tab is rendered
- **Then** a section titled "Mantenimiento" MUST be present
- **And** it MUST contain a button named "Re-sincronizar todo"
- **And** the button MUST be enabled when no resync is in flight

### Scenario: confirming the dialog triggers resyncAll
- **Given** the GR sync tab is rendered
- **And** `useConfirm` is stubbed to resolve `true`
- **When** the operator clicks "Re-sincronizar todo"
- **Then** the confirmation dialog MUST be requested with a destructive
  (`tone: 'danger'`) message describing a full re-backfill
- **And** on confirm the `useResyncAll` mutation `mutate` MUST be called exactly once

### Scenario: cancelling the dialog does NOT trigger resyncAll
- **Given** the GR sync tab is rendered
- **And** `useConfirm` is stubbed to resolve `false`
- **When** the operator clicks "Re-sincronizar todo"
- **Then** the `useResyncAll` mutation `mutate` MUST NOT be called

### Scenario: pending state disables the button and shows progress copy
- **Given** `useResyncAll` reports `isPending: true`
- **When** the GR sync tab is rendered
- **Then** the "Re-sincronizar todo" button MUST be disabled
- **And** it MUST show pending copy (e.g. "Re-sincronizando…")

### Scenario: success shows a confirmation banner
- **Given** `useResyncAll` reports `isSuccess: true`
- **When** the GR sync tab is rendered
- **Then** a success banner MUST be shown indicating the re-backfill was started
  (e.g. "Re-sincronización iniciada.")

### Scenario: a 403 surfaces a permission message
- **Given** `useResyncAll` reports `isError: true` with `error.response.status === 403`
- **When** the GR sync tab is rendered
- **Then** an error banner MUST be shown stating the user lacks permission
  (Spanish, e.g. "No tenés permiso para re-sincronizar.")

### Scenario: a non-403 error shows a generic retry message
- **Given** `useResyncAll` reports `isError: true` with a status other than 403
  (or no response)
- **When** the GR sync tab is rendered
- **Then** an error banner MUST be shown with a generic Spanish retry message
  (e.g. "No se pudo iniciar la re-sincronización. Reintentá en unos segundos.")

### Scenario: the button is not hidden by a client-side permission gate
- **Given** the operator reached the tab (route already gated by `clients.read`)
- **Then** the "Re-sincronizar todo" button MUST be visible regardless of any
  `gestionReal` permission (the FE has no such permission string; the backend
  `gestionReal:write` gate is enforced server-side and surfaced as a 403)

---

## ADDED Requirement: Estado breakdown section

The tab MUST present a "Distribución por estado" section that reuses the
existing `GET /api/clients/stats` data (via `useClientStats`) and renders the
six client buckets. It MUST NOT introduce a new backend call.

### Scenario: breakdown renders the six labelled buckets from stats
- **Given** `useClientStats` resolves
  `{ total: 1500, active: 1000, late: 200, inactive: 150, blocked: 100, baja: 50 }`
- **When** the GR sync tab is rendered
- **Then** the section titled "Distribución por estado" MUST show:
  - "Total" → 1.500
  - "Activos" → 1.000
  - "Deudor" → 200
  - "Inactivo" → 150
  - "Incobrable" → 100
  - "Bajas" → 50
- **And** numbers MUST be formatted with the es-AR locale (thousands separator)

### Scenario: loading shows a placeholder
- **Given** `useClientStats` reports `isLoading: true` with no data
- **When** the GR sync tab is rendered
- **Then** the breakdown MUST render a loading placeholder (e.g. "Cargando…" or
  "…" per bucket) and MUST NOT crash on undefined data

### Scenario: missing fields default to zero
- **Given** `useClientStats` resolves with `data: undefined`
- **When** the GR sync tab is rendered
- **Then** every bucket MUST render `0` (no NaN, no crash)

---

## Plumbing requirements (api + hook)

### ADDED Requirement: resyncAll api method
`src/api/gestionRealSync.api.ts` MUST export an async `resyncAll()` that POSTs to
`${BASE}/resync-all` (i.e. `/gestion-real/sync/resync-all`) via the shared axios
client and resolves with the response body.

#### Scenario: resyncAll POSTs to the correct path
- **Given** the axios client is mocked
- **When** `resyncAll()` is called
- **Then** it MUST issue `POST /gestion-real/sync/resync-all`
- **And** it MUST resolve with `response.data`

### ADDED Requirement: useResyncAll mutation
`src/hooks/useGestionRealSyncConfig.ts` MUST export a `useResyncAll()` mutation
that calls `resyncAll` and, on success, invalidates the sync-status key, the
config key, and the client-stats key.

#### Scenario: useResyncAll invalidates status, config and stats on success
- **Given** `resyncAll` resolves
- **When** the mutation succeeds
- **Then** `invalidateQueries` MUST be called with `{ queryKey: ['gestion-real-sync-status'] }`
- **And** with `{ queryKey: ['gestionRealSync','config'] }`
- **And** with `{ queryKey: ['client-stats'] }`
