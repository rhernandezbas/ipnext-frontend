# Spec: navigation-sidebar (Sidebar Dropdown Optimization)

**Capability**: `navigation-sidebar` (MODIFIED)
**Change**: `menu-dropdown`
**Componente afectado**: `src/components/organisms/Sidebar/Sidebar.tsx` → `CollapsibleNavItem`

---

## Modified Requirements

### REQ-PORTAL-1: Renderizado via createPortal

`CollapsibleNavItem` MUST renderizar el panel de hijos (`navChildren`) mediante `ReactDOM.createPortal(panel, document.body)` cuando `open === true`.
El panel MUST NOT renderizarse dentro del `<aside>` del Sidebar para evitar clipping por `overflow-y: auto`.

#### Scenario: panel renderizado en document.body
**Given** un `CollapsibleNavItem` con `open === false`
**When** el usuario hace click en el botón trigger
**Then** el panel de hijos MUST aparecer como hijo directo de `document.body` en el DOM
**And** el panel MUST NOT estar contenido dentro del elemento `<aside>` del Sidebar

#### Scenario: panel NO renderizado cuando cerrado
**Given** un `CollapsibleNavItem` con `open === false`
**Then** el portal MUST NOT existir en el DOM (no se monta el portal si `!open`)

---

### REQ-PORTAL-2: Posicionamiento correcto del panel portal

El panel portal MUST posicionarse usando `position: fixed` con coordenadas calculadas desde el `getBoundingClientRect()` del botón trigger.
El `top` MUST alinearse al borde superior del botón. El `left` MUST alinearse al borde derecho del sidebar (o al borde izquierdo del botón).

#### Scenario: panel alineado al trigger
**Given** un `CollapsibleNavItem` cuyo botón trigger está a `top: 120px, left: 0, width: 240px` en viewport
**When** el usuario abre el panel
**Then** el panel MUST aparecer con `top` aproximadamente `120px` y `left` aproximadamente `240px` (borde derecho del sidebar)
**And** el panel MUST tener `position: fixed` para no verse afectado por el scroll del sidebar

#### Scenario: repositionamiento en scroll/resize
**Given** el panel está abierto
**When** el usuario hace scroll en la página o redimensiona la ventana
**Then** el panel MUST recalcular su posición para seguir al botón trigger
**And** el recálculo SHOULD usar `requestAnimationFrame` para evitar thrashing de layout

#### Scenario: sin clipping por overflow del sidebar
**Given** el sidebar tiene `overflow-y: auto`
**And** un `CollapsibleNavItem` tiene muchos hijos que exceden el viewport height
**When** el panel está abierto
**Then** el panel MUST ser completamente visible sin clipping
**And** el panel MUST tener scroll interno si su contenido excede el viewport height disponible

---

### REQ-COLLAPSE-1: Cierre automático al navegar

`CollapsibleNavItem` MUST cerrar el panel automáticamente cuando el usuario hace click en cualquier `NavLink` hijo.

#### Scenario: cierre al seleccionar ítem hijo
**Given** el panel de un grupo está abierto
**When** el usuario hace click en un `NavLink` hijo (ej: "Búsqueda")
**Then** el panel MUST cerrarse (`open` pasa a `false`)
**And** la navegación MUST completarse normalmente (React Router no se interrumpe)

---

### REQ-COLLAPSE-2: Cierre por click fuera (outside click)

`CollapsibleNavItem` MUST cerrar el panel cuando el usuario hace click fuera del panel y fuera del botón trigger.

#### Scenario: click fuera cierra el panel
**Given** el panel de un grupo está abierto
**When** el usuario hace click en cualquier elemento fuera del panel portal y fuera del botón trigger
**Then** el panel MUST cerrarse

#### Scenario: click dentro del panel no lo cierra
**Given** el panel de un grupo está abierto
**When** el usuario hace click dentro del panel (en un NavLink o en el scroll interno)
**Then** el panel MUST permanecer abierto hasta que el NavLink complete la navegación

---

### REQ-VISUAL-1: Animación de chevron preservada y mejorada

