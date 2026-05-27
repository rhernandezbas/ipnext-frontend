# ADR 0005 — UI de "réplica viva" del mirror de Gestión Real

**Status:** Aceptado (vigente) — pieza identitaria del producto

## Contexto

Prominense no es la fuente de verdad de los clientes: los datos canónicos viven en la **API de
Gestión Real** (Real Software). El backend mantiene un **mirror read-only** que sincroniza
periódicamente esos datos a su propia base. El usuario necesita confiar en que lo que ve en pantalla
es un reflejo *vivo* y reciente del sistema real, no una foto vieja.

## Decisión

Comunicar el estado del mirror **directamente en la UI**, con dos mecanismos:

1. **Polling como "live feel".** Los hooks de listas que reflejan datos espejados llevan
   `refetchInterval` (30 s). Ejemplos:
   - `useClientList` — comentario explícito: *"Live-mirror feel: poll the local DB so GR-synced
     changes surface on their own."* ([`useClients.ts`](../../src/hooks/useClients.ts)).
   - `useFilteredTasks` — `refetchInterval: 30_000` ([`useScheduling.ts`](../../src/hooks/useScheduling.ts)).
   No hay websockets: la "vivacidad" se simula con repolling de TanStack Query.

2. **Badge de estado del mirror.** [`GestionRealSyncBadge`](../../src/components/gestionReal/GestionRealSyncBadge.tsx),
   alimentado por [`useGestionRealSyncStatus`](../../src/hooks/useGestionRealSync.ts), que pollea
   `GET /api/gestion-real/sync/status` cada 30 s. El badge tiene tres estados:
   - **Réplica viva** (verde): muestra `N clientes · M contratos · hace X min` (último sync).
   - **Sin sincronizar** (idle): el mirror nunca corrió.
   - **Error de sincronización** (rojo): la última corrida falló (`lastResult` empieza con `error`).
   Se consume en [`ClientesListPage`](../../src/pages/clientes/ClientesListPage.tsx).

Decisiones de robustez del hook de status:
- `retry: false` — *"The endpoint 404s/401s harmlessly when the feature is off — don't hammer
  retries."*
- Si hay error o no hay status, el badge **renderiza `null`** (degrada en silencio, no rompe la page).

## Consecuencias

**Positivas**
- El usuario percibe el panel como un espejo vivo del sistema real, con feedback honesto del estado
  de sincronización (incluyendo fallos).
- Implementación barata: ni infraestructura de tiempo real ni sockets.
- Tolerante a feature-flag off: si el mirror está apagado, la UI simplemente no muestra el badge.

**Negativas / deuda**
- ⚠ **Polling fijo de 30 s, no configurable.** Con muchas tabs/listas abiertas, multiplica requests
  al backend. No hay backoff ni pausa al perder foco de la pestaña.
- ⚠ La UI es **read-only respecto al mirror**: refleja datos espejados pero las mutaciones
  (crear/editar cliente) van contra el backend propio, no contra Gestión Real. La doble fuente de
  verdad (mirror + escrituras locales) no está documentada a nivel de producto y puede confundir.
- ⚠ El `clientCount`/`contractCount` del badge depende de que el backend los popule; si no, cae a
  `totalClients` del query de lista o a `itemsSynced`. Tres fuentes para un mismo número.
