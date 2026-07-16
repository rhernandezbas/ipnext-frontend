# Spec — bulk-detail-polling (new capability)

RFC-2119. Cada scenario cubierto por al menos un test Vitest + Testing Library (sdd-verify).
Capability nueva — se documenta completa (no delta).

## Capability: política de polling del detalle

### Requirement: POLL-1 — `campaignPollInterval` es una función pura testeable
`campaignPollInterval(status, visible)` MUST devolver el intervalo de refetch (ms) o `false`, sin
depender de React ni de `useQuery`, para poder testear todas las ramas sin montar el hook.

#### Scenario: pestaña no visible
- **GIVEN** `visible = false`, cualquier `status`
- **WHEN** se evalúa `campaignPollInterval(status, false)`
- **THEN** devuelve `false`

#### Scenario: running visible
- **GIVEN** `status = 'running'`, `visible = true`
- **WHEN** se evalúa
- **THEN** devuelve `5_000`

#### Scenario: pending visible
- **GIVEN** `status = 'pending'`, `visible = true`
- **WHEN** se evalúa
- **THEN** devuelve `30_000`

#### Scenario: paused visible
- **GIVEN** `status = 'paused'`, `visible = true`
- **WHEN** se evalúa
- **THEN** devuelve `30_000`

#### Scenario: terminal (done/failed) visible
- **GIVEN** `status = 'done'` o `status = 'failed'`, `visible = true`
- **WHEN** se evalúa
- **THEN** devuelve `false`

#### Scenario: sin data todavía
- **GIVEN** `status = undefined`, `visible = true`
- **WHEN** se evalúa
- **THEN** devuelve `false`

### Requirement: POLL-2 — `useCampaign` usa `campaignPollInterval`
`useCampaign(id, query)` MUST derivar su `refetchInterval` de `campaignPollInterval(status, visible)`
leyendo `status` de `query.state.data?.campaign.status` y `visible` de `useDocumentVisible()`.

#### Scenario: pending refetchea a los 30s, no a los 5s
- **GIVEN** una campaña `pending` con la pestaña visible
- **WHEN** pasan 5s
- **THEN** NO hubo un 2do fetch
- **WHEN** pasan 30s en total
- **THEN** hubo un 2do fetch

#### Scenario: paused refetchea a los 30s
- **GIVEN** una campaña `paused` con la pestaña visible
- **WHEN** pasan 30s
- **THEN** hubo un 2do fetch

#### Scenario: pending con pestaña oculta no refetchea
- **GIVEN** una campaña `pending` con la pestaña oculta
- **WHEN** pasan 30s
- **THEN** NO hubo un 2do fetch

## Capability: polling del historial

### Requirement: POLL-3 — `useCampaigns` pollea cada 30s gateado por visibilidad
`useCampaigns(query, enabled, poll)` MUST pollear cada 30s cuando `poll:true` y la pestaña está
visible, y NO pollear cuando está oculta — mismo criterio que el detalle (`useDocumentVisible`).

#### Scenario: historial con pestaña visible
- **GIVEN** el historial montado (`poll:true`), pestaña visible
- **WHEN** pasan 30s
- **THEN** hubo un 2do fetch de `listCampaigns`

#### Scenario: historial con pestaña oculta
- **GIVEN** el historial montado (`poll:true`), pestaña oculta
- **WHEN** pasan 30s
- **THEN** NO hubo un 2do fetch

### Requirement: POLL-4 — el polling de `useCampaigns` es OPT-IN (Fix Wave HIGH-1)
`useCampaigns(query, enabled, poll)` MUST tratar `poll` como el 3er parámetro, default `false`.
Sin `poll:true` explícito, `refetchInterval` MUST ser `false` sin importar la visibilidad de la
pestaña. `CampaignsTable` (tab "Historial") es el ÚNICO caller que pasa `poll:true` — cualquier
otro caller (ej. `WhatsappInboxPage`, que usa `useCampaigns` para poblar el dropdown de filtro de
campaña del inbox) NO hereda polling sin pedirlo.

