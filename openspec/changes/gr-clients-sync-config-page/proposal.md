# Proposal: gr-clients-sync-config-page

## Intent

Contraparte frontend del backend ya desplegado (Change 2) que sincroniza clientes
de Gestión Real (la "réplica viva"). Hoy ese sync tiene `status` visible (badge vía
`useGestionRealSyncStatus`) pero **no se puede configurar desde la UI**: el operador
no puede ajustar el intervalo, ni elegir qué estados de cliente espejar, ni
prender/apagar el sync. Esta tarea agrega un tab **"Sincronización"** a la
Configuración de Scheduling, **espejando el tab "Gestión Real" (ingest) ya existente**,
para configurar (`intervalMs` + `estados`), prender/apagar (feature flag
`gestion-real-sync`) y monitorear (status existente) el client sync de GR.

## Scope

### In Scope
- `src/types/gestionRealSync.ts` — `SyncConfigDTO { intervalMs, estados: string[] }`,
  `UpdateSyncConfigPayload`, catálogo de estados (1=Activo, 2=Deudor, 3=Inactivo,
  4=Incobrable, 6=Baja). Reusa los presets de intervalo de `gestionRealIngest.ts`.
- `src/api/gestionRealSync.api.ts` — `getSyncConfig` (GET `/gestion-real/sync/config`),
  `updateSyncConfig` (PUT `/gestion-real/sync/config`). El status ya vive en
  `gestionReal.api.ts` (`getGestionRealSyncStatus`).
- `src/hooks/useGestionRealSyncConfig.ts` — `useSyncConfig` (query) +
  `useUpdateSyncConfig` (mutation + invalida config y status).
- `src/pages/scheduling/settings/GestionRealSyncBody.tsx` (+ `.module.css` o reuso de
  tokens) — tab con 2 secciones: **Configuración** (toggle flag + intervalo presets +
  checkboxes de estados, Guardar-cuando-dirty) y **Estado** (última corrida + contadores
  del status existente).
- Registro del tab en `SchedulingSettingsPage.tsx`: una línea en `TABS`
  (`{ id:'gestion-real-sync', label:'Sincronización', content:<GestionRealSyncBody /> }`),
  montaje lazy igual que sus hermanos.
- Tests Vitest (types/helpers, api mockeada, hooks, render del body con sus 2 secciones,
  tab registration).

### Out of Scope
- Backend (endpoints, sync, modelo, whitelist de estados) — ya existe y está desplegado;
  no se toca ni se cambian shapes.
- El tab "Gestión Real" (ingest) y cualquier otro tab de Configuración.
- Refactor del `useGestionRealSyncStatus` / `GestionRealSyncStatus` existentes — se reusan tal cual.
- Crear endpoints nuevos, paginar, o extraer un componente compartido entre ingest y sync
  (ver design — se decide MIRROR, no extract).
- Cambio de routing — es un tab dentro de una página ya ruteada (`/admin/scheduling/settings`).

## Capabilities

### New Capabilities
- `gestion-real-sync-config`: subpágina (tab "Sincronización") para configurar
  (`intervalMs` + `estados`), prender/apagar (flag `gestion-real-sync`) y monitorear
  el client sync de Gestión Real.

### Modified Capabilities
- None. (Se agrega una entrada al `TABS` de `SchedulingSettingsPage`, sin reordenar nada
  ni tocar rutas; los deep-links existentes siguen resolviendo. El hash nuevo
  `#gestion-real-sync` es aditivo.)

## Approach

Capa de datos primero (types → api → hooks), idéntico patrón al ingest:
query + mutation con `invalidateQueries`. El `GestionRealSyncBody` consume **HOOKS**
(nunca axios directo) y arma **2 secciones**:

