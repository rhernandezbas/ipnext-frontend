# Change Proposal: contracts-gr-id-column (backlog #116)

## Intent

Hacer visible el ID de Gestión Real del contrato (`grContratoId`) en la page de lista de
contratos (`/admin/contracts`). El usuario necesita ver este código para identificar
contratos en el sistema GR sin tener que salir de Prominense.

## Why

El campo `grContratoId` ya existe en el backend desde el cambio `iclass-contract-code`
(#55). El BE lo expone como `code: string | null` en el `ContractSummaryDto`. La tabla
de contratos del FE NO lo muestra todavía. Es un dato de negocio crítico para operaciones
y soporte.

## Scope

**FE only.** El backend YA expone el campo `code` (= `grContratoId`) en la respuesta de
`GET /contracts`. No se toca ningún archivo del BE.

En el FE, el cambio es acotado:
1. `src/types/contract.ts` — agregar `code: string | null` a `ContractSummary`.
2. `src/pages/contracts/ContractsListPage.tsx` — agregar la columna "ID GR" en
   `getColumns()`, con un `render` que muestra `row.code ?? '—'` para el empty-state.
3. `src/__tests__/contracts/ContractsListPage.test.tsx` — extender las fixtures y
   agregar el test CP-7 que afirma la nueva columna.

## Decisiones

### Label de la columna
**"ID GR"** — conciso, reconocible por el equipo de operaciones (GR = Gestión Real).
Alternativa considerada: "Cód. GR" — rechazado por ser más largo y menos habitual en la
UI interna. "ID GR" sigue el patrón de otras columnas cortas de la tabla.

### Posición de la columna
Primera columna (antes de "Cliente"). Motivo: el ID GR es el identificador primario del
contrato en el sistema externo; la operación busca el contrato por este ID. Columna de
referencia primaria va primero. Alternativa: última columna — rechazado porque el usuario
tiene que hacer scroll horizontal en tablas anchas.

### Empty-state para null
`'—'` (guión largo em-dash, U+2014) — ya es el patrón establecido en la columna
"Tecnología" de la misma tabla. Contratos sin `grContratoId` (si los hubiera) muestran
`'—'` en lugar de celdas vacías.

### Dato fuente
`ContractSummary.code` — el campo que el BE envía desde `feat/55-iclass-contract-code`.
No se mapea ni transforma: se renderiza directamente.

## Out of scope

- Cambios en el backend (cero).
- Filtrado o búsqueda por ID GR — no solicitado.
- Nuevos permisos — la columna queda dentro del guard `contracts.read` existente; no se
  agrega permiso nuevo.
- Columna en el tab "Contratos" del cliente (`ContractsTab.tsx`) — distinto componente,
  distinto backlog.
- Hacer el ID GR clickeable / linkeable — no solicitado.
