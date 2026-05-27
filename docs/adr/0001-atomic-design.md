# ADR 0001 — Atomic Design para la capa de presentación

**Status:** Aceptado (vigente)

## Contexto

Prominense tiene una superficie de UI enorme (100+ rutas, tablas, formularios, modales, mapas,
dashboards). Sin una taxonomía de componentes, la reutilización se degrada y cada page reinventa
botones, inputs y badges.

## Decisión

Organizar `src/components/` siguiendo **atomic design** en cuatro niveles, más una carpeta
feature-específica:

- **atoms/** — primitivas sin lógica de negocio: `Button`, `Input`, `StatusBadge`, `Spinner`,
  `KebabMenu`, `Breadcrumbs`.
- **molecules/** — combinaciones simples: `FilterBar`, `Pagination`, `Tabs`, `ConfirmModal`.
- **organisms/** — bloques compuestos con estado propio: `DataTable`, `Sidebar`, `Navbar`.
- **templates/** — layouts de página: `AdminLayout`, `PlaceholderPage`.
- Las **pages** (`src/pages/`) actúan como containers (ver ADR 0003).

Cada componente lleva su propio CSS Module colocado al lado (`Button.tsx` + `Button.module.css`).

## Consecuencias

**Positivas**
- Reutilización real: `DataTable`, `FilterBar`, `ConfirmModal` se usan en decenas de pages.
- Dependencias dirigidas hacia abajo: organisms usan atoms (`DataTable` importa `KebabMenu`),
  nunca al revés.
- Componentes genéricos y tipados (`DataTable<T>` con `ColumnDef<T>`).

**Negativas / deuda**
- ⚠ El nivel **template** está infrautilizado: solo `AdminLayout` y `PlaceholderPage`. Muchas pages
  arman su propio header/layout inline en lugar de un template compartido (ej.
  `SchedulingTasksPage` define su header con SVGs locales y comenta que es "mirror" de otra page —
  copia visual en vez de componente compartido).
- ⚠ `components/gestionReal/` rompe la pureza atómica: es un componente acoplado a una feature.
  Es una excepción pragmática, no un error, pero conviene no multiplicar este patrón.
- La línea entre molecule y organism es difusa en la práctica; no hay un criterio escrito.
