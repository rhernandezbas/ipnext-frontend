# ADR 0003 — Patrón Container / Presentational

**Status:** Aceptado (vigente, con aplicación desigual)

## Contexto

Mezclar fetching, lógica de estado y markup en el mismo componente hace que sean imposibles de
testear y reusar. Se necesita separar "qué datos" de "cómo se ven".

## Decisión

Separar responsabilidades:

- **Containers** = `src/pages/*`. Llaman a hooks de TanStack Query, derivan/filtran datos, manejan
  estado de UI local (modales abiertos, vista activa) y **componen** componentes presentacionales.
- **Presentational** = `src/components/*`. Reciben todo por props, no llaman a hooks de datos, son
  puros respecto al server state. Idealmente testeables en aislamiento.

Ejemplo de manual — [`GestionRealSyncBadge`](../../src/components/gestionReal/GestionRealSyncBadge.tsx):
es **puro**, recibe `status` e `isError` por props. El hook `useGestionRealSyncStatus` lo posee la
page ([`ClientesListPage`](../../src/pages/clientes/ClientesListPage.tsx)), que se lo pasa hacia
abajo. El propio JSDoc del componente lo deja explícito: *"Pure — the page owns the hook and passes
status/isError down."*

Las carpetas-módulo de page (ver tdr/0002) llevan esto al extremo: `index.tsx` es el container, y
`components/` interno son vistas presentacionales (`TasksTableView`, `TasksKanbanView`,
`KanbanCard`) que reciben `tasks` y callbacks.

## Consecuencias

**Positivas**
- Componentes de `src/components/` testeables sin red ni QueryClient.
- Las vistas (tabla vs kanban) se intercambian en el container sin tocar la presentación.

**Negativas / deuda**
- ⚠ **Aplicación desigual.** No todas las pages respetan el corte. Hay containers que mezclan
  filtrado de negocio con markup pesado inline (headers con SVGs, lógica de derivación), y algunos
  componentes "presentacionales" reciben tantas props que delatan acoplamiento. El patrón existe y
  está bien aplicado en las features modernas (scheduling, gestionReal), menos en las viejas.
- No hay un linter/regla que prohíba `useQuery` dentro de `src/components/`; es disciplina, no
  garantía.
