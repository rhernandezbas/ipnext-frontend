# Proposal: sessions-view-refactor

## Intent

Refactorizar `SessionsBody` para separar visualmente y funcionalmente las **sesiones activas** (con acción "Forzar logout") del **historial de sesiones revocadas** (read-only, fecha de revocación). Hoy todo coexiste en una sola tabla sin distinción; el usuario no puede saber si una sesión fue forzada ni cuándo. El cambio introduce un nuevo hook `useSessionHistory` que consume `GET /api/admin/sessions/history` (nuevo endpoint BE) y reorganiza la UI en dos secciones claramente etiquetadas.

## Scope

### In Scope
- Nueva función en `src/api/sessions.api.ts`: `getSessionHistory(page, pageSize)` → consume `GET /api/admin/sessions/history`.
- Nuevo hook `useSessionHistory(page, pageSize)` en `src/hooks/useSessions.ts` (o archivo propio si aplica convención del proyecto).
- Refactor de `SessionsBody.tsx` en dos secciones:
  - **Sesiones activas**: tabla existente con columnas Actor, IP, Navegador, Inicio (`loginAt`), Última actividad (`lastSeenAt`), Forzar logout. Sin cambios de lógica.
  - **Historial**: tabla nueva read-only con columnas Actor, IP, Navegador, Inicio (`loginAt`), Revocada (`revokedAt`). Sin botón de acción.
- Estados vacío y carga independientes por sección.
- Tests unitarios de `useSessionHistory` y tests de renderizado de `SessionsBody` (Vitest).

### Out of Scope
- Cambios en `useActiveSessions` / `useRevokeSession` (sin modificaciones).
- Paginación UI del historial (puede agregarse en iteración posterior; el hook acepta `page`/`pageSize` pero la UI arranca con valores default fijos).
- Filtros en el historial (actor, IP, fecha).
- Cambios en otros tabs de `AdminPage.tsx`.

## Capabilities

### New Capabilities
- `sessions-view/history`: Visualización paginada del historial de sesiones revocadas. Read-only.

### Modified Capabilities
- `sessions-view/active`: Refactor de presentación (sin cambios de lógica ni permisos). La sección "Sesiones activas" MUST conservar el botón "Forzar logout" con el mismo permiso `sessions.revoke`.

## Approach

**2 commits atómicos**:

1. **Commit 1 — API + Hook (TDD)**: `getSessionHistory` en la capa API, hook `useSessionHistory`, tests del hook.
2. **Commit 2 — UI**: refactor de `SessionsBody` en dos secciones, estado vacío + carga por sección, tests de renderizado.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/api/sessions.api.ts` | Modified | Agrega `getSessionHistory` |
| `src/hooks/useSessions.ts` | Modified | Agrega `useSessionHistory` |
| `src/pages/system/admin/SessionsBody.tsx` | Modified | Dos secciones: activas + historial |
| `src/__tests__/hooks/useSessionHistory.test.ts` | New | Tests unitarios del hook |
| `src/__tests__/pages/SessionsBody.test.tsx` | New | Tests de renderizado |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `revokedAt` ausente en el tipo API actual | Low | Agregar campo al tipo `Session` en la capa API (aditivo) |
| Regresión en la sección activas al refactorizar | Low | Tests de renderizado cubren los dos casos (con y sin sesiones activas) |
| Doble fetch al montar la página | Low | `useSessionHistory` solo se llama cuando el tab Sessions está activo (misma estrategia que `useActiveSessions`) |

## Rollback Plan

- `git revert` del commit 2 revierte la UI; el hook y la API quedan en el commit 1, ambos sin side effects si no se consumen.
- `git revert` del commit 1 elimina el hook y la llamada API — sin estado persistente.

## Success Criteria

- [ ] `SessionsBody` renderiza dos secciones con encabezados distinguibles ("Sesiones activas" / "Historial").
- [ ] La sección activas conserva el botón "Forzar logout" (permiso `sessions.revoke`).
- [ ] La sección historial muestra `revokedAt` formateada; sin acciones.
- [ ] Estado vacío visible por sección cuando no hay datos.
- [ ] Estado de carga (skeleton o spinner) por sección.
- [ ] `useSessionHistory` llama a `GET /api/admin/sessions/history` con `page` y `pageSize`.
- [ ] Tests nuevos: mínimo 4 del hook + 4 de renderizado.
- [ ] Sin regresión en los tests existentes de `useActiveSessions` / `useRevokeSession`.
