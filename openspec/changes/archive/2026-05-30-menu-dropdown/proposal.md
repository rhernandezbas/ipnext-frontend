# Proposal: Sidebar Menu Dropdown Optimization

## Intent
Optimizar el comportamiento del menú lateral (Sidebar) en dos ejes concretos:
1. Migrar los dropdowns de `CollapsibleNavItem` a `createPortal` para evitar clipping por `overflow-y: auto` del `<aside>`.
2. Pulir el comportamiento visual de expand/collapse (animación de chevron, cierre automático al navegar).

## Scope

### IN
- `src/components/organisms/Sidebar/Sidebar.tsx` — refactorizar `CollapsibleNavItem` para usar `createPortal`.
- `src/components/organisms/Sidebar/Sidebar.module.css` — ajustes de clases CSS para el panel portal (posicionamiento, z-index, sombra).
- `src/__tests__/components/organisms/Sidebar/CollapsibleNavItem.test.tsx` — tests nuevos cubriendo portal + comportamiento visual (TDD primero).

### OUT (explícito — no tocar)
- `src/App.tsx` — no se modifica (flag: no toca App.tsx).
- Rutas / React Router config — no se reorganizan rutas ni deep links.
- Categorías del menú (`CRM_ITEMS`, `EMPRESA_ITEMS`, `SISTEMA_ITEMS`) — no se reordenan ni agregan.
- Buscador de menú — fuera de scope.
- Favoritos / items fijados — fuera de scope.
- Lógica de permisos (`canSee`, `useMyPermissions`) — se preserva intacta, sin modificar la firma.

## Approach
- El `<button>` de cada grupo (`navParent`) conserva su posición en el DOM dentro del sidebar.
- Al abrirse, el listado de hijos (`navChildren`) se renderiza vía `ReactDOM.createPortal` en `document.body`.
- El portal se posiciona absolutamente usando el `getBoundingClientRect()` del botón trigger como referencia (posición left del sidebar + top del botón).
- El panel portal escucha `scroll` y `resize` para recalcular posición en tiempo real.
- El expand/collapse mantiene el estado local (`useState`) existente; la animación del chevron continúa via CSS (`transform: rotate`). Se agrega una transición `max-height` o `opacity` suave al panel.
- Al navegar a un hijo (NavLink click), el panel se cierra automáticamente.
- Un click fuera del panel (outside click) también lo cierra.

## Risks
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| z-index conflict con modales existentes | Bajo | Usar `z-index: 9999` para el panel portal; documentar en CSS comment |
| Scroll/resize desync (panel flicker) | Medio | `requestAnimationFrame` para throttle del reposicionamiento |
| Test complexity por portal en jsdom | Medio | Agregar `document.body` como container en los tests; Testing Library lo soporta nativamente |
| Regresión en `canSee` / permisos | Bajo | Los tests de permisos existentes deben pasar sin cambios |

## Rollback
Revertir `Sidebar.tsx` y `Sidebar.module.css` al estado anterior. Los tests nuevos fallarán (intencionalmente) hasta el re-apply.
