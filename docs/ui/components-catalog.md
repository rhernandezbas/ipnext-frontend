# Catálogo de componentes

Componentes reutilizables en [`src/components/`](../../src/components/), organizados por nivel
atómico (ver ADR 0001). Esto NO incluye los componentes locales de cada page-módulo (ver tdr/0002).

## Atoms — [`src/components/atoms/`](../../src/components/atoms/)

| Componente | Props clave | Cuándo usarlo |
|---|---|---|
| **Button** | `variant: primary\|secondary\|danger\|ghost`, `size: sm\|md\|lg`, `loading` | Toda acción. `loading` muestra `Spinner` y deshabilita. Extiende `ButtonHTMLAttributes`. |
| **Input** | `error?: string` | Campos de texto. Renderiza el mensaje de error debajo. Extiende `InputHTMLAttributes`. |
| **StatusBadge** | `status: active\|late\|blocked\|inactive` | Estado de cliente/tarea. Mapea a etiqueta ES y color de token. |
| **Spinner** | `size`, `fullPage` | Loading. `fullPage` para Suspense/route fallback. |
| **KebabMenu** | `items: {label, onClick}[]` | Menú de acciones por fila. Se renderiza en **portal** (`document.body`) para no recortarse en tablas. |
| **Breadcrumbs** | crumbs | Migas de pan; alimentado por `AdminLayout` según la ruta. |

## Molecules — [`src/components/molecules/`](../../src/components/molecules/)

| Componente | Props clave | Cuándo usarlo |
|---|---|---|
| **FilterBar** | `onSearch`, `filters: FilterDef[]`, `onFilterChange`, `searchPlaceholder` | Barra de búsqueda + selects de filtro. El search es **debounced 300ms** internamente. |
| **Pagination** | `currentPage`, `totalPages`, `onPageChange` | Paginación numérica con ventana de ±2 y elipsis. Se oculta sola si `totalPages <= 1`. |
| **Tabs** | `tabs: {id,label,content}[]`, `activeTab`, `onTabChange` | Pestañas accesibles (`role=tablist/tab/tabpanel`). Renderiza todos los paneles y togglea con `display`. |
| **ConfirmModal** | `open`, `title`, `message`, `tone: default\|danger`, `busy`, `onConfirm`, `onCancel` | Confirmación destructiva. Portal a body, Esc/click-backdrop cancela, focus-trap al confirmar, scroll-lock. |

## Organisms — [`src/components/organisms/`](../../src/components/organisms/)

| Componente | Props clave | Cuándo usarlo |
|---|---|---|
| **DataTable`<T>`** | `columns: ColumnDef<T>[]`, `data`, `loading`, `actions`, `selectable`, `expandable`/`renderExpanded`, `totals`, `emptyMessage` | **El caballo de batalla.** Tabla genérica tipada con sort por columna, selección múltiple, filas expandibles, fila de totales y acciones por fila (vía `KebabMenu`). Requiere `T extends { id }`. |
| **Sidebar** | navegación por grupos | Navegación lateral; grupos definidos como data (Clientes, CRM, Tickets, Finanzas, Red, Scheduling, …). |
| **Navbar** | — | Barra superior. |

## Templates — [`src/components/templates/`](../../src/components/templates/)

| Componente | Qué hace |
|---|---|
| **AdminLayout** | Shell de toda la sección `/admin/*`: Sidebar + Navbar + Breadcrumbs (resueltos por patrón de ruta) + `<Outlet />`. |
| **PlaceholderPage** | Página stub para features aún no implementadas. |

## Feature-específicos

| Componente | Notas |
|---|---|
| **GestionRealSyncBadge** ([`components/gestionReal/`](../../src/components/gestionReal/)) | Badge del estado del mirror. Puro (props `status`, `isError`, `totalClients`). Ver ADR 0005. Rompe atomic puro a propósito. |
| **ProtectedRoute** ([`components/ProtectedRoute.tsx`](../../src/components/ProtectedRoute.tsx)) | Guard de rutas autenticadas. |

## Deuda

> ⚠ Solo hay 2 templates. Mucha page reimplementa su header/toolbar inline (con SVGs locales y
> CSS propio) en vez de un template/organism de "page header" compartido. Es la mayor oportunidad
> de reuso pendiente.
