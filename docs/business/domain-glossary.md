# Glosario de dominio

Prominense es un panel de gestión de un ISP (proveedor de internet). Vocabulario del negocio, con
referencia al tipo TypeScript que lo modela en `src/types/`.

## Clientes y servicios

| Término | Qué es | Tipo |
|---|---|---|
| **Cliente / Customer** | Suscriptor del ISP. Tiene estado, saldo (`balance`), categoría y plan tarifario. Datos canónicos en Gestión Real, espejados al mirror. | [`customer.ts`](../../src/types/customer.ts) → `Customer` |
| **Estado de cliente** | `active`, `inactive`, `blocked`, `new`. Controla acceso al servicio. | `CustomerStatus` |
| **Servicio / Service** | Servicio contratado por un cliente (plan, precio, IP, fechas). Un cliente tiene N servicios. | `Service` |
| **Contrato** | Vínculo comercial cliente↔servicio. En la UI del mirror se cuentan junto a los clientes (badge "réplica viva · N clientes · M contratos"). | — |
| **Tarifa / Tariff / Plan** | Catálogo de precios: internet, voz, recurrente, único, paquetes, grupos Huawei. | `empresa.ts` y rutas `/admin/tariffs/*` |
| **Voucher** | Crédito/cupón prepago asociado a un cliente. | `voucher.ts` |
| **Sesión online / RADIUS** | Sesión de conexión activa de un cliente (IP, MAC, throughput). | `radiusSessions.ts`, `OnlineSession` |

## CRM / preventa

| Término | Qué es | Tipo |
|---|---|---|
| **Lead / Cliente potencial** | Prospecto aún no convertido en cliente. Tiene `status` de embudo y `source`. | [`lead.ts`](../../src/types/lead.ts) → `Lead` |
| **Estado de lead** | Embudo: `new → contacted → qualified → proposal_sent → won / lost`. | `LeadStatus` |
| **Fuente / Source** | Origen del lead: `website`, `referral`, `cold_call`, `social_media`, `other`. | `LeadSource` |
| **Conversión** | Pasar un lead a cliente (`convertedClientId`, `convertedAt`). | `Lead` |
| **Presupuesto / Quote** | Cotización CRM enviada a un prospecto. | `crmQuote.ts` |

## Scheduling (tareas de campo)

El núcleo operativo de instalaciones/reparaciones. Modela trabajo de cuadrillas con workflow.

| Término | Qué es | Tipo |
|---|---|---|
| **Tarea / ScheduledTask** | Unidad de trabajo de campo (instalación, reparación, etc.) con `sequenceNumber`, prioridad, categoría, fechas, cliente y técnico asignado. | [`scheduling.ts`](../../src/types/scheduling.ts) → `ScheduledTask` |
| **Proyecto / Project** | Agrupa tareas y referencia un Workflow. Lleva conteos por categoría de stage. | [`project.ts`](../../src/types/project.ts) → `Project` |
| **Workflow** | Definición del flujo de trabajo: una lista ordenada de **stages**. Cada proyecto usa uno. | [`workflow.ts`](../../src/types/workflow.ts) → `Workflow` |
| **Stage / Etapa** | Paso del workflow (nombre, orden, color). Cada tarea está en una stage. | `WorkflowStage` |
| **Categoría de stage** | Clasificación transversal de una stage: `nuevo`, `enProgreso`, `hecho`, `cancelado`. Es lo que pinta el Kanban. Filtro **client-side** (el backend no lo conoce). | `TaskStageCategory` |
| **Prioridad / Categoría de tarea** | Catálogos editables (texto libre respaldado por catálogo): `TaskPriority`, `TaskCategory`. | `taskPriority.ts`, `taskCategory.ts` |
| **Plantilla / Template** | Plantilla de tarea con checklist predefinido. | `taskTemplate.ts` |
| **Técnico / Assignee** | Admin asignado a ejecutar la tarea (`assigneeId`). | `useTechnicians` |

> ⚠ `scheduling.ts` tiene varios campos `@deprecated` (`assignedTo`, `clientId`, `clientName`,
> `TaskStatus`) en transición hacia `assigneeId`/`customerId`/`stageCategory`. Conviven legacy +
> nuevo modelo.

## Soporte y comunicación

| Término | Qué es | Tipo |
|---|---|---|
| **Ticket** | Caso de soporte. Tiene dashboard, lista, archivo (papelera), destinatarios. | `ticket.ts`, `ticketRequester.ts` |
| **SLA** | Acuerdo de nivel de servicio aplicado a tickets. | `sla.ts` |
| **Messenger / Inbox** | Canales de mensajería y bandeja de soporte. Envío masivo y noticias. | `messenger.ts`, `message.ts`, `news.ts` |

## Finanzas

| Término | Qué es |
|---|---|
| **Factura / Invoice** | Documento de cobro. También **proformas** y **notas de crédito**. |
| **Pago / Payment**, **Transacción** | Cobros y movimientos. |
| **Dunning** | Gestión de morosidad: clientes atrasados y acciones de cobranza. |
| **Plan de pago** | Acuerdo de cuotas para saldar deuda. |
| **Payment statement** | Estado de cuenta. |

## Infraestructura de red

| Término | Qué es |
|---|---|
| **Network site** | Sitio/nodo de red. |
| **CPE** | Equipo en casa del cliente (Mikrotik). |
| **GPON / OLT / ONU** | Fibra óptica (gestión vía SmartOLT en el backend). |
| **TR-069** | Protocolo de gestión remota de CPEs. |
| **Topología** | Mapa de la red. **IPv4/IPv6 networks**: rangos asignables. |

## Sistema

| Término | Qué es |
|---|---|
| **Admin** | Usuario operador del panel; tiene `role`. |
| **Partner / Reseller** | Socio/revendedor que opera sub-cartera de clientes. |
| **Ubicación** | Localidad/zona geográfica de clientes y red. |

## Concepto transversal: el mirror de Gestión Real

> **Gestión Real (Real Software)** es la fuente de verdad externa de clientes/contratos. El backend
> mantiene un **mirror read-only** que sincroniza periódicamente. La UI lo refleja como "réplica
> viva" con un badge de estado (ver [ADR 0005](../adr/0005-gestion-real-live-mirror-ui.md)). Las
> escrituras del panel van al backend propio, no a Gestión Real.
