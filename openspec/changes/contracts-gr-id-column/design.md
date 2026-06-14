# Design — contracts-gr-id-column

## Contexto verificado (exploración)

- **`src/types/contract.ts`**: `ContractSummary` tiene `{ id, clientId, clientName, plan, status, technology, startDate }`. El campo `code` NO existe aún — confirmado.
- **`src/pages/contracts/ContractsListPage.tsx`**: define `getColumns(): Column[]` inline (líneas 19-53). Las columnas actuales son: Cliente (con link #56), Plan, Estado, Tecnología (render `?? '—'`), Fecha de inicio. La columna ID GR NO existe — confirmado.
- **`src/components/organisms/DataTable/DataTable.tsx`**: `ColumnDef<T>` toma `{ label, key, sortable?, sortField?, render? }`. El render recibe la fila completa. El patrón para null ya es establecido (`row.technology ?? '—'`).
- **`src/__tests__/contracts/ContractsListPage.test.tsx`**: fixtures `mockContracts[0]` y `[1]` sin campo `code`. Tests existentes: CP-0 a CP-6. Se necesita CP-7 para la nueva columna.
- **`src/api/contracts.api.ts`**: `listContracts` retorna `PaginatedResponse<ContractSummary>`. El BE envía `code` en el payload — el FE lo recibirá automáticamente cuando se agregue al tipo.
- **`src/hooks/useContracts.ts`**: thin wrapper sobre `listContracts` + TanStack Query. Sin cambios.

## Archivos a tocar (inventario completo)

| Archivo | Naturaleza del cambio |
|---|---|
| `src/types/contract.ts` | Agregar `code: string \| null` a `ContractSummary` |
| `src/pages/contracts/ContractsListPage.tsx` | Agregar columna en `getColumns()` |
| `src/__tests__/contracts/ContractsListPage.test.tsx` | Actualizar fixtures + agregar CP-7 |

**Total: 3 archivos.** No se toca ningún archivo de API, hooks, ni App.tsx.

## Decision D1 — Posición de la columna: primera

Opciones evaluadas:
1. **Primera columna** (antes de "Cliente") — el ID GR es el identificador primario del
   contrato en GR; operaciones lo usa como referencia de búsqueda. Visible sin scroll.
2. Última columna — requiere scroll horizontal; el ID queda enterrado. Descartado.
3. Entre "Cliente" y "Plan" — el cliente sigue siendo la identidad principal en el FE;
   el ID GR es el código externo. Posición primera le da más peso visual de lo que el
   flujo interno requiere. Descartado.

**Decisión: primera columna.**

## Decision D2 — render de null: `'—'` (em-dash)

Patrón ya establecido en la columna "Tecnología":
```ts
render: (row) => row.technology ?? '—',
```
Se reutiliza idéntico para `code`. Consistencia visual garantizada.

## Implementación concreta

### 1. `src/types/contract.ts`

```ts
export interface ContractSummary {
  id: string;
  clientId: string;
  clientName: string;
  code: string | null;   // grContratoId expuesto por el BE (#55)
  plan: string;
  status: 'active' | 'inactive' | 'blocked' | 'late' | 'baja';
  technology: string | null;
  startDate: string;
}
```

### 2. `src/pages/contracts/ContractsListPage.tsx` — `getColumns()`

Insertar como primer elemento del array:

```ts
{
  label: 'ID GR',
  key: 'code',
  sortable: false,
  render: (row) => row.code ?? '—',
},
```

El resto de columnas sin cambios. La función `getColumns()` sigue siendo inline — no
amerita extraerla a módulo propio (scope demasiado pequeño).

### 3. `src/__tests__/contracts/ContractsListPage.test.tsx`

**Actualizar fixtures:**

```ts
const mockContracts: ContractSummary[] = [
  {
    id: 'c1',
    clientId: 'client-1',
    clientName: 'Alice García',
    code: 'CTR-204382',        // ← agregar
    plan: 'Plan 50MB',
    status: 'active',
    technology: 'Fibra',
    startDate: '2024-01-01',
  },
  {
    id: 'c2',
    clientId: 'client-2',
    clientName: 'Bob Martínez',
    code: null,                // ← agregar
    plan: 'Plan 100MB',
    status: 'inactive',
    technology: null,
    startDate: '2024-02-01',
  },
];
```

**Agregar describe CP-7 al final del archivo:**

```ts
// ── CP-7: columna ID GR ───────────────────────────────────────────────────────
describe('CP-7: columna ID GR', () => {
  it('renders the "ID GR" column header', () => {
    renderPage();
    expect(screen.getByRole('columnheader', { name: /id gr/i })).toBeInTheDocument();
  });

  it('renders the GR code for a contract with code', () => {
    renderPage();
    expect(screen.getByText('CTR-204382')).toBeInTheDocument();
  });

  it('renders "—" for a contract with null code', () => {
    renderPage();
    // Al menos un "—" viene de la columna ID GR (Bob, code=null)
    // más el "—" de la columna Tecnología (Bob, technology=null)
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('renders the ID GR column as the first column', () => {
    renderPage();
    const headers = screen.getAllByRole('columnheader');
    expect(headers[0]).toHaveTextContent(/id gr/i);
  });
});
```

## Notas de implementación

- **TypeScript**: al agregar `code` al tipo, el compilador forzará que todas las fixtures
  y mocks del test lo incluyan. La fixture de la degraded-case en CP-1b ya usa
  `as unknown as ContractSummary` — no se ve afectada.
- **No hay lazy import ni routing**: ningún cambio en App.tsx.
- **No hay CSS**: la columna hereda los estilos de `DataTable.module.css`.
- **No hay permiso nuevo**: la columna vive dentro de `contracts.read`.

## Seam de tests (strict TDD)

Test file: `src/__tests__/contracts/ContractsListPage.test.tsx`

Orden TDD:
1. Agregar `code` a las fixtures (compile error hasta que se actualice el tipo).
2. Escribir CP-7 (4 tests — todos RED inicialmente).
3. Agregar `code` al tipo (`ContractSummary`) → fixtures compilan, pero tests siguen RED (columna no existe).
4. Agregar la columna en `getColumns()` → tests GREEN.

Los 4 tests de CP-7 son suficientes para cubrir: header present, valor no-null, valor null (em-dash), posición.
