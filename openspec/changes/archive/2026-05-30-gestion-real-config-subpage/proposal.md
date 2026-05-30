# Proposal: gestion-real-config-subpage

## Intent

Contraparte frontend del backend ya implementado `gestion-real-installation-ingest`, que ingesta órdenes de instalación de Gestión Real como `ScheduledTasks`. Hoy ese ingest corre sin UI: el operador no puede configurarlo, ni ver si corrió, ni revisar las tareas que cayeron en revisión. Esta subpágina ("Gestión Real", un tab nuevo en la Configuración de Scheduling) le da al operador de logística un solo lugar para **configurar**, **monitorear** y **revisar** ese ingest, consumiendo exactamente los 4 endpoints que el backend ya expone.

## Scope

### In Scope
- `src/types/gestionRealConfig.ts` — tipos alineados 1:1 a los 4 DTOs del backend (`IngestConfigDTO`, `IngestStatusDTO`, `NeedsReviewTaskDTO`).
- `src/api/gestionRealIngest.api.ts` — módulo API sobre `axios-client` (GET/PUT config, GET status, GET needs-review).
- `src/hooks/useGestionRealIngest.ts` — query/mutation con `invalidateQueries` (config + status), patrón `useProjects`.
- `src/pages/scheduling/settings/GestionRealBody.tsx` (+ `.module.css`) — el tab con 3 secciones: Configuración, Estado, Revisión pendiente.
- Registro del tab en `SchedulingSettingsPage.tsx` (una línea en `TABS`: `{ id:'gestion-real', label:'Gestión Real', content:<GestionRealBody /> }`).
- Tests Vitest (api mockeada, hooks, render del body con sus 3 secciones).

### Out of Scope
- Backend (endpoints, ingest, modelo) — ya existe; no se toca ni se cambian shapes.
- IClass y cualquier otro tab de Configuración.
- Crear endpoints nuevos o paginar needs-review.
- Editar/accionar tareas desde la lista de revisión (solo lectura).
- Cambio de routing — es un tab dentro de una página ya ruteada.

## Capabilities

### New Capabilities
- `gestion-real-ingest-config`: subpágina para configurar (enabled/interval/window/proyectos), monitorear estado y listar tareas en revisión del ingest de Gestión Real.

### Modified Capabilities
- None.

## Approach

Capa de datos primero (types → api → hook), patrón query+mutation con invalidación de `useProjects`. El `GestionRealBody` consume HOOKS (nunca axios directo) y arma 3 secciones:
1. **Configuración** (form): toggle `enabled`; intervalo mostrado en **minutos** al usuario pero persistido como `intervalMs` (conversión en el borde del form); `windowMonths`; dos dropdowns de Proyecto (Fibra / Wireless) desde `useProjects('all')`. Guarda via PUT. Guard UX: si el usuario habilita el ingest con algún proyecto destino sin mapear, advertir claramente (espeja el bug backend C1: orden clasificada sin proyecto → needs-review).
2. **Estado** (panel): `lastRunAt` formateado + los 4 contadores; refetchable.
3. **Revisión pendiente** (lista): tareas needs-review (title, address, grOrdenId, createdAt) para logística (solo lectura).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/types/gestionRealConfig.ts` | New | Tipos alineados a los 4 DTOs |
| `src/api/gestionRealIngest.api.ts` | New | GET/PUT config, GET status, GET needs-review |
| `src/hooks/useGestionRealIngest.ts` | New | queries + mutation con invalidación |
| `src/pages/scheduling/settings/GestionRealBody.tsx` (+ css) | New | Tab con las 3 secciones |
| `src/pages/scheduling/SchedulingSettingsPage.tsx` | Modified | +1 entrada en `TABS` |
| `src/__tests__/...` | New | api/hook/body |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Conversión minutos↔ms mal hecha (off-by-1000) | Med | Conversión centralizada en el form + test explícito |
| Habilitar ingest sin proyecto mapeado genera ruido de needs-review | Med | Guard/advertencia en el toggle antes de guardar |
| 404 PROJECT_NOT_FOUND / 400 VALIDATION_ERROR del PUT | Low | Mapear `error.response.data.code` a mensaje es; no confirmar guardado |

## Rollback Plan

Revertir los commits del front. Sin migración ni estado persistido en el FE. Quitar la entrada del `TABS` deja la app idéntica a hoy; el backend sigue ingestando igual.

## Dependencies

- Endpoints backend `gestion-real-installation-ingest` desplegados (ya existen).

## Success Criteria

- [ ] Tab "Gestión Real" visible en Configuración de Scheduling, deep-linkable (`#gestion-real`).
- [ ] Configuración carga, edita y guarda (minutos↔ms correcto); errores 400/404 con mensaje claro.
- [ ] Advertencia al habilitar con proyecto destino sin mapear.
- [ ] Estado muestra última corrida + 4 contadores, refetchable.
- [ ] Revisión pendiente lista las tareas needs-review.
- [ ] Tests Vitest verdes; `tsc --noEmit` limpio; sin romper tabs existentes.

## Open Questions

- Input de intervalo: minutos como número simple vs selector preestablecido (5/15/30/60).
- Guardado: botón explícito "Guardar" vs save-on-blur por campo.
- Estado: refetch manual (botón) vs polling automático; si polling, ¿intervalo?
- ¿Las filas de Revisión pendiente deben linkear al detalle de la tarea (`/...tasks/:id`) o quedan solo lectura sin navegación?
