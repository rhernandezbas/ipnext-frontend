# Arquitectura general del frontend

Prominense es una SPA React que consume el backend propio bajo `/api`. La arquitectura se organiza
en **capas horizontales** (presentación → datos → transporte) y, dentro de la presentación, en
**atomic design**.

## Diagrama de capas

```
┌──────────────────────────────────────────────────────────────────────┐
│  ROUTING                                                               │
│  src/App.tsx — React Router 6, rutas lazy bajo ProtectedRoute+Layout   │
└──────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────────────────────────────────────────┐
│  PRESENTACIÓN (atomic design)                                          │
│                                                                        │
│   pages/        →  containers: orquestan hooks + componen UI           │
│   components/                                                          │
│     templates/  →  layouts de página (AdminLayout, PlaceholderPage)    │
│     organisms/  →  bloques compuestos (DataTable, Sidebar, Navbar)     │
│     molecules/  →  combinaciones (FilterBar, Pagination, Tabs, Modal)  │
│     atoms/      →  primitivas (Button, Input, StatusBadge, Spinner)    │
└──────────────────────────────────────────────────────────────────────┘
                                  │  (hooks como puente)
┌──────────────────────────────────────────────────────────────────────┐
│  DATOS (server state)                                                  │
│  src/hooks/use*.ts — wrappers de TanStack Query                        │
│  queryKey · staleTime · refetchInterval · invalidación en mutations    │
└──────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────────────────────────────────────────┐
│  TRANSPORTE                                                            │
│  src/api/*.api.ts — funciones tipadas que llaman a axiosClient         │
│  src/api/axios-client.ts — instancia única (baseURL /api, cookies)     │
└──────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────────────────────────────────────────┐
│  TIPOS compartidos:  src/types/*.ts  (contratos con el backend)        │
└──────────────────────────────────────────────────────────────────────┘
```

## Flujo de datos (lectura)

1. Una **page** (container) llama a un hook, ej. `useClientList(query)`
   ([`src/hooks/useClients.ts`](../../src/hooks/useClients.ts)).
2. El hook envuelve `useQuery` con su `queryKey` y su política de cache, y delega el fetch a una
   función de `src/api/`, ej. `getClients` ([`src/api/clients.api.ts`](../../src/api/clients.api.ts)).
3. La función de API usa `axiosClient` ([`src/api/axios-client.ts`](../../src/api/axios-client.ts)),
   que apunta a `/api` con `withCredentials: true`.
4. TanStack Query cachea por `queryKey` y, si el hook tiene `refetchInterval`, repolla solo.
5. La page pasa los datos a componentes **presentacionales** (atoms/molecules/organisms).

## Flujo de datos (escritura)

1. La page llama a un hook de mutación, ej. `useUpdateCustomer()`.
2. El hook envuelve `useMutation` y, en `onSuccess`, **invalida** las queries afectadas
   (`qc.invalidateQueries({ queryKey: ['clients'] })`). Ver patrón en
   [`useClients.ts`](../../src/hooks/useClients.ts).
3. TanStack Query refetchea automáticamente lo invalidado → la UI se actualiza sin recarga manual.

## Autenticación y sesión

- La sesión es por **cookie** (no hay token en `localStorage`). `axiosClient` manda
  `withCredentials: true`.
- [`AuthContext`](../../src/context/AuthContext.tsx) hace `getMe()` al montar para hidratar el
  usuario, expone `login`/`logout`.
- El interceptor de respuesta de axios, ante un **401**, dispara un `CustomEvent('auth:unauthorized')`
  global. `AuthContext` lo escucha y redirige a `/login`. Esto desacopla el transporte del routing:
  cualquier 401 en cualquier query termina en logout limpio.
- [`ProtectedRoute`](../../src/components/ProtectedRoute.tsx) bloquea el árbol `/admin/*` hasta
  resolver `isLoading`, y redirige a `/login?redirect=...` si no hay usuario.

## Routing

- Todas las rutas viven en [`src/App.tsx`](../../src/App.tsx) (router centralizado, no anidado por
  feature).
- Casi todas las pages se cargan con `React.lazy` + `<Suspense fallback={<Spinner fullPage />}>`
  → code-splitting por ruta.
- Estructura: `/` → redirect a `/admin/dashboard`; `/login` público; todo `/admin/*` envuelto por
  `ProtectedRoute` → `AdminLayout`.
- Hay **redirects de compatibilidad** abundantes (URLs viejas → canónicas), ej.
  `/admin/scheduling` → `/admin/scheduling/tasks`.

> ⚠ **Deuda técnica — orden de rutas frágil.** Como el router es plano, el orden importa: las rutas
> index (`/admin/scheduling/tasks`) DEBEN declararse antes que las paramétricas (`/tasks/:id`), y el
> catch-all `/admin/customers/:id` debe ir al final o sombrea a `/customers/map`. Esto está
> documentado con comentarios en `App.tsx` pero es una bomba de tiempo: un reorden inocente rompe
> navegación. Migrar a rutas anidadas por feature lo eliminaría.

## Capas externas / mapas

- **Leaflet** + **react-leaflet** para mapas (clientes, CRM, red, scheduling). En tests se mockean
  vía alias de Vitest (ver [`vite.config.ts`](../../vite.config.ts)).
- **Recharts** para gráficos de dashboards.
- **@dnd-kit** para drag & drop (Kanban de tareas, selector de columnas).
- **Tiptap** para edición de texto enriquecido.