#### Scenario: caller sin `poll` (default) no pollea
- **GIVEN** un caller de `useCampaigns(query)` sin 3er argumento, pestaña visible
- **WHEN** pasan 30s
- **THEN** NO hubo un 2do fetch de `listCampaigns`

#### Scenario: el inbox no hereda el poll del historial
- **GIVEN** `WhatsappInboxPage` llamando `useCampaigns({limit:50}, canBulk)` (sin 3er argumento)
- **WHEN** el agente deja el inbox abierto minutos
- **THEN** `listCampaigns` NO se refetchea por polling (solo el fetch inicial + invalidaciones
  explícitas)

## Capability: tab-gating del poll (Fix Wave MEDIUM-2)

### Requirement: POLL-5 — el poll se apaga cuando el tab que lo contiene no está activo
Con `Tabs mountMode="all"` (`BulkMessagingPage`), AMBOS tabs quedan montados simultáneamente.
`CampaignsTable` y `CampaignDetail` (y sus hijos `CampaignHeader`/`RecipientsTable`) MUST aceptar
un prop `active` (default `true`) que, combinado con `useDocumentVisible`, gatea el
`refetchInterval` de `useCampaigns`/`useCampaign` — el fetch inicial al montar NO se ve afectado,
solo el polling recurrente.

#### Scenario: tab "Historial" no activo detiene el poll del detalle montado detrás
- **GIVEN** `?campaign=<id>` en la URL (detalle en `pending`/`running`), el operador cambia al tab
  "Nueva campaña"
- **WHEN** pasan 30s (o 5s si estaba `running`)
- **THEN** `CampaignDetail`, montado pero inactivo, NO generó un fetch nuevo

#### Scenario: tab "Historial" activo mantiene el poll
- **GIVEN** el tab "Historial" es el activo
- **WHEN** pasa el intervalo correspondiente al status
- **THEN** hay un fetch nuevo (comportamiento sin cambios respecto a POLL-2/POLL-3)

## Capability: variante pesada del detalle pollea distinto (Fix Wave MEDIUM-3)

### Requirement: POLL-6 — `includeRecipients:true` solo pollea en `running`
`campaignPollInterval(status, visible, { heavy })` MUST devolver `false` para `pending`/`paused`
cuando `heavy:true` (recipients inmutables mientras la campaña no arrancó/está pausada) — solo
pollea en `running` (5s), igual que la variante liviana. `useCampaign` MUST derivar `heavy` de
`!!query.includeRecipients` (RecipientsTable pasa `includeRecipients:true`; CampaignHeader no).

#### Scenario: heavy + pending → no pollea
- **GIVEN** `campaignPollInterval('pending', true, { heavy: true })`
- **THEN** devuelve `false`

#### Scenario: heavy + paused → no pollea
- **GIVEN** `campaignPollInterval('paused', true, { heavy: true })`
- **THEN** devuelve `false`

#### Scenario: heavy + running → pollea a 5s (igual que liviana)
- **GIVEN** `campaignPollInterval('running', true, { heavy: true })`
- **THEN** devuelve `5_000`

#### Scenario: `RecipientsTable` no refetchea en pending/paused
- **GIVEN** `RecipientsTable` montado con una campaña `pending`/`paused`, pestaña visible, tab activo
- **WHEN** pasan 30s
- **THEN** NO hubo un 2do fetch con `includeRecipients:true` (la key liviana del header sigue
  polleando a 30s y es la que detecta la transición a `running`)

## Capability: errores del send visibles y persistentes

### Requirement: ERR-1 — el 409 muestra un mensaje claro de lock del servidor
`SendCampaignButton` MUST mostrar, ante `conflict` (409 `CAMPAIGN_SEND_IN_PROGRESS`), un mensaje
con `role="alert"` que hable de un envío en curso EN EL SERVIDOR (no "tu campaña"), y que NO se
auto-oculte (a diferencia del toast de éxito, 4s).

