# Gestión Real Ingest Config Specification

## Purpose

Subpágina ("Gestión Real", un tab nuevo en la Configuración de Scheduling) que permite al operador de logística configurar, monitorear y revisar el ingest de órdenes de instalación de Gestión Real, consumiendo los 4 endpoints existentes del backend `gestion-real-installation-ingest`.

## Requirements

### Requirement: Tab Registration

El sistema MUST registrar un tab "Gestión Real" en la Configuración de Scheduling, deep-linkable vía hash `#gestion-real`, que renderiza el cuerpo de la subpágina.

#### Scenario: Tab visible y seleccionable

- GIVEN el usuario está en la Configuración de Scheduling
- WHEN observa la barra de tabs
- THEN existe un tab con label "Gestión Real"
- AND al seleccionarlo se renderiza el cuerpo con sus 3 secciones (Configuración, Estado, Revisión pendiente)

### Requirement: Config Load

Al montar, el sistema MUST obtener la config vía GET `/api/gestion-real-ingest/config` (a través de un hook, nunca axios directo) y poblar el formulario: toggle `enabled`, selector de intervalo, `windowMonths`, y dos dropdowns de Proyecto (Fibra/Wireless) alimentados desde `useProjects('all')`.

#### Scenario: Formulario poblado desde la config

- GIVEN el backend responde la config con valores existentes
- WHEN el cuerpo termina de cargar
- THEN el toggle, el selector de intervalo, el window y ambos dropdowns reflejan los valores recibidos

### Requirement: Interval Preset Selector

El intervalo MUST mostrarse al usuario en MINUTOS mediante un selector con presets 3/5/15/30/60, persistiéndose como `intervalMs` (minutos × 60000). Si el `intervalMs` cargado no coincide con un preset, el sistema SHOULD mostrarlo de forma elegante (preset más cercano o valor custom) sin romper.

#### Scenario: Conversión minutos↔ms

- GIVEN el usuario selecciona "5" minutos
- WHEN se construye el payload de guardado
- THEN `intervalMs` es 300000

#### Scenario: intervalMs no coincide con preset

- GIVEN la config cargada trae un `intervalMs` que no equivale a ningún preset
- WHEN se renderiza el selector
- THEN se muestra el valor de forma elegante sin crashear ni quedar vacío

### Requirement: Edit and Save

El sistema MUST guardar mediante un botón explícito "Guardar" que dispara un único PUT `/api/gestion-real-ingest/config` con la config editada. El botón MUST estar deshabilitado mientras no haya cambios y mientras se guarda. Tras éxito MUST mostrar feedback e invalidar las queries de config y status.

#### Scenario: Guardar cambios exitoso

- GIVEN el usuario modificó uno o más campos
- WHEN hace clic en "Guardar"
- THEN se envía un PUT con el payload correcto (minutos convertidos a `intervalMs`)
- AND se muestra feedback de éxito y se invalidan las queries

#### Scenario: Botón deshabilitado sin cambios

- GIVEN el formulario no tiene cambios respecto a la config cargada
- WHEN el usuario observa el botón "Guardar"
- THEN está deshabilitado

### Requirement: Save Error Handling

Ante errores del PUT, el sistema MUST mapear el código de error a un mensaje en español y NO confirmar el guardado: 400 `VALIDATION_ERROR` y 404 `PROJECT_NOT_FOUND`.

#### Scenario: Error de validación

- GIVEN el PUT responde 400 con code `VALIDATION_ERROR`
- WHEN falla el guardado
- THEN se muestra un mensaje de validación claro y no se confirma el guardado

#### Scenario: Proyecto inexistente

- GIVEN el PUT responde 404 con code `PROJECT_NOT_FOUND`
- WHEN falla el guardado
- THEN se muestra un mensaje de proyecto no encontrado

### Requirement: Enable-with-unmapped-project Guard

Si el usuario habilita `enabled` mientras `fiberProjectId` o `wirelessProjectId` es null, el sistema MUST mostrar una advertencia clara (bloqueando el guardado o exigiendo confirmación), espejando el bug backend C1 donde una orden clasificada sin proyecto mapeado cae como needs-review.

#### Scenario: Habilitar con proyecto sin mapear

- GIVEN `fiberProjectId` o `wirelessProjectId` es null
- WHEN el usuario activa el toggle `enabled`
- THEN se muestra una advertencia clara que avisa del riesgo de tareas en revisión

### Requirement: Project Dropdowns

Los dropdowns de Proyecto (Fibra/Wireless) MUST poblarse desde la lista de proyectos (`useProjects('all')`) e incluir una opción null "(sin asignar)".

#### Scenario: Opción sin asignar

- GIVEN la lista de proyectos está cargada
- WHEN el usuario abre un dropdown de Proyecto
- THEN existe una opción "(sin asignar)" que mapea a null

### Requirement: Status Panel

La sección Estado MUST renderizar los 4 contadores (`created`, `skippedDuplicate`, `skippedUnmirrored`, `unclassified`) y `lastRunAt` formateado, mostrando "Nunca" cuando es null. MUST auto-refrescar vía polling periódico (`refetchInterval` ~30s de TanStack Query) sobre GET `/api/gestion-real-ingest/status`.

#### Scenario: Estado con datos

- GIVEN el status responde con `lastRunAt` y los 4 contadores
- WHEN se renderiza la sección Estado
- THEN se muestran los 4 contadores y `lastRunAt` formateado

#### Scenario: Sin corridas previas

- GIVEN `lastRunAt` es null
- WHEN se renderiza la sección Estado
- THEN se muestra "Nunca"

#### Scenario: Auto-refresh activo

- GIVEN la sección Estado está montada
- WHEN se inspecciona la query de status
- THEN tiene `refetchInterval` configurado para refrescar periódicamente

### Requirement: Needs-Review List

La sección Revisión pendiente MUST listar las tareas needs-review de GET `/api/gestion-real-ingest/needs-review` mostrando al menos title, address, grOrdenId y createdAt. Cada fila MUST linkear al detalle de la tarea en `/admin/scheduling/tasks/:id`. MUST mostrar un estado vacío cuando no hay tareas.

#### Scenario: Filas con link al detalle

- GIVEN el endpoint responde una o más tareas needs-review
- WHEN se renderiza la sección
- THEN cada fila muestra title, address, grOrdenId y createdAt
- AND cada fila linkea a `/admin/scheduling/tasks/:id` con el id de la tarea

#### Scenario: Lista vacía

- GIVEN el endpoint responde un array vacío
- WHEN se renderiza la sección
- THEN se muestra un estado vacío
