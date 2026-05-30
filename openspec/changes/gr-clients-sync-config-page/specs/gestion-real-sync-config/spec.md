# Spec: gestion-real-sync-config

Capability: a "Sincronización" tab in the Scheduling settings page that configures,
toggles, and monitors the Gestión Real **client sync**, mirroring the existing
"Gestión Real" ingest tab. Frontend consumes backend endpoints; it does NOT own the
data shape.

Backend contract (already deployed, Change 2):
- `GET /api/gestion-real/sync/config` → `{ intervalMs: number, estados: string[] }` (RBAC `gestionReal:read`)
- `PUT /api/gestion-real/sync/config` → partial `{ intervalMs?, estados? }` (RBAC `gestionReal:write`); `estados` whitelist = `["1","2","3","4","6"]`
- `GET /api/gestion-real/sync/status` → consumed by existing `useGestionRealSyncStatus`
- Feature flag `gestion-real-sync` toggled via `PATCH /admin/feature-flags/gestion-real-sync`

## ADDED Requirements

### Requirement: Types and estados catalog
The frontend SHALL define `SyncConfigDTO { intervalMs: number; estados: string[] }`
and `UpdateSyncConfigPayload = Partial<Pick<SyncConfigDTO, 'intervalMs' | 'estados'>>`,
mirroring the backend DTO exactly, and SHALL expose an estados catalog whose values
match the backend whitelist. It SHALL reuse the interval preset helpers from
`gestionRealIngest.ts` (it MUST NOT duplicate them).

#### Scenario: estados catalog matches the backend whitelist
- **Given** the estados catalog `ESTADOS_CATALOG`
- **When** its `value` fields are collected
- **Then** they MUST equal `["1", "2", "3", "4", "6"]` in that order
- **And** the labels MUST be `Activo`, `Deudor`, `Inactivo`, `Incobrable`, `Baja` respectively

#### Scenario: interval helpers are reused, not redefined
- **Given** `src/types/gestionRealSync.ts`
- **When** it needs interval presets / ms conversion
- **Then** it MUST import `INTERVAL_PRESETS_MIN`, `minutesToMs`, `resolveIntervalPreset`
  from `@/types/gestionRealIngest` (no local copy)

### Requirement: API module
The frontend SHALL provide `getSyncConfig` and `updateSyncConfig` over `axios-client`,
hitting the `/gestion-real/sync/config` endpoint. The sync STATUS call already exists in
`gestionReal.api.ts` and MUST be reused unchanged.

#### Scenario: getSyncConfig issues a GET to the config endpoint
- **Given** a mocked `axios-client`
- **When** `getSyncConfig()` is called
- **Then** it MUST issue `GET /gestion-real/sync/config`
- **And** it MUST return `response.data` typed as `SyncConfigDTO`

#### Scenario: updateSyncConfig issues a PUT with the partial body
- **Given** a mocked `axios-client` and a payload `{ intervalMs: 300000, estados: ["1","2"] }`
- **When** `updateSyncConfig(payload)` is called
- **Then** it MUST issue `PUT /gestion-real/sync/config` with that exact body
- **And** it MUST return `response.data`

### Requirement: Hooks
The frontend SHALL provide `useSyncConfig` (query) and `useUpdateSyncConfig` (mutation).
On success the mutation MUST invalidate the config query and the sync-status query so the
UI reflects the new configuration. The existing `useGestionRealSyncStatus` MUST be reused
for status (not re-implemented).

#### Scenario: useSyncConfig exposes a stable query key
- **Given** the `useSyncConfig` query
- **When** it is registered
- **Then** its `queryKey` MUST be stable (e.g. `['gestionRealSync','config']`)
  and distinct from the ingest keys

#### Scenario: useUpdateSyncConfig invalidates config and status on success
- **Given** `useUpdateSyncConfig` with a mocked api module
- **When** the mutation succeeds
- **Then** it MUST call `invalidateQueries` for the sync config key
- **And** it MUST call `invalidateQueries` for the sync status key

### Requirement: Configuración section renders and edits config
The Configuración section SHALL render the loaded config (interval as minutes via the
preset select; estados as checkboxes reflecting `SyncConfigDTO.estados`). Edits SHALL be
held in local form state; the Guardar button SHALL be disabled until the form is dirty.

