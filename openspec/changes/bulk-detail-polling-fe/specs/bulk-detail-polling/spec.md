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
`useCampaigns(query, enabled)` MUST pollear cada 30s cuando la pestaña está visible, y NO pollear
cuando está oculta — mismo criterio que el detalle (`useDocumentVisible`).

#### Scenario: historial con pestaña visible
- **GIVEN** el historial montado, pestaña visible
- **WHEN** pasan 30s
- **THEN** hubo un 2do fetch de `listCampaigns`

#### Scenario: historial con pestaña oculta
- **GIVEN** el historial montado, pestaña oculta
- **WHEN** pasan 30s
- **THEN** NO hubo un 2do fetch

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
