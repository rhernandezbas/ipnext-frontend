# Proposal: Polling honesto del detalle de campaña + errores del send visibles (Change A, parte FE)

## Intent

La page de detalle de campaña bulk (`/admin/whatsapp/bulk?campaign=<id>`) NO se auto-refrescaba:
`useCampaign` (hook de detalle) solo pollea a 5s cuando `campaign.status === 'running'`; en
`pending`/`paused` devolvía `false` → página muerta, el usuario tenía que F5 a mano para ver que
el envío arrancó o se reanudó. Además, si el POST `/campaigns/:id/send` fallaba (ej. 409
`CAMPAIGN_SEND_IN_PROGRESS`, causado hoy en prod por un lock stuck del BE — bug BE aparte), el
wording del mensaje ("otra campaña enviándose") no comunicaba que podía tratarse de un lock
trabado del servidor, y el usuario reportaba "no pasó nada".

Este change resuelve la parte FE: polling honesto (30s en `pending`/`paused`, historial incluido)
+ mensajes de error del send SIEMPRE visibles y persistentes.

## Investigación adicional (prioridad 1, pedida a mitad de tarea)

El coordinador reportó un hallazgo de prod: el access log de nginx muestra **cero líneas
`POST .../send`** para el intento de envío reportado — el POST nunca salió del browser. Hipótesis
de trabajo: la cadena de doble `ConfirmModal` de `SendCampaignButton` (segundo modal que no abre,
`onConfirm` no cableado a la mutation, error JS tragado, gating del botón).

**Resultado de la investigación (evidencia, no suposición):** se escribió un test de click-through
completo a 3 niveles de composición —

1. `SendCampaignButton` aislado (`SCB-6`, ya existía) — PASA.
2. `CampaignDetail` real con `useSendCampaign`/`useCampaign` reales, solo la API mockeada (`CD-6`,
   ya existía) — PASA.
3. **`BulkMessagingPage` completo** (router real `MemoryRouter`, `Tabs mountMode="all"` con AMBOS
   tabs montados simultáneamente, exactamente la composición de prod) — test NUEVO `BMP-9`
   (`src/__tests__/whatsapp/BulkMessagingPage.test.tsx`) — **PASA sin ningún cambio de código**.

Es decir: click en "Enviar campaña" → confirmar modal 1 → confirmar modal 2 → `sendCampaign('camp-1')`
se invoca correctamente en los 3 niveles, incluyendo la composición completa de la page real con
`mountMode="all"`. **No se pudo reproducir el bug "el POST nunca sale" en el árbol de componentes
actual (`main`/`eed027b0` en este worktree).** El wiring `onClick` → `onConfirm` → `confirmSecond`
→ `send(campaignId, {...})` → `mutation.mutate` → `api.sendCampaign` → `axiosClient.post` está
verificado correcto y ahora queda protegido por `BMP-9` como regresión permanente.

