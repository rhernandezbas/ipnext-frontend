# Tasks — contracts-gr-id-column

> TDD Mode: ACTIVE. Test PRIMERO (red) → implementación (green) → refactor.
> Scope: FE only. 3 archivos. Sin cambios de BE, sin nuevos permisos, sin routing.

---

## Batch 1 — Test primero: fixtures + CP-7 (RED)

- [ ] **T01** `src/__tests__/contracts/ContractsListPage.test.tsx`:
  Agregar el campo `code` a las dos fixtures de `mockContracts`:
  - `mockContracts[0]`: `code: 'CTR-204382'`
  - `mockContracts[1]`: `code: null`

  > En este punto el archivo NO compila (TypeScript strict) porque `ContractSummary`
  > todavía no tiene `code`. Dejar en este estado — es el RED esperado de TDD.

- [ ] **T02** `src/__tests__/contracts/ContractsListPage.test.tsx`:
  Agregar el bloque `describe('CP-7: columna ID GR', ...)` con 4 tests al final
  del archivo (después de CP-6):
  1. `renders the "ID GR" column header` — `getByRole('columnheader', { name: /id gr/i })`
  2. `renders the GR code for a contract with code` — `getByText('CTR-204382')`
  3. `renders "—" for a contract with null code` — `getAllByText('—').length >= 2`
  4. `renders the ID GR column as the first column` — `getAllByRole('columnheader')[0]` has text /id gr/i

  > Los 4 tests están RED. La columna no existe en el componente.

---

## Batch 2 — Tipo: hacer compilar las fixtures

- [ ] **T03** `src/types/contract.ts`:
  Agregar `code: string | null` a `ContractSummary`, después de `clientName` y antes de `plan`.
  Comentario: `// grContratoId expuesto por el BE (#55)`.

  > Las fixtures de T01 ahora compilan. Los 4 tests de CP-7 siguen RED
  > (la columna no está en el componente todavía).

---

## Batch 3 — Implementación: hacer pasar CP-7

- [ ] **T04** `src/pages/contracts/ContractsListPage.tsx`:
  En `getColumns()`, insertar como PRIMER elemento del array retornado:
  ```ts
  {
    label: 'ID GR',
    key: 'code',
    sortable: false,
    render: (row) => row.code ?? '—',
  },
  ```

  > Los 4 tests de CP-7 pasan (GREEN). Todos los tests CP-0 a CP-6 preexistentes
  > deben seguir en GREEN (verificar que ningún assert de posición de header se rompe).

---

## Batch 4 — Verificación final

- [ ] **T05** Correr `npx vitest run src/__tests__/contracts/ContractsListPage.test.tsx`
  y confirmar que todos los tests (CP-0 a CP-7) pasan en GREEN.

- [ ] **T06** Correr `tsc --noEmit` y confirmar cero errores de tipo.

---

## Dependencias

```
T01 → T02    (fixtures antes que tests — mismo archivo)
T02          (CP-7 RED — depende de T01)
T03          (tipo — desbloquea compile; depende de T01 para que tenga sentido)
T04          (columna — depende de T03; hace GREEN los tests de T02)
T05, T06     (verificación — dependen de T04)
```

---

## Notas

- No se modifican los tests existentes CP-0 a CP-6 (solo se agregan campos a fixtures).
- El campo `code` en la degraded-case de CP-1b (`as unknown as ContractSummary`) no
  requiere cambio porque usa un cast explícito.
- No se crean archivos nuevos.
- No se toca `src/App.tsx`, hooks, API layer, ni ningún componente distinto a
  `ContractsListPage.tsx`.
