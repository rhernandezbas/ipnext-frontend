# Features principales

Inventario de las features de negocio y su propósito. Las rutas viven en
[`src/App.tsx`](../../src/App.tsx); la navegación, agrupada, en
[`Sidebar`](../../src/components/organisms/Sidebar/Sidebar.tsx).

## Clientes

Gestión de la cartera de suscriptores.
- **Clientes** (`/admin/customers/list`): tabla con filtros + búsqueda + paginado + **badge de réplica viva** de Gestión Real.
- **Detalle** (`/admin/customers/view/:id`): tabs de Servicios, Facturas, Logs, Comentarios,
  Documentos, Archivos.
- **Alta/Edición** (`/add`, `/view/:id/edit`), **Mapa**.
- Estado: activo / inactivo / bloqueado / nuevo; saldo y plan tarifario.

## CRM (clientes potenciales)

Preventa: convertir prospectos en clientes.
- **Dashboard**, **Leads** (embudo `new → won/lost`), **Presupuestos**, **Mapa**.

## Tickets y soporte

- **Tickets**: dashboard, lista de abiertos, papelera/archivo, destinatarios.
- **SLA**: acuerdos de nivel de servicio sobre tickets.
- **Comunicaciones** (`/admin/whatsapp/*`): bandeja de entrada WhatsApp (espejo Chatwoot),
  configuración, envío masivo por campañas y templates. Reemplaza al viejo "Mensajes/Soporte"
  legacy (bandeja mock, envío masivo, messengers, noticias), eliminado en el change
  `sidebar-comunicaciones`.

## Finanzas

Ciclo de facturación y cobranza.
- Dashboard, transacciones, **facturas**, notas de crédito, proformas, pagos, historial.
- **Dunning** (morosidad) y **planes de pago**. Payment statements.

## Scheduling (tareas de campo)

Operación de cuadrillas — la feature más rica del front (ver
[tdr/0002](../tdr/0002-feature-module-anatomy.md)).
- **Tareas** (`/admin/scheduling/tasks`): vistas **tabla** y **kanban** (drag&drop por stage),
  filtros sincronizados con URL, columnas configurables, creación con plantillas.
- **Proyectos** (agrupan tareas + workflow), **Workflows/Stages** y colores de stage editables.
- **Calendario**, **Mapas**, **Dashboard**, **Archivo**, catálogos de **categorías** y
  **prioridades**, **plantillas**.
- Polling de 30 s para sensación de tiempo real.

## Red (networking)

Infraestructura del ISP.
- Network sites, **CPE (Mikrotik)**, routers, **TR-069**, hardware, **GPON**, sesiones **RADIUS**,
  redes **IPv4/IPv6**, **topología**, mapas.

## Empresa / catálogos

- **Tarifas**: internet, voz, recurrente, único, paquetes, grupos Huawei.
- **Inventario**: dashboard, items, productos, supply.
- **Voz**: categorías, procesamiento, rate tables, prefijos, **CDR** (registros de llamadas).

## Resellers / Partners

Revendedores y socios con sub-cartera (`/admin/resellers`, `/admin/partners`).

## Portal

Configuración del **portal de autogestión del cliente** y sus usuarios.

## Sistema y transversales

- **Administración** (admins y roles), **Configuración**, **Ubicaciones**, **Perfil**.
- **Informes**, **Monitoring**, **Notificaciones**, **API docs**.
- **Dashboard** principal (`/admin/dashboard`), login y 404.

## Observaciones de producto

- La app **replica el alcance de Splynx**: cubre prácticamente toda la operación de un ISP
  (clientes, facturación, red, soporte, voz, scheduling). Es ancha más que profunda en algunas
  áreas.
- Muchas rutas tienen **redirects de compatibilidad** desde URLs antiguas → la navegación
  histórica del producto está preservada en `App.tsx`.
- El diferencial frente a un panel genérico es la **integración viva con Gestión Real**: el panel
  no es la fuente de verdad de clientes, sino un espejo enriquecido + capa de gestión propia.
