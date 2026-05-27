# Patrones de UI

Recetas recurrentes en Prominense. Reusar estos patrones antes de inventar uno nuevo.

## Tabla de datos (DataTable)

`DataTable<T>` ([`organisms/DataTable`](../../src/components/organisms/DataTable/DataTable.tsx)) es
el patrón estándar para listas. Recibe `columns: ColumnDef<T>[]` y `data: T[]`.

```tsx
<DataTable
  columns={[
    { key: 'name', label: 'Nombre', sortable: true },
    { key: 'status', label: 'Estado', render: (row) => <StatusBadge status={row.status} /> },
  ]}
  data={clients}
  loading={isLoading}
  actions={[{ label: 'Editar', onClick: (row) => navigate(`/.../${row.id}/edit`) }]}
  emptyMessage="No hay clientes."
/>
```

Capacidades: sort por columna (click en header), `render` custom por celda, `actions` (van a un
`KebabMenu` por fila), `selectable` + `onSelectionChange` (selección múltiple para acciones bulk),
`expandable` + `renderExpanded` (fila detalle), `totals` (fila de sumatorias). `T` debe tener `id`.

Para vistas alternativas (kanban con drag&drop) la feature define sus propios componentes locales
(ver `TasksKanbanView` en tdr/0002), no se fuerza dentro de DataTable.

## Filtros (FilterBar)

`FilterBar` ([`molecules/FilterBar`](../../src/components/molecules/FilterBar/FilterBar.tsx)):
búsqueda con **debounce de 300ms** + selects declarativos.

```tsx
<FilterBar
  searchPlaceholder="Buscar cliente..."
  onSearch={(q) => setQuery((p) => ({ ...p, search: q }))}
  filters={[{ key: 'status', label: 'Estado', options: STATUS_OPTIONS }]}
  onFilterChange={(key, value) => setQuery((p) => ({ ...p, [key]: value }))}
/>
```

Para features con filtros complejos sincronizados con la URL, mirar `useTasksFilterUrl`
(hook local de page) en lugar de FilterBar — patrón de "filtros como query string".

## Modales

Dos caminos, ambos vía **portal a `document.body`**:

- **Confirmación** (sí/no, destructivo): `ConfirmModal` con `tone="danger"` para borrados. Maneja
  Esc, click-backdrop, focus-trap y scroll-lock por vos.
- **Formularios / contenido rico**: modal propio dentro de la feature (ej. `CreateTaskModal` en
  scheduling). No hay un `Modal` genérico de contenido en `components/`; cada feature arma el suyo.

> ⚠ Falta un `Modal` base genérico. `ConfirmModal` resuelve confirmaciones, pero los modales de
> formulario se reimplementan por feature (portal + backdrop + scroll-lock duplicados).

## Badges

- **Estado de entidad**: `StatusBadge` con `status` tipado (`active`/`late`/`blocked`/`inactive`).
- **Estado de sistema/mirror**: `GestionRealSyncBadge` (live/idle/error) — patrón de badge con
  punto de color + texto + `title` con detalle (ver ADR 0005).

## Formularios

- Inputs vía atom `Input` (muestra `error` debajo).
- `react-hook-form` está en dependencias para formularios complejos.
- Botón de submit con `Button loading={mutation.isPending}` para feedback de envío.

## Paginación

`Pagination` (numérica con ventana ±2 y elipsis). Para listas largas server-paginadas, el container
mantiene `page` en estado y lo pasa a la query (`['clients', { page, ... }]`).

## Tabs

`Tabs` accesible para detalles con secciones (ej. detalle de cliente: Servicios / Facturas / Logs /
Comentarios). Combinar con `enabled` en los hooks para fetchear el sub-recurso solo al abrir la tab.

## Estados vacíos y de carga

- **Loading de tabla**: pasar `loading` a `DataTable` (muestra su propio estado).
- **Loading de ruta**: `<Spinner fullPage />` como fallback de `Suspense` y en `ProtectedRoute`.
- **Vacío**: `emptyMessage` en `DataTable`.
- **Degradado silencioso**: features opcionales (mirror) renderizan `null` ante error en vez de
  romper la page.