La animación del chevron (`›`) MUST continuar funcionando via CSS `transform: rotate`.
Adicionalmente, el panel portal MUST tener una transición suave de apertura/cierre.

#### Scenario: chevron rota al abrir
**Given** el panel está cerrado (`open === false`)
**When** el usuario hace click en el botón trigger
**Then** el chevron MUST rotar de `0deg` a `90deg` con una transición CSS de `0.2s`

#### Scenario: chevron vuelve al cerrar
**Given** el panel está abierto (`open === true`)
**When** el panel se cierra (click fuera, navegación, o click en trigger)
**Then** el chevron MUST volver a `0deg`

#### Scenario: panel tiene transición de opacidad
**Given** el panel se abre
**Then** el panel MUST aparecer con una transición de `opacity` de `0` a `1` de `0.15s` como mínimo
**And** la transición SHOULD usar `ease-out`

---

### REQ-VISUAL-2: Estado activo preservado

El estado visual activo del botón trigger (`navParentActive`) MUST seguir aplicándose cuando la ruta actual coincide con alguno de los `matchPaths` del grupo.

#### Scenario: grupo activo marcado visualmente
**Given** la ruta actual es `/admin/customers/list`
**And** el grupo "Clientes" tiene `matchPaths: ['/admin/customers']`
**When** el Sidebar renderiza
**Then** el botón trigger de "Clientes" MUST tener la clase `navParentActive`
**And** el grupo MUST inicializar con `open === true` (comportamiento existente preservado)

---

### REQ-PERMS-1: canSee preservado sin cambios

La función `canSee(item)` MUST continuar filtrando los grupos antes de renderizar `CollapsibleNavItem`.
La migración a portal NO MUST alterar la lógica de permisos.

#### Scenario: ítem sin permiso no renderiza
**Given** `useMyPermissions().can('billing.read')` retorna `false`
**And** el grupo "Finanzas" tiene `requiredPermission: 'billing.read'`
**When** el Sidebar renderiza
**Then** ningún `CollapsibleNavItem` para "Finanzas" MUST aparecer en el DOM

#### Scenario: loading muestra todos los ítems
**Given** `useMyPermissions().isLoading === true`
**When** el Sidebar renderiza
**Then** TODOS los grupos MUST renderizarse (sin filtrado)
**And** no MUST ocurrir layout shift visible entre el estado loading y el estado con permisos cargados

---

### REQ-A11Y-1: Accesibilidad básica del panel portal

#### Scenario: botón trigger tiene aria-expanded
**Given** el panel está abierto
**Then** el botón trigger MUST tener `aria-expanded="true"`
**Given** el panel está cerrado
**Then** el botón trigger MUST tener `aria-expanded="false"`

#### Scenario: panel portal tiene aria-label
**When** el panel portal está montado
**Then** el contenedor del panel MUST tener `role="navigation"` o estar dentro de un elemento con `role="navigation"`
**And** SHOULD tener `aria-label` que identifique el grupo (ej: `aria-label="Menú Clientes"`)

#### Scenario: foco al abrir con teclado
**Given** el usuario navega con Tab hasta el botón trigger
**When** el usuario presiona Enter o Space
**Then** el panel MUST abrirse
**And** el foco SHOULD moverse al primer NavLink hijo del panel

#### Scenario: Escape cierra el panel
**Given** el panel está abierto y el foco está dentro del panel
**When** el usuario presiona Escape
**Then** el panel MUST cerrarse
**And** el foco MUST volver al botón trigger

---

## Notes
- El portal MUST montarse en `document.body`. No usar un container intermedio custom para no romper el z-index stack.
- Los tests DEBEN usar `@testing-library/react` con `screen.getByRole` y `userEvent`. El panel portal es accesible desde el root `document.body` sin configuración adicional en jsdom.
- NO usar `findDOMNode` (deprecated en React 18 strict mode). Usar `useRef` en el botón trigger para `getBoundingClientRect()`.
- El `z-index` del panel portal MUST ser `9999` para superar el `z-index: 100` del `<aside>`.
