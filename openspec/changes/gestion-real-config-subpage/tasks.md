# Tasks: gestion-real-config-subpage

## Phase 1: Types + preset/helper foundation

- [x] 1.1 Write `src/__tests__/types/gestionRealIngest.test.ts`: `INTERVAL_PRESETS_MIN === [3,5,15,30,60]`, `minutesToMs(5)===300000`, `msToMinutes(300000)===5` (TDD red)
- [x] 1.2 Create `src/types/gestionRealIngest.ts` with `IngestConfigDTO`, `IngestStatusDTO`, `NeedsReviewTaskDTO`, `INTERVAL_PRESETS_MIN`, `minutesToMs`, `msToMinutes` (green)

## Phase 2: API module

- [x] 2.1 Write `src/__tests__/api/gestionRealIngest.api.test.ts` (axios-client mocked): `getConfig`→GET `/gestion-real-ingest/config`, `updateConfig`→PUT `/gestion-real-ingest/config` with body, `getStatus`→GET `/status`, `getNeedsReview`→GET `/needs-review` (red)
- [x] 2.2 Create `src/api/gestionRealIngest.api.ts` implementing the 4 functions over axios-client (green)

## Phase 3: Hooks

- [x] 3.1 Write `src/__tests__/hooks/useGestionRealIngest.test.ts` (api module mocked, QueryClient wrapper): query keys `['gestionRealIngest',...]`, mutation `onSuccess` invalidates `config`+`status`, status query has `refetchInterval: 30000` (red)
- [x] 3.2 Create `src/hooks/useGestionRealIngest.ts`: `useGestionRealConfig`, `useUpdateGestionRealConfig`, `useGestionRealStatus`, `useGestionRealNeedsReview` (green)

## Phase 4: GestionRealBody — Configuración section

- [x] 4.1 Write `src/__tests__/pages/scheduling/settings/GestionRealBody.config.test.tsx` (hooks/api/useProjects mocked): config load populates toggle/interval/window/2 project dropdowns; "(sin asignar)" option present (red)
- [x] 4.2 Add config-section tests: Guardar disabled when clean; edit→Guardar sends PUT with `intervalMs` converted (5min→300000); non-preset `intervalMs` renders custom option without crash (red)
- [x] 4.3 Add config-section tests: 400 `VALIDATION_ERROR`→Spanish validation message + no success; 404 `PROJECT_NOT_FOUND`→Spanish message; enable toggle with null projectId→warning banner + Guardar blocked (red)
- [x] 4.4 Create `src/pages/scheduling/settings/GestionReal.module.css` (statusCard/switch/select/banner/table token classes)
- [x] 4.5 Create `src/pages/scheduling/settings/GestionRealBody.tsx` Configuración section: form state, dirty shallow-compare, interval preset select, project dropdowns from `useProjects('all')`, Guardar mutation, enable-guard, 400/404 error mapping (green)

## Phase 5: GestionRealBody — Estado section

- [x] 5.1 Add tests to `GestionRealBody` suite: 4 counters render; `lastRunAt` formatted; null `lastRunAt`→"Nunca"; status query refetch active (red)
- [x] 5.2 Add StatusSection to `GestionRealBody.tsx`: 4 counters, formatted `lastRunAt`/"Nunca", auto-refresh via hook (green)

## Phase 6: GestionRealBody — Revisión pendiente section

- [x] 6.1 Add tests to `GestionRealBody` suite: rows show title/address/grOrdenId/createdAt, each links `/admin/scheduling/tasks/:id`; empty array→empty state (red)
- [x] 6.2 Add NeedsReviewSection to `GestionRealBody.tsx`: rows with `<Link>` to detail + empty state (green)

## Phase 7: Tab registration

- [x] 7.1 Update `src/__tests__/pages/scheduling/SchedulingSettingsPage.test.tsx`: "Gestión Real" tab appears and selecting it renders the 3 sections (red)
- [x] 7.2 Modify `src/pages/scheduling/SchedulingSettingsPage.tsx`: add `{ id:'gestion-real', label:'Gestión Real', content:<GestionRealBody /> }` to TABS (green)

## Phase 8: Verification gate

- [x] 8.1 Run `npm test` — all GestionReal tests green + full suite regression
- [x] 8.2 Run `npm run typecheck` — no type errors
