# Tasks: gr-clients-sync-config-page

Strict TDD (`strict_tdd: true`): every code task is preceded by a failing test (red),
then implemented to green, then refactored. Test runner: `npx vitest run`.
Type gate: `tsc --noEmit`. Tests live in `src/__tests__/` mirroring `src/`.
Each phase leaves the app running and all URLs resolving (this change adds no routes).

## Phase 1: Types + estados catalog (reuse interval helpers)

- [ ] 1.1 Write `src/__tests__/types/gestionRealSync.test.ts` (red): `ESTADOS_CATALOG`
  values === `['1','2','3','4','6']` with labels Activo/Deudor/Inactivo/Incobrable/Baja;
  assert the module re-imports `INTERVAL_PRESETS_MIN` / `minutesToMs` from
  `@/types/gestionRealIngest` (no local copy)
- [ ] 1.2 Create `src/types/gestionRealSync.ts` (green): `SyncConfigDTO { intervalMs:number;
  estados:string[] }`, `UpdateSyncConfigPayload = Partial<Pick<...,'intervalMs'|'estados'>>`,
  `ESTADOS_CATALOG`, plus `estadosEqual(a,b)` set-equality helper; re-export or import the
  interval helpers from `gestionRealIngest.ts`

## Phase 2: API module

- [ ] 2.1 Write `src/__tests__/api/gestionRealSync.api.test.ts` (red, axios-client mocked):
  `getSyncConfig`→GET `/gestion-real/sync/config` returns `data`; `updateSyncConfig(body)`→
  PUT `/gestion-real/sync/config` with exact body returns `data`
- [ ] 2.2 Create `src/api/gestionRealSync.api.ts` (green): `getSyncConfig`, `updateSyncConfig`
  over `axios-client` (status stays in `gestionReal.api.ts`, untouched)

## Phase 3: Hooks

- [ ] 3.1 Write `src/__tests__/hooks/useGestionRealSyncConfig.test.ts` (red, api module mocked,
  QueryClient wrapper): `useSyncConfig` query key `['gestionRealSync','config']`;
  `useUpdateSyncConfig` `onSuccess` invalidates config key + sync-status key
  (`['gestion-real-sync-status']`)
- [ ] 3.2 Create `src/hooks/useGestionRealSyncConfig.ts` (green): `useSyncConfig` (query),
  `useUpdateSyncConfig` (mutation + `invalidateQueries` for config and status). Reuse existing
  `useGestionRealSyncStatus` (do NOT re-implement)

## Phase 4: GestionRealSyncBody — Configuración section

- [ ] 4.1 Write `src/__tests__/pages/scheduling/settings/GestionRealSyncBody.config.test.tsx`
  (red; mock useSyncConfig/useUpdateSyncConfig/useFeatureFlag/useSetFeatureFlag): config load
  `{ intervalMs:300000, estados:['1','3'] }` → interval select shows `5 min`; Activo+Inactivo
  checked, others unchecked; Guardar disabled (clean)
- [ ] 4.2 Add config tests (red): change interval 5→15 min enables Guardar and calls
  `updateSyncConfig` with `intervalMs:900000`; non-preset `intervalMs:200000` renders
  `(personalizado)` option and an untouched save preserves `200000`
- [ ] 4.3 Add estados tests (red): checking Deudor(2) + unchecking Activo(1) on `estados:['1']`
  enables Guardar and saves `estados:['2']` (catalog order); `estados:[]` allowed with hint
- [ ] 4.4 Add flag-toggle tests (red): `useFeatureFlag` `{enabled:true}` → toggle checked;
  switching off calls `useSetFeatureFlag` with `{ key:'gestion-real-sync', enabled:false }`,
  switching on calls with `enabled:true`; toggle is independent of Guardar
- [ ] 4.5 Add save-feedback tests (red): success → "Configuración guardada" + Guardar returns
  disabled; 400 `VALIDATION_ERROR` → Spanish message + no success banner
- [ ] 4.6 Create the CSS module (green): reuse `GestionReal.module.css` (import) or add a thin
  `GestionRealSync.module.css` with an estados-checkbox class composing existing tokens
- [ ] 4.7 Create `src/pages/scheduling/settings/GestionRealSyncBody.tsx` ConfigSection (green):
  `FormState { intervalMs:number; estados:string[] }`, seed from config via `useEffect`,
  dirty compare (`estadosEqual` + intervalMs), interval preset select (reused helpers),
  estados checkboxes from `ESTADOS_CATALOG`, flag toggle via `useFeatureFlag`/`useSetFeatureFlag`
  (no enable-guard), Guardar mutation, `mapSaveError` 400→Spanish

## Phase 5: GestionRealSyncBody — Estado section

- [ ] 5.1 Add tests to the body suite (red; mock `useGestionRealSyncStatus`): renders formatted
  `lastRunAt` + counters (`itemsSynced`, `clientCount`/`contractCount` when present);
  null `lastRunAt` → "Nunca"
- [ ] 5.2 Add StatusSection to `GestionRealSyncBody.tsx` (green): consume
  `useGestionRealSyncStatus`, formatted last-run / "Nunca", counters; export
  `GestionRealSyncBody` composing ConfigSection + StatusSection

## Phase 6: Tab registration

- [ ] 6.1 Update `src/__tests__/pages/scheduling/SchedulingSettingsPage.test.tsx` (red):
  "Sincronización" tab appears; selecting it renders the 2 sections; existing tabs
  (incl. "Gestión Real") still present and unreordered
- [ ] 6.2 Modify `src/pages/scheduling/SchedulingSettingsPage.tsx` (green): add
  `{ id:'gestion-real-sync', label:'Sincronización', content:<GestionRealSyncBody /> }` to
  `TABS` (append — do NOT reorder), import the body; lazy mount via existing `mountMode="lazy"`

## Phase 7: Verification gate

- [ ] 7.1 Run `npx vitest run` — all new gestionRealSync tests green + full-suite regression
- [ ] 7.2 Run `tsc --noEmit` — no type errors
- [ ] 7.3 (Optional) Playwright MCP smoke: open `/admin/scheduling/settings#gestion-real-sync`,
  verify toggle + interval + estados render and Guardar persists
