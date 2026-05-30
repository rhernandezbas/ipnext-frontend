# Design: menu-dropdown

## Technical Approach

Migrar `CollapsibleNavItem` a un modelo container-presentational donde el container gestiona toda la lógica de posicionamiento/eventos y un componente presentacional puro renderiza el panel portal. El panel se monta en `document.body` vía `ReactDOM.createPortal` con `position: fixed`, coordinadas calculadas desde el `useRef` del botón trigger via `getBoundingClientRect()`. El reposicionamiento en scroll/resize usa `requestAnimationFrame` como throttle. El componente se mantiene en `Sidebar.tsx` (un único archivo organism) sin romper atomic design — no hay necesidad de extraer a átomos/moléculas ya que `CollapsibleNavItem` no se reutiliza fuera del Sidebar. CSS Modules preservado; se agrega una clase `navPanel` para el portal. Strict TDD: cada decisión de comportamiento tiene test antes de implementación.

## Architecture Decisions

| # | Decisión | Elegido | Alternativa rechazada | Razón |
|---|----------|---------|----------------------|-------|
| 1 | Estrategia de posicionamiento | `position: fixed` + `getBoundingClientRect()` en `useRef` trigger | Librería flotante (Floating UI / Popper.js) | Alcance acotado: un único componente, sin casos edge de flip/collision. Añadir 30KB de dependencia por un sidebar estático es over-engineering. `fixed` + `getBoundingClientRect` es determinista y testeable con jsdom |
| 2 | Portal target | `document.body` directamente | Container `<div id="portal-root">` custom en `index.html` | Menos setup, cero riesgo de z-index stacking context intermedio. Spec lo requiere explícitamente. `document.body` es el default idiomático de React portals |
| 3 | Throttle de scroll/resize | `requestAnimationFrame` con flag `isScheduled` | `lodash.throttle` / debounce | Sin dependencia nueva. `rAF` es el mecanismo nativo de browser para sincronizar con el ciclo de pintura. Cero flickering |
| 4 | Outside click | `mousedown` en `document` con `useEffect` cleanup | `blur` en el panel / `focusout` | `mousedown` captura clicks antes de que el foco cambie, lo que evita race conditions con NavLink. `blur` no funciona para clicks fuera del panel sin `tabIndex` en todos los hijos |
| 5 | Cierre al navegar | `onClick` en cada `NavLink` hijo llama `setOpen(false)` | `useEffect` sobre `location.pathname` | Más explícito, sin efecto secundario. El `useEffect` en `location` cerraría el panel también en navegación programática ajena al sidebar |
| 6 | Animación del panel | `opacity` + `transform: translateX(-4px)` via CSS class toggle con `data-open` | `max-height` transition | `max-height` requiere conocer el alto del panel para la transición (antipatrón). `opacity` + leve `translateX` es fluido y no requiere medición |
| 7 | Foco al abrir con teclado | `useEffect` que hace `firstLink.current?.focus()` cuando `open` pasa a `true` | `autoFocus` en el primer hijo | `autoFocus` en portal causa scroll inesperado en algunos browsers. El `useEffect` es controlado |
| 8 | Escape key | `keydown` listener en el panel portal con `e.key === 'Escape'` + `triggerRef.current?.focus()` | Listener global en document | Listener scoped al panel evita interferencias con otros modales/overlays |
| 9 | `canSee` / permisos | Sin cambios — lógica permanece 100% en el `Sidebar` padre | Mover canSee a CollapsibleNavItem | `CollapsibleNavItem` no renderiza si `canSee` filtra el item. La migración a portal no cambia cuándo se renderiza, solo cómo se posiciona el panel |
| 10 | Separación container/presentational | `CollapsibleNavItem` (container): estado + eventos + posicionamiento. `NavPanel` (internal function component): recibe `items`, `onClose`, `style` — solo renderiza | Un componente monolítico | Testeable en aislamiento. El presentational es pure/stateless → fácil de snapshot-testear |

## Enfoques comparados — Posicionamiento del panel portal

### Enfoque A (ELEGIDO): `position: fixed` + `getBoundingClientRect` manual

