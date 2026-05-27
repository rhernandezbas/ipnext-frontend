# TDR 0001 — Convenciones de data fetching

Diseño técnico de cómo se traen, cachean e invalidan datos. Complementa el ADR 0002.

## Defaults globales

Definidos en el `QueryClient` de [`src/main.tsx`](../../src/main.tsx):

```ts
new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5 } }, // 5 min
});
```

Cada hook **sobreescribe** lo que necesita.

## Query keys (convención de facto)

No hay factory central; las keys son arrays literales. El patrón observado:

| Tipo | Forma | Ejemplo |
|------|-------|---------|
| Lista | `['<dominio>']` o `['<dominio>', params]` | `['clients', query]`, `['scheduling-tasks', filter]` |
| Detalle | `['<entidad-singular>', id]` | `['client', id]`, `['scheduling-task', id]` |
| Sub-recurso | `['<entidad>-<sub>', id]` | `['client-services', id]`, `['client-invoices', id]` |
| Stats / agregados | `['<dominio>-stats']` | `['client-stats']` |
| Estado especial | key propia | `['gestion-real-sync-status']` |

Reglas prácticas:
- **Incluir los params en la key** cuando la query depende de ellos (`['clients', query]`): cada
  combinación de filtros cachea por separado.
- **Invalidar por prefijo**: `invalidateQueries({ queryKey: ['clients'] })` invalida todas las
  variantes de filtro de clientes.

> ⚠ Riesgo: las keys son strings sueltos. Un typo entre la key de la query y la de invalidación no
> da error de compilación, solo cache que no se refresca. Un `queryKeys` factory tipado lo
> resolvería.

## staleTime y refetchInterval (valores observados)

| Naturaleza del dato | staleTime | refetchInterval | Ejemplo |
|---|---|---|---|
| Listas "réplica viva" | 30 s | 30 s | `useClientList`, `useFilteredTasks` |
| Detalle / sub-recursos | 60 s | — | `useClientDetail`, `useClientServices` |
| Logs / comments | 30 s | — | `useClientLogs`, `useClientComments` |
| Stats | 60 s | — | `useClientStats` |
| Estado del mirror | 15 s | 30 s | `useGestionRealSyncStatus` |
| Sesiones online (tiempo real) | default | 30 s | `useOnlineSessions` |

El `refetchInterval` es el mecanismo de "vivacidad" (ADR 0005). No hay websockets.

## `enabled` para queries dependientes

Las queries que dependen de un id o de una tab activa usan `enabled`:

```ts
useClientServices(id, enabled)  // enabled = tab "Servicios" abierta
useClientDetail(id)             // enabled: !!id
```

Esto evita fetchear sub-recursos hasta que el usuario los necesita.

## Mutaciones e invalidación

Patrón uniforme: `useMutation` con `onSuccess` que invalida lo afectado.

```ts
onSuccess: (_, { id }) => {
  qc.invalidateQueries({ queryKey: ['clients'] });   // refresca la lista
  qc.invalidateQueries({ queryKey: ['client', id] }); // y el detalle
}
```

Algunas mutaciones del detalle de tarea usan **optimistic updates** con
`onMutate`/`cancelQueries`/rollback (ver `useScheduling.ts`, mutación de movimiento de etapa).

## Manejo de errores

- **401 global**: el interceptor de [`axios-client.ts`](../../src/api/axios-client.ts) dispara
  `auth:unauthorized` → logout + redirect. Ninguna query maneja 401 por su cuenta.
- **Errores tolerables**: queries de features opcionales usan `retry: false` y degradan a `null` en
  la UI (ej. el badge de Gestión Real).
- **Loading/error por componente**: se consumen `isLoading`/`isError` del hook; muchas listas pasan
  `loading` al `DataTable`, que muestra su propio estado vacío.

## Reglas para features nuevas

1. La URL HTTP vive en `src/api/<dominio>.api.ts`, **nunca** inline en el hook.
2. El hook envuelve Query y elige `queryKey` + política de cache.
3. La page consume el hook; no llama a `useQuery` directo.
4. Las mutaciones invalidan por prefijo de key.
