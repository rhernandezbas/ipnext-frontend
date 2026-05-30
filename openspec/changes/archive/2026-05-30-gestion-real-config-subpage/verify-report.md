# Verify Report: gestion-real-config-subpage

**Verdict:** PASS

**Date:** 2026-05-29
**Target:** worktree `ipnext-frontend-gr-config`, branch `feat/gestion-real-config-subpage` (uncommitted)

## Summary

All 9 requirements / 17 scenarios from the spec have implementing code AND an asserting test. Standards (hooks-only components, CSS-Module tokens, Spanish copy, `@/*` alias, no raw data leakage) are met. Tasks.md is fully checked and accurate. Tests and typecheck are green with zero regression.

- **Tests:** 169 files / 1348 passed + 1 todo, 0 failures. GestionReal subset: 36/36 passing across 6 files.
- **Typecheck:** 12 errors total, ALL in pre-existing unrelated files (StatsTab, NotasCreditoPage, ProformasPage, GponPage, InventoryLegacyPage, RadiusSessionsPage, CustomerSidebar, SettingsPage, TariffsPage). 0 errors from any new GestionReal file. 0 delta vs the ~12 baseline.

## Spec Coverage Matrix

| Requirement | Scenario | Code | Test | Status |
|---|---|---|---|---|
| Tab Registration | Tab visible + 3 sections | `SchedulingSettingsPage.tsx:17` TABS entry | `pages/scheduling/SchedulingSettingsPage.test.tsx` (tab in list + 3 section headings); `scheduling/SchedulingSettingsPage.test.tsx` (6 tabs in order) | PASS |
| Config Load | Form populated | `GestionRealBody.tsx:68-96` ConfigSection + `configToForm` | `GestionRealBody.test.tsx` "populates the form from the loaded config" | PASS |
| Interval Preset | minutes↔ms 5→300000 | `types:50` `minutesToMs`; `GestionRealBody.tsx:109` | types test `minutesToMs(5)===300000`; body "Guardar sends...intervalMs converted 5→300000" | PASS |
| Interval Preset | non-preset graceful | `types:60` `resolveIntervalPreset`; `GestionRealBody.tsx:99,145-149` custom option | types test non-preset; body "renders a non-preset intervalMs gracefully" (custom option) | PASS |
| Edit and Save | save sends PUT, disabled clean/pending | `GestionRealBody.tsx:105-115,221-229` | body: "Guardar disabled when clean", "editing enables", "disabled while pending", payload assertion | PASS |
| Save Error | 400 VALIDATION_ERROR Spanish | `GestionRealBody.tsx:51-62` `mapSaveError`:55 | body "shows a Spanish validation message on 400" | PASS |
| Save Error | 404 PROJECT_NOT_FOUND Spanish | `mapSaveError:58` | body "shows a Spanish project-not-found message on 404" | PASS |
| Enable Guard | unmapped project blocks save | `GestionRealBody.tsx:94-96,106,199-207,225` | body "enable-guard...shows warning and blocks Guardar" | PASS |
| Project Dropdowns | (sin asignar)=null from useProjects('all') | `GestionRealBody.tsx:70,173-196` | body "project dropdowns include (sin asignar)...null" | PASS |
| Status Panel | 4 counters + lastRunAt formatted | `GestionRealBody.tsx:238-272` | body "renders the 4 counters" | PASS |
| Status Panel | "Nunca" when null | `GestionRealBody.tsx:248-251` | body "shows Nunca when lastRunAt is null" | PASS |
| Status Panel | refetchInterval auto-refresh | `useGestionRealIngest.ts:32` `refetchInterval: 30_000` | hook test "sets refetchInterval to 30000" | PASS |
| Needs-Review | rows + link /admin/scheduling/tasks/:id | `GestionRealBody.tsx:296-319` | body "renders a row...linking to task detail" asserts href | PASS |
| Needs-Review | empty state | `GestionRealBody.tsx:290-294` | body "shows an empty state" | PASS |

## Standards Check

- **Hooks-only components:** PASS. `GestionRealBody.tsx` imports only hooks; axios lives in `gestionRealIngest.api.ts`. No axios in components.
- **Types mirror DTOs:** types match the design contract exactly (`IngestConfigDTO`, `IngestStatusDTO`, `NeedsReviewTaskDTO`, `UpdateIngestConfigPayload`). See contract note below.
- **CSS Modules + tokens:** PASS. `GestionReal.module.css` uses `var(--…)` tokens throughout. (See WARNING on banner colors.)
- **Spanish UI copy:** PASS. All labels/messages in Spanish (Rioplatense: "Asigná", "intentá", "Reintentá").
- **`@/*` alias:** PASS. All cross-module imports use `@/`.
- **No raw data leakage:** PASS. Components render typed DTO fields only.

## Contract Alignment

- FE types match the design.md contract exactly; PUT body shape = `Partial<Pick<IngestConfigDTO,...>>` as specified; error mapping reads `error.response.data.code`.
- Endpoints correct: `/gestion-real-ingest/{config,status,needs-review}` over axios baseURL `/api`.
- **NOTE (not a finding):** the backend `gestion-real-installation-ingest` feature is NOT present in the current `ipnext-backend` checkout (searched: no `gestion-real-ingest` routes, no `windowMonths`/`skippedDuplicate`/`grOrdenId`/`NeedsReview` symbols). Contract was verified against design.md and the api/hook tests, NOT against live backend code. If the backend lives on another branch/repo, confirm field names match before merge — especially `skippedUnmirrored`, `grOrdenId`, and the 400/404 `code` values.

## Findings

### CRITICAL
None.

### WARNING
- **W1 — Hardcoded hex in banners and primary button.** `GestionReal.module.css:103,131,202-218,357` use hardcoded colors: `rgba(13,110,253,0.15)` focus rings, `#fef2f2/#991b1b/#fecaca` (error), `#fffbeb/#92400e/#fde68a` (warning), `#ecfdf5/#065f46/#a7f3d0` (success), `#0b5ed7` (button hover). The design states "no hardcoded colors beyond what IClass already uses." This mirrors the IClassSettings pattern (same literal banner palette), so it is consistent with the existing codebase, but it is not strictly token-based. Acceptable if IClass does the same; flag for a future token pass.

### SUGGESTION
- **S1 — Success banner visibility window is narrow.** `GestionRealBody.tsx:215` shows the success banner only `update.isSuccess && !dirty`. After a successful save the baseline resets via the config-invalidation `useEffect`, so `!dirty` holds and the banner shows — correct. Just note the banner persists until the next edit; consider an auto-dismiss timer for polish (non-blocking).
- **S2 — `windowMonths` has no upper bound / no test.** Input has `min={1}` but no max and no dedicated assertion. The spec does not require validation here (backend validates → 400 path is tested), so this is fine. Optional client-side max for UX.
- **S3 — `mapSaveError` matches on `status===400/404` OR `code`.** Robust (handles missing `code`), but a non-VALIDATION 400 would surface the validation message. Spec only enumerates these two codes, so acceptable.

## Test & Typecheck Detail

```
npx vitest run (full)  → Test Files 169 passed | Tests 1348 passed | 1 todo | 0 failed
GestionReal subset (6) → 36 passed
npm run typecheck      → 12 errors, all pre-existing unrelated files, 0 in GestionReal files (0 delta)
```