1. **Configuración** (form, save-when-dirty):
   - **Toggle on/off**: reusa los hooks **genéricos** `useFeatureFlag('gestion-real-sync')`
     + `useSetFeatureFlag()` (mismos que usa el ingest con `'gestion-real-ingest'`).
     El toggle escribe el flag en vivo (independiente del botón Guardar), espejando
     `handleToggleFlag` del ingest. Sin guard de "proyecto sin mapear" (no aplica al sync).
   - **Intervalo**: select de presets en **minutos**, persistido como `intervalMs`
     (conversión en el borde del form). Reusa `INTERVAL_PRESETS_MIN` / `minutesToMs` /
     `resolveIntervalPreset` de `gestionRealIngest.ts`.
   - **Estados**: lista de **checkboxes** desde el catálogo (1,2,3,4,6). El form tiene
     `estados: string[]`; toggle agrega/quita un value. Guardar via PUT parcial.
2. **Estado** (panel, solo lectura): reusa `useGestionRealSyncStatus`. Muestra
   `lastRunAt` formateado, `lastResult`, y contadores (`itemsSynced`, y si vienen,
   `clientCount` / `contractCount`).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/types/gestionRealSync.ts` | New | `SyncConfigDTO`, payload, catálogo de estados; reusa presets del ingest |
| `src/api/gestionRealSync.api.ts` | New | GET/PUT `/gestion-real/sync/config` |
| `src/hooks/useGestionRealSyncConfig.ts` | New | query + mutation con invalidación (config + status) |
| `src/pages/scheduling/settings/GestionRealSyncBody.tsx` (+ css) | New | Tab con 2 secciones |
| `src/pages/scheduling/SchedulingSettingsPage.tsx` | Modified | +1 entrada en `TABS` (aditiva, sin reordenar) |
| `src/__tests__/...` | New | types/api/hooks/body/tab |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Conversión minutos↔ms mal hecha (off-by-1000) | Low | Reusar helpers ya testeados del ingest; test explícito 5min→300000 |
| Enviar un estado fuera del whitelist (1,2,3,4,6) → 400 del PUT | Low | El UI sólo ofrece el catálogo whitelisteado; mapear 400 a mensaje es |
| `estados` vacío deshabilita el sync silenciosamente | Med | El PUT es parcial; documentar que `estados: []` es válido pero se advierte en UI |
| Acoplar prematuramente ingest+sync extrayendo un componente común | Med | Decisión de design: MIRROR (copiar), no extract; sólo se comparten los helpers de intervalo |
| Status 401/404 cuando el flag está off | Low | `useGestionRealSyncStatus` ya tiene `retry:false` y tolera 404 |

## Rollback Plan

Revertir los commits del front. Sin migración ni estado persistido en el FE. Quitar la
entrada del `TABS` deja la app idéntica a hoy; el backend sigue sincronizando igual y el
flag `gestion-real-sync` sigue controlable por otros medios.

## Dependencies

- Endpoints backend desplegados (Change 2): `GET/PUT /api/gestion-real/sync/config`,
  `GET /api/gestion-real/sync/status`. RBAC `gestionReal:read` / `gestionReal:write`.
- Feature flag `gestion-real-sync` existente, togglable vía `PATCH /admin/feature-flags/:key`.
- Helpers de intervalo en `src/types/gestionRealIngest.ts` (reuso, no se duplican).

## Success Criteria

- [ ] Tab "Sincronización" visible en Configuración de Scheduling, deep-linkable (`#gestion-real-sync`).
- [ ] Configuración carga `intervalMs` + `estados` desde el API; edita y guarda (minutos↔ms correcto).
- [ ] Toggle prende/apaga el flag `gestion-real-sync` en vivo (PATCH), espejando el ingest.
- [ ] Checkboxes de estados reflejan el catálogo (Activo/Deudor/Inactivo/Incobrable/Baja) y persisten.
- [ ] Estado muestra última corrida + contadores desde `useGestionRealSyncStatus`.
- [ ] Tests Vitest verdes; `tsc --noEmit` limpio; tabs existentes intactos.

## Open Questions

- ¿`estados: []` (ninguno marcado) debe bloquear Guardar o permitirse con advertencia?
  (Propuesta: permitir + hint "sin estados no se sincroniza nada".)
- ¿El módulo CSS se reusa de `GestionReal.module.css` o se crea uno propio?
  (Propuesta: reusar el existente para no duplicar tokens; ver design.)
