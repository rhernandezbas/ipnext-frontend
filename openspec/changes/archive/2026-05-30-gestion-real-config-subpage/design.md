# Design: gestion-real-config-subpage

## Technical Approach

FE-only feature, data-layer first (types → api → hook → component), mirroring the IClass back-office pattern. A new `GestionRealBody` tab is registered in `SchedulingSettingsPage` and composes three sections (Configuración / Estado / Revisión pendiente) over the 4 existing backend endpoints. Components consume hooks only; axios lives in the api module. Styling reuses the existing `IClassSettings.module.css` token vocabulary (statusCard, switch, select, banner, table) replicated in a dedicated `GestionReal.module.css`.

## Architecture Decisions

| Decision | Options | Choice & rationale |
|----------|---------|--------------------|
| Component split | Single `GestionRealBody` vs split sub-components | **Single file** with 3 internal section components in the same module (ConfigSection/StatusSection/NeedsReviewSection). Mirrors IClass bodies (one body per concern); sections are not reused elsewhere, so separate files add no value. |
| Toggle/Select atoms | Build atoms vs native | **Native** `<input type="checkbox">` + `<select>` styled via CSS module — repo has NO atoms dir; IClass uses native `.switch`/`.select` classes. Follow existing pattern. |
| Interval input | Free minutes vs preset selector | **Preset `<select>`** 3/5/15/30/60 (settled). Non-matching loaded `intervalMs` → inject an extra `custom` option showing `Math.round(ms/60000) min` so it renders gracefully and is selectable. |
| Save UX | save-on-blur vs explicit button | **Explicit "Guardar"** button; disabled when `!dirty || isPending`. Single PUT of the edited config subset. |
| Dirty tracking | deep-compare vs ref snapshot | **Shallow compare** local form state vs the loaded config (4 scalar fields). Reset baseline on query data change and on mutation success. |
| Status refresh | manual button vs polling | **Polling** via TanStack `refetchInterval: 30_000` (settled). |
| Enable guard | block vs confirm | **Block before PUT**: if turning `enabled` true while either projectId null, show inline warning banner and disable Guardar until a project is mapped (no silent confirm). Surfaces the C1 backend risk explicitly. |

## Data Flow

```
useProjects('all') ─────────────┐
                                 ▼ (dropdown options)
GET config ──► useGestionRealConfig ──► form baseline ──► local state (dirty)
                                                              │ Guardar
                                                              ▼
                                        useUpdateGestionRealConfig ─► PUT
                                                              │ onSuccess
                                                              ▼ invalidate [config],[status]
GET status (refetchInterval 30s) ──► useGestionRealStatus ──► StatusSection
GET needs-review ──► useGestionRealNeedsReview ──► rows → <Link to=/admin/scheduling/tasks/:id>
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/types/gestionRealIngest.ts` | Create | `IngestConfigDTO`, `IngestStatusDTO`, `NeedsReviewTaskDTO`, `INTERVAL_PRESETS_MIN`, `minutesToMs`/`msToMinutes` helpers |
| `src/api/gestionRealIngest.api.ts` | Create | `getConfig`/`updateConfig`/`getStatus`/`getNeedsReview` over axios-client (`/gestion-real-ingest/*`) |
| `src/hooks/useGestionRealIngest.ts` | Create | 3 queries + 1 mutation, query keys + invalidation |
| `src/pages/scheduling/settings/GestionRealBody.tsx` | Create | Tab body, 3 sections, form state, guard, error mapping |
| `src/pages/scheduling/settings/GestionReal.module.css` | Create | Section/grid/counter/select/switch/banner classes (tokens) |
| `src/pages/scheduling/SchedulingSettingsPage.tsx` | Modify | +1 `TABS` entry `{ id:'gestion-real', label:'Gestión Real', content:<GestionRealBody /> }` |
| `src/__tests__/.../GestionRealBody.test.tsx`, `useGestionRealIngest.test.ts`, `gestionRealIngest.api.test.ts` | Create | Vitest, axios mocked at `src/api/*` |

## Interfaces / Contracts

```ts
// types/gestionRealIngest.ts
export interface IngestConfigDTO { enabled: boolean; intervalMs: number; windowMonths: number; fiberProjectId: string | null; wirelessProjectId: string | null; }
export interface IngestStatusDTO { lastRunAt: string | null; created: number; skippedDuplicate: number; skippedUnmirrored: number; unclassified: number; }
export interface NeedsReviewTaskDTO { id: string; title: string; description: string | null; grOrdenId: string | null; projectId: string | null; customerId: string | null; serviceId: string | null; address: string | null; category: string; priority: string; stageId: string; createdAt: string; }
export const INTERVAL_PRESETS_MIN = [3, 5, 15, 30, 60] as const;
export const minutesToMs = (m: number) => m * 60_000;
export const msToMinutes = (ms: number) => Math.round(ms / 60_000);
```

PUT body = `Partial<Pick<IngestConfigDTO, 'enabled'|'intervalMs'|'windowMonths'|'fiberProjectId'|'wirelessProjectId'>>` (send full edited config). Errors: 400 `VALIDATION_ERROR`, 404 `PROJECT_NOT_FOUND` → mapped via `error.response.data.code`.

Query keys: `['gestionRealIngest','config']`, `['gestionRealIngest','status']`, `['gestionRealIngest','needsReview']`. Mutation `onSuccess` invalidates `config` + `status`. Status query `refetchInterval: 30_000`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| api | endpoints call right URL/method/body | mock axios-client, assert calls |
| hook | invalidation targets, refetchInterval set | mock api module, QueryClient wrapper |
| body | tab renders 3 sections; config load populates form | mock hooks/api, RTL render |
| body | Guardar sends converted `intervalMs` (5→300000); disabled when clean | userEvent + assert mutation payload |
| body | 400/404 → Spanish message, no success | reject mock with `code` |
| body | enable-with-unmapped-project → warning + Guardar blocked | toggle enabled, null projects |
| body | status: 4 counters + formatted lastRunAt / "Nunca" | both states |
| body | needs-review: rows with link `/admin/scheduling/tasks/:id`; empty state | array + empty array |

## Migration / Rollout

No migration. Rollback = remove the `TABS` entry; backend unaffected.

## Open Questions

- None blocking. Date formatting helper: reuse existing scheduling date util if present, else `toLocaleString('es-AR')`.