#### Scenario: renders config from API
- **Given** `useSyncConfig` resolves `{ intervalMs: 300000, estados: ["1","3"] }`
- **When** the Configuración section renders
- **Then** the interval select MUST show `5 min` selected
- **And** the checkboxes for `Activo` (1) and `Inactivo` (3) MUST be checked
- **And** the checkboxes for `Deudor` (2), `Incobrable` (4), `Baja` (6) MUST be unchecked
- **And** the Guardar button MUST be disabled (form is clean)

#### Scenario: change interval enables Guardar and persists converted value
- **Given** the section rendered with `intervalMs: 300000` (5 min)
- **When** the user selects `15 min`
- **Then** the Guardar button MUST become enabled
- **And** clicking Guardar MUST call `updateSyncConfig` with `intervalMs: 900000`

#### Scenario: non-preset interval renders a graceful custom option
- **Given** `useSyncConfig` resolves `{ intervalMs: 200000, estados: [] }`
- **When** the section renders
- **Then** the interval select MUST render a `(personalizado)` option for ~3 min
- **And** saving without touching the interval MUST preserve `intervalMs: 200000`

#### Scenario: toggle estados checkboxes updates the payload
- **Given** the section rendered with `estados: ["1"]`
- **When** the user checks `Deudor` (2) and unchecks `Activo` (1)
- **Then** the Guardar button MUST be enabled
- **And** clicking Guardar MUST call `updateSyncConfig` with `estados: ["2"]`

#### Scenario: Save persists and shows confirmation
- **Given** a dirty form and `updateSyncConfig` resolving successfully
- **When** the user clicks Guardar
- **Then** the UI MUST show a success indication (e.g. "Configuración guardada")
- **And** the Guardar button MUST return to disabled (form clean against new baseline)

#### Scenario: Save error maps to a Spanish message
- **Given** a dirty form and `updateSyncConfig` rejecting with HTTP 400 `VALIDATION_ERROR`
- **When** the user clicks Guardar
- **Then** the UI MUST show a Spanish validation message
- **And** it MUST NOT show the success indication

### Requirement: Feature-flag on/off toggle (mirror of ingest)
The Configuración section SHALL render an on/off toggle bound to the `gestion-real-sync`
feature flag, reusing the generic `useFeatureFlag` / `useSetFeatureFlag` hooks (the same
ones the ingest tab uses with `gestion-real-ingest`). Turning the toggle MUST write the
flag live (independent of the Guardar button).

#### Scenario: toggle reflects current flag state
- **Given** `useFeatureFlag('gestion-real-sync')` resolves `{ enabled: true }`
- **When** the section renders
- **Then** the activation toggle MUST be checked

#### Scenario: toggle flag on/off writes the flag live
- **Given** the toggle rendered (flag currently off)
- **When** the user switches it on
- **Then** it MUST call `useSetFeatureFlag` with `{ key: 'gestion-real-sync', enabled: true }`
- **And** switching it off again MUST call with `enabled: false`
- **And** neither action MUST depend on the Guardar button

### Requirement: Estado section renders sync status
The Estado section SHALL render the GR sync status from the existing
`useGestionRealSyncStatus` hook: formatted `lastRunAt` (or "Nunca" when null),
`lastResult`, and the available counters (`itemsSynced`, and `clientCount` /
`contractCount` when present).

#### Scenario: status renders last run and counters
- **Given** `useGestionRealSyncStatus` resolves `{ lastRunAt: '2026-05-29T10:00:00Z', itemsSynced: 42, clientCount: 1000, ... }`
- **When** the Estado section renders
- **Then** it MUST display the formatted last-run datetime
- **And** it MUST display `itemsSynced` (42) and any present counters

#### Scenario: null lastRunAt shows "Nunca"
- **Given** `useGestionRealSyncStatus` resolves `{ lastRunAt: null, hasRun: false, ... }`
- **When** the Estado section renders
- **Then** the last-run label MUST read "Nunca"

### Requirement: Tab registration
`SchedulingSettingsPage` SHALL register a new tab
`{ id: 'gestion-real-sync', label: 'Sincronización', content: <GestionRealSyncBody /> }`
in its `TABS` array, lazy-mounted like its siblings, WITHOUT reordering existing tabs or
breaking existing deep links.

#### Scenario: "Sincronización" tab appears and mounts the body
- **Given** the Scheduling settings page renders
- **When** the user selects the "Sincronización" tab
- **Then** the `GestionRealSyncBody` (Configuración + Estado sections) MUST render
- **And** the URL hash MUST become `#gestion-real-sync`
- **And** the existing tabs (including "Gestión Real") MUST remain present and unreordered