Candidatos que quedan FUERA del alcance de un test de componente (no descartables solo con
Vitest/happy-dom, requieren verificación de infra/prod):
- **Bundle stale servido por el browser** tras un deploy (el usuario interactuó con JS viejo,
  de antes de una fix previa — el archivo ya tiene comentarios de rondas anteriores de "el botón
  no hace nada", `FIX-3a`/`FIX-3b`/`FIX-8b`). Verificar cache-busting/hash del bundle en el deploy
  afectado.
- **Extensión de browser / adblocker** bloqueando URLs con el patrón `/send` (patrón común de
  bloqueo de beacons/trackers en uBlock/Brave Shields) — específico del browser del operador.
- **CSP `connect-src`** bloqueando el POST específicamente — improbable si el resto de los POST
  (creación de campaña) funciona, pero no verificado acá (fuera del alcance FE).

No se aplicó ningún "fix" especulativo sobre el flujo del botón — el código ya es correcto y las 3
capas de test lo demuestran. Se deja `BMP-9` como guardia permanente y esta nota para que el
equipo audite las hipótesis de infra listadas arriba.

### Actualización — root cause confirmado (2026-07-16, scope adicional)

Cerrado EN VIVO con el usuario: **el "bug" era UX, no código.** El operador creaba la campaña —
`CreateCampaignConfirmModal` ya muestra un resumen de impacto ("vas a afectar a N clientes") que
SE SIENTE como una confirmación de envío — aterrizaba en el detalle con status `pending` y creía
que la campaña ya estaba enviada. Nunca clickeaba "Enviar campaña". Si el dueño del producto se
confundió, cualquier operador se iba a confundir igual. Las hipótesis de bundle stale / extensión
de browser / CSP quedaron DESCARTADAS: 3 repros Playwright contra prod emitieron el POST `/send`
perfecto cuando se ejecutó la acción real (click en "Enviar campaña").

Fixes aplicados (ver `tasks.md` sección "Root cause del incidente de prod"):
- Banner explícito en `CampaignDetail` cuando `status==='pending'` ("todavía no se envió").
- Línea de próximo paso al final del resumen de `CreateCampaignConfirmModal` ("se crea en estado
  Pendiente — el envío se dispara después, desde el detalle").

Ver `specs/bulk-detail-polling/spec.md` — Capability "crear ≠ enviar es explícito" (UX-1/UX-2).

## Scope

### In Scope
- `campaignPollInterval(status, visible)`: función PURA que centraliza la política de polling del
  detalle (extraída de `useCampaign`), testeada en todas sus ramas.
- `useCampaign`: pasa a pollear 30s en `pending`/`paused` (antes `false`), mantiene 5s en `running`
  y `false` en `done`/`failed`/pestaña oculta.
- `useCampaigns` (historial): nuevo `refetchInterval` de 30s gateado por `useDocumentVisible` — la
  tabla de campañas también avanza sin F5.
- `SendCampaignButton`: wording del 409 más claro ("envío en curso en el servidor", no "otra
  campaña") — ya no implica que es necesariamente OTRA campaña normal, cubre el caso real de un
  lock stuck. El bloque de error genérico (red/500) y la invalidación inmediata post-success ya
  existían y se dejan verificados (no requerían cambio de código).
- `BMP-9`: test de regresión del click-through completo de envío a nivel `BulkMessagingPage`
  (composición real con router + tabs), producto de la investigación de prioridad 1.

### Out of Scope
- El lock stuck del BE (bug de otro repo/capa, ya trackeado aparte).
- Rediseño visual de `CampaignDetail`/`SendCampaignButton` (hay un rediseño completo planificado
  aparte — cambios acá son mínimos y quirúrgicos).
- Cualquier fix del flujo de envío en sí — no se encontró nada que arreglar (ver investigación
  arriba); si el problema reaparece, hace falta instrumentación de prod (ej. Sentry/breadcrumb en
  el POST) para capturar el caso real, no más tests de componente.

## Capabilities

### New Capabilities
- `bulk-detail-polling`: política de polling del detalle de campaña + historial, y visibilidad
  garantizada de errores del send.

### Modified Capabilities
- None (extensión del comportamiento existente de `useBulkMessaging.ts` / `SendCampaignButton.tsx`).

## Approach

| Tema | Estado | Resolución |
|------|--------|------------|
| Polling `pending`/`paused` | Decidido | 30s (pedido explícito), extraído a `campaignPollInterval` pura para test exhaustivo de ramas sin montar el hook. |
| Polling historial | Decidido | `useCampaigns` gana `refetchInterval: visible ? 30_000 : false` (mismo gate que el detalle). |
| Wording del 409 | Decidido | De "otra campaña enviándose" a "envío en curso en el servidor" — más preciso dado el bug real de lock stuck en prod; sigue sin decir "tu campaña". |
| Persistencia del error | Ya cumplido | El bloque `conflict`/`sendError` no tiene timer que lo oculte (a diferencia del toast de éxito, 4s) — verificado con un test que avanza fake timers 4s+ y confirma que el alert sigue. |
| Invalidación inmediata post-success | Ya cumplido | `useSendCampaign.onSuccess` invalida `['messagingBulk','campaign',campaignId]` (prefijo, cubre la key con `includeRecipients`) + `['messagingBulk','campaigns']` — `invalidateQueries` dispara un refetch inmediato, no espera el próximo tick del polling. |
| Bug "POST nunca sale" | Investigado, no reproducido | 3 tests de click-through (aislado, integración, page completa) pasan sin cambios. Ver sección de investigación arriba. |

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `src/hooks/useBulkMessaging.ts` | Modified | +`campaignPollInterval` (export), `useCampaign` la usa, `useCampaigns` gana polling 30s |
| `src/pages/whatsapp/BulkMessagingPage/components/detail/SendCampaignButton.tsx` | Modified | Wording del mensaje 409 |
| `src/__tests__/hooks/useBulkMessaging.test.ts` | Modified | Tests de `campaignPollInterval`, nuevas ramas de `useCampaign`/`useCampaigns` |
| `src/__tests__/whatsapp/detail/SendCampaignButton.test.tsx` | Modified | Wording actualizado en SCB-7 + nuevo test de persistencia |
| `src/__tests__/whatsapp/BulkMessagingPage.test.tsx` | Modified | +`BMP-9` (regresión del click-through completo de envío) |

### Fix Wave (review adversarial, 2026-07-16)

| Area | Impact | Description |
|------|--------|--------------|
| `src/hooks/useBulkMessaging.ts` | Modified | `useCampaigns` gana `poll` (3er param, opt-in, default `false`); `useCampaign` gana `active` (3er param, tab-gating) y deriva `heavy` de `query.includeRecipients`; `campaignPollInterval` gana `{heavy}` |
| `src/pages/whatsapp/BulkMessagingPage.tsx` | Modified | Propaga `active={activeTab==='history'}` a `CampaignsTable`/`CampaignDetail` |
| `src/pages/whatsapp/BulkMessagingPage/components/history/CampaignsTable.tsx` | Modified | Prop `active`; activa `poll:true` en `useCampaigns` (único caller) |
| `src/pages/whatsapp/BulkMessagingPage/components/detail/CampaignDetail.tsx` | Modified | Prop `active`, re-propagada a `CampaignHeader`/`RecipientsTable`; **+banner "todavía no se envió" en `pending`** (root cause crear≠enviar) |
| `src/pages/whatsapp/BulkMessagingPage/components/detail/CampaignHeader.tsx` | Modified | Prop `active` |
| `src/pages/whatsapp/BulkMessagingPage/components/detail/RecipientsTable.tsx` | Modified | Prop `active` |
| `src/pages/whatsapp/BulkMessagingPage/components/composer/CreateCampaignConfirmModal.tsx` | Modified | +línea de próximo paso al final del resumen (root cause crear≠enviar) |
| `src/__tests__/hooks/useBulkMessaging.test.ts` | Modified | +12 tests (opt-in, active, heavy) |
| `src/__tests__/whatsapp/history/CampaignsTable.test.tsx` | Modified | +CT-8 (poll wiring) |
| `src/__tests__/whatsapp/detail/CampaignDetail.test.tsx` | Modified | +CD-7 (tab-gating), +CD-8 (banner pending) |
| `src/__tests__/whatsapp/composer/CreateCampaignConfirmModal.test.tsx` | Modified | +CCM-14 (copy próximo paso) |
| `src/__tests__/whatsapp/BulkMessagingPage.test.tsx` | Modified | BMP-9 renombrado + asserts de cardinalidad; +BMP-10 (integración tab-gating) |
| `openspec/changes/bulk-detail-polling-fe/tasks.md` | Modified | Secciones "Fix Wave", "Root cause", "Deudas" |
| `openspec/changes/bulk-detail-polling-fe/specs/bulk-detail-polling/spec.md` | Modified | +POLL-4/POLL-5/POLL-6, +Capability "crear ≠ enviar es explícito" (UX-1/UX-2) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| 30s de polling en `pending`/`paused` + historial aumenta la carga del BE | Low | Mismo orden de magnitud que el polling `running` existente (5s); gateado por `useDocumentVisible` (no pollea en background) |
| El bug "POST nunca sale" es real pero de infra, no de código | Medium | Documentado en el proposal con hipótesis concretas para que el equipo lo audite fuera del alcance FE; `BMP-9` queda como guardia si alguna vez se rompe el wiring del componente |

## Rollback Plan

Revertir `campaignPollInterval` a los valores previos (`pending`/`paused` → `false`), sacar el
`refetchInterval` de `useCampaigns`, y revertir el wording del 409. Sin cambios de schema/API — 100%
reversible en el FE.

## Success Criteria

- [x] `campaignPollInterval` cubre las 7 ramas (visible/oculto × running/pending/paused/done/failed/undefined).
- [x] `useCampaign` pollea 30s en `pending`/`paused`, 5s en `running`, `false` en terminal/oculto.
- [x] `useCampaigns` pollea 30s gateado por `useDocumentVisible`.
- [x] El 409 muestra un mensaje claro ("envío en curso en el servidor") y persiste (no timer).
- [x] Cualquier error del send (409 o genérico) es visible con `role="alert"`.
- [x] La invalidación post-success cubre la key con `includeRecipients` (prefijo de query key).
- [x] Investigación del bug "POST nunca sale": reproducido/descartado con test a 3 niveles,
      documentado, `BMP-9` como guardia permanente.
- [x] (Fix Wave) `useCampaigns` NO pollea sin `poll:true` explícito — el inbox no hereda el poll.
- [x] (Fix Wave) El poll se apaga cuando el tab que lo contiene no está activo (`active` prop).
- [x] (Fix Wave) La variante pesada (`includeRecipients`) NO pollea en `pending`/`paused`.
- [x] (Fix Wave) BMP-9 documenta honestamente su alcance (guardia de wiring, no repro de prod) y
      tiene asserts de cardinalidad.
- [x] (Root cause, scope adicional) El detalle en `pending` muestra un aviso explícito; el modal
      de creación nombra el próximo paso.
