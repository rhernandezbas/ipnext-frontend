# ADR 0002 — TanStack Query como capa de datos (server state)

**Status:** Aceptado (vigente)

## Contexto

El front es casi todo **server state**: listas, detalles, dashboards que reflejan datos del backend
y de la API de Gestión Real. Manejar esto con `useState`/`useEffect` manuales implicaría reimplementar
cache, deduplicación, refetch, estados de loading/error y revalidación en cada page.

## Decisión

Adoptar **TanStack Query 5** como única capa de server state. Reglas:

- El `QueryClient` se crea una vez en [`src/main.tsx`](../../src/main.tsx) con defaults globales:
  `retry: 1`, `staleTime: 5 min`.
- **No se llama a `useQuery`/`useMutation` desde las pages directamente.** Cada dominio expone hooks
  en `src/hooks/use<Dominio>.ts` que envuelven Query y delegan el fetch a `src/api/<dominio>.api.ts`.
- Las **funciones de API son puras** (sin React): reciben params, devuelven `Promise<T>` tipada.
- Las **mutaciones invalidan** las queries afectadas en `onSuccess` para que la UI se refresque sola.

Ejemplo canónico — [`src/hooks/useClients.ts`](../../src/hooks/useClients.ts):

```ts
export function useClientList(query: ClientsQuery) {
  return useQuery({
    queryKey: ['clients', query],
    queryFn: () => getClients(query),
    staleTime: 30_000,
    refetchInterval: 30_000, // "live-mirror feel"
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axiosClient.patch(`/clients/${id}`, data).then(r => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', id] });
    },
  });
}
```

## Consecuencias

**Positivas**
- Estados de loading/error/cache gratis y consistentes en toda la app.
- `refetchInterval` habilita la sensación de "réplica viva" sin websockets (ver ADR 0005).
- Las pages quedan declarativas: piden datos por hook, no orquestan fetching.

**Negativas / deuda**
- ⚠ **Hooks que se saltan la capa API.** Varias mutaciones llaman a `axiosClient` inline en vez de
  pasar por una función de `src/api/` (ej. `useCreateCustomer`, `useUpdateCustomer`,
  `useClientDocuments` en `useClients.ts`). Rompe la separación hook↔api y dispersa rutas HTTP por
  todo el código. Lo correcto es que TODA URL viva en `src/api/`.
- ⚠ **Query keys sin convención central.** Son strings literales (`['clients']`, `['client', id]`,
  `['scheduling-tasks', filter]`) repartidos por cada hook. No hay un factory de keys, así que un
  typo en una key de invalidación pasa silencioso. Ver tdr/0001 para la convención de facto.
- ⚠ Tipos auxiliares (`ClientDocument`, `OnlineSession`) viven dentro de hooks en vez de en
  `src/types/`.