#### Scenario: mensaje del 409
- **GIVEN** el send falla con 409 `CAMPAIGN_SEND_IN_PROGRESS`
- **WHEN** se renderiza el resultado
- **THEN** aparece un `role="alert"` con un mensaje de envío en curso en el servidor y una
  sugerencia de reintentar, sin decir "tu campaña"

#### Scenario: persistencia del mensaje del 409
- **GIVEN** el mensaje del 409 visible
- **WHEN** pasan más de 4s (ventana del toast de éxito)
- **THEN** el `role="alert"` del 409 SIGUE visible

### Requirement: ERR-2 — cualquier otro error del send es visible
`SendCampaignButton` MUST mostrar cualquier error del send que NO sea el 409 (red, 500, timeout)
con `role="alert"`, distinto del mensaje del 409.

#### Scenario: error genérico
- **GIVEN** el send falla con un error de red/500
- **WHEN** se renderiza el resultado
- **THEN** aparece un `role="alert"` con un mensaje de fallo de envío, sin confundirse con el
  wording del 409

## Capability: invalidación inmediata post-success

### Requirement: INV-1 — el detalle se invalida sin esperar el próximo tick del polling
`useSendCampaign.onSuccess` MUST invalidar `['messagingBulk','campaign',campaignId]` (como
PREFIJO, cubriendo cualquier variante de query incluyendo `includeRecipients`) y
`['messagingBulk','campaigns']` — el refetch ocurre inmediatamente vía `invalidateQueries`, sin
esperar el intervalo de `refetchInterval`.

#### Scenario: invalidación cubre la key con includeRecipients
- **GIVEN** un send exitoso de `camp-1`
- **WHEN** se evalúa la invalidación
- **THEN** cualquier query cacheada bajo `['messagingBulk','campaign','camp-1', *]` (con o sin
  `includeRecipients`) queda invalidada

## Capability: crear ≠ enviar es explícito (scope adicional, root cause del incidente de prod)

Root cause confirmado con el usuario (2026-07-16): el "bug" del POST `/send` que nunca salía era
UX, no código. El operador creaba la campaña (el modal de creación ya muestra un resumen de
impacto que se siente como confirmación de envío), aterrizaba en el detalle `pending` y creía que
ya estaba enviada — nunca clickeaba "Enviar campaña". Las hipótesis de bundle stale / bloqueo
client-side quedaron descartadas con 3 repros Playwright verdes contra prod.

### Requirement: UX-1 — el detalle en `pending` muestra un aviso explícito de "todavía no se envió"
`CampaignDetail` MUST mostrar, cuando `campaign.status === 'pending'`, un callout con
`role="status"`, un ícono SVG `aria-hidden="true"` (nunca solo color) y un mensaje que deje
explícito que la campaña todavía NO se envió y cuál es la acción a tomar ("Enviar campaña"). El
callout MUST desaparecer en cualquier otro status.

#### Scenario: pending muestra el aviso
- **GIVEN** una campaña con `status: 'pending'`
- **WHEN** se renderiza `CampaignDetail`
- **THEN** hay un `role="status"` con un ícono `svg[aria-hidden="true"]` y un texto que dice que
  todavía no se envió

#### Scenario: cualquier otro status oculta el aviso
- **GIVEN** una campaña con `status` en `running` | `paused` | `done` | `failed`
- **WHEN** se renderiza `CampaignDetail`
- **THEN** el aviso de "todavía no se envió" NO está presente

### Requirement: UX-2 — el modal de creación nombra el próximo paso explícitamente
`CreateCampaignConfirmModal` MUST incluir, al final del resumen (`dl.summary`), una línea que
diga que la campaña se crea en estado Pendiente y que el envío es una acción POSTERIOR desde el
detalle — sin modificar la estructura de accesibilidad existente (foco/focus-trap/roles).

#### Scenario: el resumen nombra el próximo paso
- **GIVEN** el modal de creación abierto
- **WHEN** se renderiza
- **THEN** el resumen incluye el estado "Pendiente" y una referencia explícita a que el envío se
  dispara después, desde el detalle
