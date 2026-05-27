# Convención de carpetas

```
src/
├── main.tsx              # Entry point: monta providers (QueryClient, Router, Auth) + tokens CSS
├── App.tsx               # Router central: todas las rutas, lazy, redirects
├── declarations.d.ts     # Tipos para imports no-TS (CSS modules, imágenes)
│
├── api/                  # TRANSPORTE. Un archivo por dominio: <dominio>.api.ts
│   ├── axios-client.ts   # Instancia axios única (baseURL /api, cookies, interceptor 401)
│   └── *.api.ts          # Funciones tipadas: getClients, createTask, ... (sin React)
│
├── hooks/                # DATOS. Un archivo por dominio: use<Dominio>.ts
│   └── use*.ts           # Wrappers de TanStack Query (useQuery/useMutation)
│
├── types/                # CONTRATOS. Un archivo por dominio: <dominio>.ts
│   └── *.ts              # Interfaces compartidas con el backend (Customer, ScheduledTask, ...)
│
├── context/              # Estado global de cliente (NO server state)
│   └── AuthContext.tsx   # Único context: usuario + login/logout
│
├── components/           # PRESENTACIÓN reutilizable (atomic design)
│   ├── atoms/            # Button, Input, StatusBadge, Spinner, KebabMenu, Breadcrumbs
│   ├── molecules/        # FilterBar, Pagination, Tabs, ConfirmModal
│   ├── organisms/        # DataTable, Sidebar, Navbar
│   ├── templates/        # AdminLayout, PlaceholderPage
│   ├── gestionReal/      # GestionRealSyncBadge (feature-específico, no encaja en atomic puro)
│   └── ProtectedRoute.tsx
│
├── pages/                # CONTAINERS. Una carpeta o archivo por pantalla
│   ├── <Feature>Page.tsx          # pages simples: un archivo
│   └── <Feature>Page/             # pages complejas: carpeta-módulo (ver tdr/0002)
│       ├── index.tsx              # el container
│       ├── components/            # componentes locales de esa page
│       ├── hooks/                 # hooks locales (ej. useTasksFilterUrl)
│       └── *.module.css
│
├── tokens/               # Design tokens globales
│   ├── variables.css     # custom properties en :root (colores, spacing, tipografía)
│   └── reset.css
│
├── test/                 # Setup de Vitest
├── __mocks__/            # Mocks de leaflet/react-leaflet para tests
└── __tests__/            # Tests, espejando la estructura por feature
```

## Reglas de ubicación

| Si vas a crear... | Va en... | Nombre |
|---|---|---|
| Una llamada HTTP nueva | `src/api/<dominio>.api.ts` | función exportada (`getX`, `createX`) |
| Un hook de datos | `src/hooks/use<Dominio>.ts` | `useXList`, `useXDetail`, `useCreateX` |
| Un tipo compartido | `src/types/<dominio>.ts` | interface/type exportado |
| Una pantalla nueva | `src/pages/...` + ruta en `App.tsx` | `<Nombre>Page` |
| Un componente usado en 1 sola page | dentro de la carpeta-módulo de esa page | local |
| Un componente reutilizable | `src/components/<nivel atómico>/` | PascalCase + `.module.css` |

## Naming observado

- **API**: `<dominio>.api.ts` (kebab + sufijo `.api`), funciones verbo+sustantivo.
- **Hooks**: `use<Dominio>.ts`, hooks `use<Verbo><Entidad>` o `use<Entidad>List/Detail`.
- **Tipos**: `<dominio>.ts` (lowercase), interfaces en PascalCase.
- **Componentes**: carpeta `PascalCase/` con `PascalCase.tsx` + `PascalCase.module.css`.

> ⚠ **Inconsistencia — nomenclatura mixta ES/EN.** Conviven nombres en español
> (`ClientesListPage`, `empresa.api.ts`, `TarifasPage`) y en inglés (`clients.api.ts`,
> `useClients`, `SchedulingTasksPage`). A veces el MISMO dominio mezcla idiomas: `clientes` en
> pages, `clients` en api/hooks. No hay regla; es producto de la evolución del proyecto. Para
> features nuevas, elegir un idioma por dominio y mantenerlo de punta a punta.

> ⚠ **Inconsistencia — imports relativos vs alias.** El alias `@/` está configurado en
> [`vite.config.ts`](../../vite.config.ts) y se usa en ~300 archivos, pero ~20 archivos todavía
> hacen `from '../../...'` (ej. dentro de `useClients.ts` y `ClientesListPage.tsx`). Preferir
> SIEMPRE `@/` para cross-layer.
