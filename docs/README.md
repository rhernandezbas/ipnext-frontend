# Prominense — Documentación de Arquitectura (Frontend)

**Prominense** es el panel de administración de un ISP: una réplica/competidor de Splynx, hoy
alimentado por la **API de Gestión Real** (Real Software) a través del backend propio
(`ipnext-backend`, expuesto bajo `/api`).

Este directorio documenta la arquitectura **real** del frontend (React 18 + Vite + TypeScript +
TanStack Query 5 + React Router 6, tests con Vitest). No describe un ideal: describe lo que hay,
y marca honestamente la deuda técnica donde existe.

## Cómo navegar la doc

| Carpeta | Qué encontrás |
|---------|---------------|
| [`architecture/`](./architecture/) | Visión general de capas y convención de carpetas |
| [`adr/`](./adr/) | Architecture Decision Records — decisiones estructurales y su porqué |
| [`tdr/`](./tdr/) | Technical Design Records — diseños técnicos concretos (data fetching, anatomía de features) |
| [`ui/`](./ui/) | Sistema de diseño, catálogo de componentes y patrones de UI |
| [`business/`](./business/) | Glosario de dominio y catálogo de features de negocio |

### Punto de entrada recomendado

1. [`architecture/overview.md`](./architecture/overview.md) — el mapa mental del front.
2. [`architecture/folder-structure.md`](./architecture/folder-structure.md) — dónde vive cada cosa.
3. [`adr/0002-tanstack-query-data-layer.md`](./adr/0002-tanstack-query-data-layer.md) y
   [`tdr/0001-data-fetching-conventions.md`](./tdr/0001-data-fetching-conventions.md) — cómo se
   traen los datos (es el corazón del front).
4. [`adr/0005-gestion-real-live-mirror-ui.md`](./adr/0005-gestion-real-live-mirror-ui.md) — la
   "réplica viva" de Gestión Real, una pieza identitaria del producto.

## Stack en una línea

- **UI**: React 18, atomic design, CSS Modules con tokens en `:root`.
- **Data**: TanStack Query 5 sobre un cliente axios único (`/api`, cookies).
- **Routing**: React Router 6, lazy routes bajo un layout protegido.
- **Auth**: cookie de sesión + `AuthContext`, con redirect global vía evento `auth:unauthorized`.
- **Tests**: Vitest + Testing Library (123 archivos de test al momento de escribir esto).

## Honestidad sobre el estado

La app es **grande** (50+ módulos de API, 50+ hooks, 100+ rutas). La arquitectura base es sólida
y consistente, pero hay deuda acumulada por la velocidad de iteración. Cada doc marca sus puntos
con un bloque **⚠ Deuda técnica** cuando corresponde. No los escondemos: son mapa de ruta.
