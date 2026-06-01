# sessions-view Specification

**Capability**: `sessions-view`
**Type**: Delta — refactoriza `SessionsBody` en dos secciones y agrega `useSessionHistory`.
**Change**: `sessions-view-refactor`
**Components touched**: `SessionsBody.tsx` (modificado), `sessions.api.ts` (modificado), `useSessions.ts` (modificado).

---

## Added Requirements

### REQ-SV-1: Sección "Sesiones activas"

`SessionsBody` MUST render a clearly labeled section "Sesiones activas" containing the active sessions table.

#### Scenario: Hay sesiones activas

**Given** `useActiveSessions` devuelve 3 sesiones activas
**When** se renderiza `SessionsBody`
**Then** MUST mostrarse el encabezado "Sesiones activas"
**And** MUST mostrarse una tabla con 3 filas
**And** cada fila MUST mostrar: Actor, IP, Navegador, Inicio (`loginAt`), Última actividad (`lastSeenAt`)
**And** cada fila MUST tener un botón "Forzar logout"

#### Scenario: No hay sesiones activas — estado vacío

**Given** `useActiveSessions` devuelve lista vacía
**When** se renderiza `SessionsBody`
**Then** MUST mostrarse el encabezado "Sesiones activas"
**And** MUST mostrarse un mensaje de estado vacío (ej. "No hay sesiones activas")
**And** NO MUST mostrarse filas de tabla

#### Scenario: Cargando sesiones activas

**Given** `useActiveSessions` está en estado `isLoading: true`
**When** se renderiza `SessionsBody`
**Then** MUST mostrarse un indicador de carga en la sección activas
**And** NO MUST mostrarse filas de tabla hasta que la carga complete

---

### REQ-SV-2: Sección "Historial"

`SessionsBody` MUST render a clearly labeled section "Historial" below the active sessions section, containing revoked sessions in read-only mode.

#### Scenario: Hay sesiones en el historial

**Given** `useSessionHistory` devuelve 5 sesiones revocadas
**When** se renderiza `SessionsBody`
**Then** MUST mostrarse el encabezado "Historial"
**And** MUST mostrarse una tabla con 5 filas
**And** cada fila MUST mostrar: Actor, IP, Navegador, Inicio (`loginAt`), Revocada (`revokedAt` formateada)
**And** ninguna fila MUST contener un botón de acción

#### Scenario: Historial vacío — estado vacío

**Given** `useSessionHistory` devuelve lista vacía
**When** se renderiza `SessionsBody`
**Then** MUST mostrarse el encabezado "Historial"
**And** MUST mostrarse un mensaje de estado vacío (ej. "No hay sesiones en el historial")
**And** NO MUST mostrarse filas de tabla

#### Scenario: Cargando historial

**Given** `useSessionHistory` está en estado `isLoading: true`
**When** se renderiza `SessionsBody`
**Then** MUST mostrarse un indicador de carga en la sección historial
**And** la sección activas MUST renderizarse independientemente (no bloquear)

---

### REQ-SV-3: Forzar logout solo en sesiones activas

The "Forzar logout" action MUST be available exclusively in the "Sesiones activas" section. The "Historial" section MUST NOT contain any action button.

#### Scenario: Historial sin acciones

**Given** sesiones en el historial
**When** se renderiza `SessionsBody`
**Then** NO MUST existir en la sección historial ningún elemento con texto "Forzar logout" ni botón de acción

#### Scenario: Forzar logout en activas — comportamiento conservado

**Given** `useRevokeSession` disponible
**When** se hace clic en "Forzar logout" en una fila de activas
**Then** MUST llamarse `useRevokeSession.mutate` con el `id` de la sesión correspondiente
**And** el comportamiento MUST ser idéntico al existente antes de este refactor

---

### REQ-SV-4: Hook useSessionHistory

A `useSessionHistory(page?, pageSize?)` hook MUST encapsulate the data fetching logic for revoked sessions, using TanStack Query and calling `GET /api/admin/sessions/history`.

#### Scenario: Llamada con params default

**Given** el hook renderizado con params omitidos
**When** se monta el componente
**Then** MUST llamarse `GET /api/admin/sessions/history?page=1&pageSize=20`

#### Scenario: Llamada con params explícitos

**Given** el hook con `page=2, pageSize=10`
**When** se monta el componente
**Then** MUST llamarse `GET /api/admin/sessions/history?page=2&pageSize=10`

#### Scenario: Datos devueltos por el hook

**Given** la API retorna `{ data: [...], total: 25, page: 1, pageSize: 20 }`
**When** el hook resuelve
**Then** MUST exponer `{ sessions, total, isLoading, isError }` al componente consumidor

---

### REQ-SV-5: revokedAt formateado en el historial

The `revokedAt` field in the history table MUST be displayed as a human-readable localized date-time string.

#### Scenario: revokedAt en formato legible

**Given** una sesión con `revokedAt: "2026-05-29T14:33:00.000Z"`
**When** se renderiza la fila en el historial
**Then** MUST mostrarse una fecha/hora legible (ej. `29/05/2026 14:33`) y NO la cadena ISO cruda

---

## Modified Requirements

### REQ-SV-API-1: getSessionHistory en sessions.api.ts (MODIFIED — extensión aditiva)

`sessions.api.ts` MUST export a `getSessionHistory(page: number, pageSize: number): Promise<SessionHistoryResponse>` function that calls `GET /api/admin/sessions/history`.

#### Scenario: Función exportada y tipada correctamente

**Given** el módulo `sessions.api.ts` importado
**When** se llama `getSessionHistory(1, 20)`
**Then** MUST retornar una Promise con `{ data: SessionDTO[], total: number, page: number, pageSize: number }`
**And** el tipo `SessionDTO` MUST incluir `revokedAt: string | null`

---

## Invariants

- I-1: El botón "Forzar logout" MUST NOT renderizarse en la sección historial. Verifiable: test que busca el botón dentro del contenedor del historial → 0 ocurrencias.
- I-2: Las dos secciones MUST ser semánticamente distinguibles (ej. encabezados `h2`/`h3` o atributos `data-testid` distintos).
- I-3: `useActiveSessions` y `useRevokeSession` MUST NOT ser modificados — solo se consumen sin cambios.
- I-4: El permiso `sessions.revoke` sigue controlando la visibilidad del botón "Forzar logout" en activas (sin cambios en lógica de permisos).

## Non-Regression

- NR-1: Los tests existentes de `useActiveSessions` y `useRevokeSession` pasan sin modificaciones.
- NR-2: El resto de tabs de `AdminPage.tsx` no se ve afectado.
- NR-3: `tsc` con 0 errores (tipos del DTO extendido son compatibles con los consumidores existentes).
