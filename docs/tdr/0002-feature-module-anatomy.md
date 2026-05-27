# TDR 0002 — Anatomía de un módulo de feature

Cómo se estructura una feature compleja. Caso de referencia: **SchedulingTasksPage** (gestión de
tareas de campo con workflow + stages, vistas tabla y kanban).

## Dos formatos de page

1. **Page simple** — un solo archivo: `src/pages/<area>/<Nombre>Page.tsx`. Para pantallas que son
   básicamente "lista + filtros + tabla" (ej. `ClientesListPage.tsx`, `LeadsPage.tsx`).

2. **Page-módulo** — una carpeta cuando la pantalla tiene varias vistas, estado de UI rico y
   componentes/hooks locales. Estructura:

```
src/pages/scheduling/SchedulingTasksPage/
├── index.tsx                     # CONTAINER: orquesta hooks + compone vistas
├── SchedulingTasksPage.tsx       # shim de re-export que apunta al index (ver nota de routing)
├── SchedulingTasksPage.module.css
├── components/                   # PRESENTACIONALES locales de esta feature
│   ├── TasksTableView.tsx        # vista tabla (+ ALL_TASK_COLUMNS exportado)
│   ├── TasksKanbanView.tsx       # vista kanban (drag & drop con @dnd-kit)
│   ├── KanbanColumn.tsx / KanbanCard.tsx
│   ├── TaskFilterBar.tsx         # filtros + toggle de vista
│   ├── ColumnSelector.tsx        # selector de columnas visibles
│   ├── CreateTaskModal.tsx
│   └── CustomerPicker.tsx
└── hooks/                        # HOOKS locales (no van a src/hooks porque son de esta page)
    ├── useTasksFilterUrl.ts      # sincroniza filtros con la URL (query string)
    └── useVisibleColumns.ts      # persiste columnas visibles en localStorage
```

## El container (`index.tsx`)

[`SchedulingTasksPage/index.tsx`](../../src/pages/scheduling/SchedulingTasksPage/index.tsx) es el
manual de cómo debe verse un container:

- **Consume hooks de datos globales** (de `src/hooks/`): `useFilteredTasks`, `useProjects`,
  `useWorkflows`, `useTechnicians`, `useTaskTemplates`, `useTaskPriorities`, `useCreateTask`.
- **Consume hooks locales** (de `./hooks/`): `useTasksFilterUrl` (estado de filtros en la URL),
  `useVisibleColumns` (preferencia persistida).
- **Deriva datos**: separa el filtro `stageCategory` (que es **client-side**, el backend no lo
  conoce) del resto, y filtra en memoria:
  ```ts
  const { stageCategory, ...backendFilter } = filter;
  const tasks = stageCategory ? tasksRaw.filter(t => t.stageCategory === stageCategory) : tasksRaw;
  ```
- **Resuelve stages disponibles** cruzando el proyecto filtrado → su workflow → sus stages.
- **Maneja estado de UI local**: `showCreate` (modal abierto), vista `table`/`kanban`.
- **Compone presentacionales** pasándoles datos y callbacks; no contiene markup de tabla/kanban él
  mismo, delega a `TasksTableView` / `TasksKanbanView`.

## Hooks locales vs globales

| Vive en | Cuándo |
|---|---|
| `src/hooks/use<Dominio>.ts` | El hook trae/muta datos del backend y lo usa más de una page |
| `<Page>/hooks/use*.ts` | Lógica de UI específica de esa page (URL state, localStorage, derivación) |

`useTasksFilterUrl` y `useVisibleColumns` no tocan la red: son estado de UI local; por eso viven en
la carpeta de la page, no en `src/hooks/`.

## Nota de routing (gotcha real)

> ⚠ La page se registra en `App.tsx` con un **shim de re-export** (`SchedulingTasksPage.tsx` que
> apunta al `index`) y debe declararse **antes** que `/tasks/:id` para que la ruta index no quede
> sombreada por la paramétrica. Está comentado en `App.tsx`. Es frágil: ver overview.md → deuda de
> routing plano.

## Receta para una feature compleja nueva

1. Crear `src/pages/<area>/<Nombre>Page/` con `index.tsx` como container.
2. Datos del backend → hook en `src/hooks/` + función en `src/api/` + tipos en `src/types/`.
3. Estado de UI específico → hook local en `./hooks/`.
4. Vistas/markup → presentacionales en `./components/`, todo por props.
5. Registrar la ruta en `App.tsx` (cuidado con el orden si hay rutas paramétricas).