```ts
const triggerRef = useRef<HTMLButtonElement>(null);

function getPortalStyle(): React.CSSProperties {
  if (!triggerRef.current) return {};
  const rect = triggerRef.current.getBoundingClientRect();
  return {
    position: 'fixed',
    top: rect.top,
    left: rect.right,  // borde derecho del sidebar
    minWidth: 200,
    zIndex: 9999,
  };
}
```

Reposicionamiento:
```ts
useEffect(() => {
  if (!open) return;
  let scheduled = false;
  function update() {
    setPanelStyle(getPortalStyle());
    scheduled = false;
  }
  function onScrollOrResize() {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  }
  window.addEventListener('scroll', onScrollOrResize, true);  // capture: true para scroll de cualquier ancestro
  window.addEventListener('resize', onScrollOrResize);
  return () => {
    window.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize);
  };
}, [open]);
```

**Pros**: cero dependencias, determinista, jsdom-friendly (mock de `getBoundingClientRect` con `vi.fn()`), z-index controlado.  
**Contras**: no maneja flip automático si el panel sale del viewport (poco relevante: sidebar está a la izquierda, panel abre a la derecha — nunca sale).

### Enfoque B (RECHAZADO): Floating UI (`@floating-ui/react`)

```ts
import { useFloating, shift, flip } from '@floating-ui/react';
const { refs, floatingStyles } = useFloating({
  placement: 'right-start',
  middleware: [shift(), flip()],
});
```

**Pros**: flip/collision automático, bien testeado, robusto para tooltips/dropdowns complejos.  
**Contras**: +~30KB bundle, API más compleja, sobre-ingeniería para un sidebar fijo con 5-8 items. El flip no aporta valor real (el sidebar siempre está a la izquierda de la pantalla).

## Data Flow

```
User click trigger
        │
        ▼
CollapsibleNavItem.handleToggle()
  └── setOpen(true)
  └── setPanelStyle(getBoundingClientRect(triggerRef))
        │
        ▼
useEffect[open] monta listeners scroll/resize
        │
        ▼
ReactDOM.createPortal(<NavPanel />, document.body)
  └── position: fixed, top/left desde panelStyle
  └── z-index: 9999
  └── opacity transition via CSS [data-open="true"]
        │
        ▼
User click NavLink hijo
  └── onClose() → setOpen(false)
  └── React Router navega
        │
        ▼
useEffect cleanup: remueve scroll/resize listeners
portal desmontado (open === false → no createPortal)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/organisms/Sidebar/Sidebar.tsx` | Modify | Refactorizar `CollapsibleNavItem`: agregar `triggerRef`, `panelStyle`, `open` state, listeners scroll/resize/outside-click/escape, `createPortal`. Extraer `NavPanel` como function component interno |
| `src/components/organisms/Sidebar/Sidebar.module.css` | Modify | Agregar clase `.navPanel` (position:fixed, z-index:9999, background, shadow, border-radius, transition opacity+transform). Agregar `.navPanelOpen` o usar `data-open` attribute para la transición |
| `src/__tests__/components/organisms/Sidebar/CollapsibleNavItem.test.tsx` | Create | Tests TDD: portal en body, posicionamiento, outside-click, Escape, cierre al navegar, a11y (aria-expanded, aria-label, foco), permisos preservados |

## Interfaces / Contracts

```tsx
// Componente presentacional interno (dentro de Sidebar.tsx)
interface NavPanelProps {
  items: SubItem[];
  groupLabel: string;
  style: React.CSSProperties;
  onClose: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function NavPanel({ items, groupLabel, style, onClose, onKeyDown }: NavPanelProps) {
  return (
    <div
      role="navigation"
      aria-label={`Menú ${groupLabel}`}
      className={styles.navPanel}
      style={style}
      onKeyDown={onKeyDown}
    >
      {items.map(({ to, label }) => (
        <NavLink key={to} to={to} end className={...} onClick={onClose}>
          {label}
        </NavLink>
      ))}
    </div>
  );
}

// CollapsibleNavItem refactorizado (container)
function CollapsibleNavItem({ item }: { item: NavParentItem }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(active);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  // ... lógica de posicionamiento, listeners, outside-click
  return (
    <div className={styles.navGroup}>
      <button ref={triggerRef} aria-expanded={open} ...>...</button>
      {open && createPortal(
        <NavPanel items={item.children} groupLabel={item.label} style={panelStyle} onClose={() => setOpen(false)} onKeyDown={handleKeyDown} />,
        document.body
      )}
    </div>
  );
}
```

## Testing Strategy

| Layer | Qué | Approach |
|-------|-----|----------|
| Unit | Panel se monta en `document.body` al abrir | `screen.getByRole('navigation')` presente en DOM; verificar que NO está dentro del `<aside>` |
| Unit | Panel NO se monta cuando cerrado | `expect(screen.queryByRole('navigation')).not.toBeInTheDocument()` |
| Unit | Posicionamiento `position: fixed` | Mock `getBoundingClientRect` → `vi.fn().mockReturnValue({top:120, right:240,...})`, verificar `style.top === '120px'` y `style.left === '240px'` en el panel |
| Unit | Reposicionamiento en scroll/resize | `fireEvent.scroll(window)` → `act(rAF flush)` → verificar que `setPanelStyle` se llamó |
| Unit | Outside click cierra el panel | `fireEvent.mousedown(document.body)` → verificar panel desmontado |
| Unit | Click dentro del panel no cierra | `fireEvent.mousedown` en un NavLink del panel → panel sigue montado |
| Unit | Escape cierra y devuelve foco al trigger | `userEvent.keyboard('{Escape}')` → panel desmontado → `document.activeElement === triggerRef` |
| Unit | Cierre al navegar (NavLink click) | `userEvent.click(navLink)` → panel desmontado |
| Unit | `aria-expanded` correcto | `true` cuando open, `false` cuando cerrado |
| Unit | `aria-label` en panel | `getByRole('navigation', { name: 'Menú Clientes' })` |
| Unit | `canSee` preservado | Mock `useMyPermissions` con `can: () => false` → `CollapsibleNavItem` no renderiza (test en `Sidebar.test.tsx` existente, no modificar) |
| Unit | Chevron anima (clase CSS) | Verificar clase `styles.chevronOpen` presente cuando open, ausente cuando cerrado |

## CSS Design

```css
/* Sidebar.module.css — nuevas clases */
.navPanel {
  position: fixed;
  z-index: 9999;
  min-width: 200px;
  background: var(--sidebar-bg, #1e2a3a);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  padding: 4px 0;
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.15s ease-out, transform 0.15s ease-out;
  pointer-events: none;
}

.navPanelOpen {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}
```

La transición se activa agregando/removiendo `navPanelOpen` via `data-open` o un segundo `className`. Dado que el portal se desmonta cuando `open === false`, la transición de cierre requiere un estado intermedio `closing` (opcional — ver Risk 3).

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `getBoundingClientRect` retorna zeros en jsdom | Alto | `vi.fn().mockReturnValue({ top: 120, right: 240, bottom: 152, left: 0, width: 240, height: 32 })` en setup del test |
| `requestAnimationFrame` no existe en jsdom | Medio | `vi.stubGlobal('requestAnimationFrame', (cb) => { cb(); return 1; })` en test setup |
| Transición de cierre imposible (portal desmontado instantáneamente) | Bajo | Para V1 aceptar cierre sin transición. Transición de cierre requeriría estado `closing` + `onTransitionEnd` — scope de mejora futura |
| Múltiples paneles abiertos simultáneamente | Bajo | Estado local por instancia — dos grupos pueden estar open al mismo tiempo. No es bug; si se quiere single-open, requiere estado elevado (OUT de scope) |
| Foco en portal no capturado por screen reader en todos los browsers | Bajo | `role="navigation"` + `aria-label` cumplen WCAG 2.1 AA. Testear con axe-core como verificación extra |

## Commit Order

| # | Commit | Gate |
|---|--------|------|
| 1 | `test(sidebar): RED tests for CollapsibleNavItem portal behavior` | Tests fallan en rojo |
| 2 | `feat(sidebar): migrate CollapsibleNavItem to createPortal with fixed positioning` | Tests verdes, `npx vitest run` pasa |
| 3 | `style(sidebar): add navPanel CSS with opacity transition` | Visual smoke + tests siguen verdes |

---
**Phase**: sdd-design
**Change**: menu-dropdown
**Project**: ipnext-frontend
**Artifact store**: hybrid
**Date**: 2026-05-30
