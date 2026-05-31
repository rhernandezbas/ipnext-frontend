# Tasks: menu-dropdown

## Phase 1 — Infraestructura de tests
> Checkpoint: `npx vitest run` pasa sin errores. Mocks de `getBoundingClientRect` y `requestAnimationFrame` disponibles globalmente para los tests del portal.

- [ ] 1.1 Crear `src/__tests__/components/organisms/Sidebar/CollapsibleNavItem.test.tsx` — archivo vacío con imports base (`vi`, `render`, `screen`, `userEvent`, `fireEvent`, `createPortal` accesible en jsdom) — `src/__tests__/components/organisms/Sidebar/CollapsibleNavItem.test.tsx` (Create) — 10m — no deps
- [ ] 1.2 Agregar `vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; })` en el `beforeEach` del archivo de test — mismo archivo — 5m — dep 1.1
- [ ] 1.3 Agregar helper `mockTriggerRect(top: number, right: number)` que llama `Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({ top, right, bottom: top+32, left: 0, width: right, height: 32, x: 0, y: top, toJSON: () => {} })` — mismo archivo — 10m — dep 1.2
- [ ] 1.4 Agregar `afterEach(() => vi.restoreAllMocks())` para limpiar el mock de `getBoundingClientRect` entre tests — mismo archivo — 5m — dep 1.3
- [ ] 1.5 Verificar: `npx vitest run src/__tests__/components/organisms/Sidebar/CollapsibleNavItem.test.tsx` — 0 tests, 0 errores de setup — (verificación) — 5m — dep 1.4

---

## Phase 2 — Tests RED (TDD: escribir todos los tests antes de implementar)
> Checkpoint: todos los tests de este archivo FALLAN (comportamiento portal no implementado aún). `npx vitest run CollapsibleNavItem.test.tsx` → todos red.
> Commit: `test(sidebar): RED tests for CollapsibleNavItem portal behavior`

- [ ] 2.1 **TEST RED** — portal en body: renderizar `CollapsibleNavItem` con un item de prueba, hacer click en trigger, verificar `screen.getByRole('navigation')` existe y NO está dentro del `<aside>` (`expect(aside).not.toContainElement(panel)`) — 15m — dep Phase 1
- [ ] 2.2 **TEST RED** — panel NO montado cuando cerrado: sin click, verificar `screen.queryByRole('navigation')` es `null` — 10m — dep 2.1
- [ ] 2.3 **TEST RED** — posicionamiento `position: fixed`: llamar `mockTriggerRect(120, 240)`, abrir panel, verificar que el panel tiene `style.top` con valor cercano a `120` y `style.left` con valor cercano a `240` — 15m — dep 2.2
- [ ] 2.4 **TEST RED** — `aria-expanded` en trigger: verificar `getByRole('button', { name: item.label })` tiene `aria-expanded="false"` inicial, `"true"` tras click — 10m — dep 2.3
- [ ] 2.5 **TEST RED** — `aria-label` en panel: abrir panel, verificar `getByRole('navigation', { name: 'Menú Clientes' })` (o el label del grupo de prueba) — 10m — dep 2.4
- [ ] 2.6 **TEST RED** — cierre por outside click: abrir panel, disparar `fireEvent.mousedown(document.body)`, verificar panel desmontado (`queryByRole('navigation')` es `null`) — 10m — dep 2.5
- [ ] 2.7 **TEST RED** — click dentro del panel no cierra: abrir panel, `userEvent.click` en un NavLink del panel, verificar panel seguía montado ANTES de la navegación (el `onClick` de `setOpen(false)` ocurre, pero el assert es pre-navegación — ajustar si es necesario) — 15m — dep 2.6
- [ ] 2.8 **TEST RED** — cierre al navegar (NavLink click): abrir panel, `userEvent.click` en un NavLink hijo, verificar panel desmontado — 10m — dep 2.7
- [ ] 2.9 **TEST RED** — Escape cierra el panel: abrir panel, `userEvent.keyboard('{Escape}')` con foco dentro del panel, verificar panel desmontado — 10m — dep 2.8
- [ ] 2.10 **TEST RED** — foco vuelve al trigger tras Escape: continuar test 2.9, verificar `document.activeElement === triggerButton` — 10m — dep 2.9
- [ ] 2.11 **TEST RED** — chevron tiene clase `chevronOpen` cuando open: verificar `getByText('›')` tiene clase `styles.chevronOpen` al abrir, no la tiene al cerrar — 10m — dep 2.10
- [ ] 2.12 **TEST RED** — reposicionamiento en scroll: abrir panel, `mockTriggerRect(200, 240)`, `fireEvent.scroll(window)`, verificar que el panel actualiza su `style.top` al nuevo valor — 15m — dep 2.11
- [ ] 2.13 Commit RED: `test(sidebar): RED tests for CollapsibleNavItem portal behavior` — (git) — 2m — dep 2.12

---

## Phase 3 — Implementación GREEN
> Checkpoint: `npx vitest run CollapsibleNavItem.test.tsx` → todos green. Suite completa sin regresión.
> Commit por step: una vez verdes todos los tests, commit final.

- [ ] 3.1 Agregar `import ReactDOM from 'react-dom'` y `import { useRef, useEffect, useCallback } from 'react'` a `Sidebar.tsx` (completar imports existentes) — `src/components/organisms/Sidebar/Sidebar.tsx` (Modify) — 5m — dep Phase 2
- [ ] 3.2 Extraer `NavPanel` como function component interno en `Sidebar.tsx`: recibe `items: SubItem[]`, `groupLabel: string`, `style: React.CSSProperties`, `onClose: () => void`, `onKeyDown: (e: React.KeyboardEvent) => void`; renderiza el `<div role="navigation" aria-label={...}>` con los NavLinks — 20m — dep 3.1
- [ ] 3.3 Refactorizar `CollapsibleNavItem`: agregar `triggerRef = useRef<HTMLButtonElement>(null)` y `panelStyle = useState<React.CSSProperties>({})` — 10m — dep 3.2
- [ ] 3.4 Implementar `getPortalStyle()`: llama `triggerRef.current?.getBoundingClientRect()`, retorna `{ position: 'fixed', top: rect.top, left: rect.right, zIndex: 9999, minWidth: 200 }` — 10m — dep 3.3
- [ ] 3.5 Implementar `useEffect` de posicionamiento inicial: cuando `open` pasa a `true`, llamar `setPanelStyle(getPortalStyle())` — 5m — dep 3.4
- [ ] 3.6 Implementar `useEffect` de scroll/resize con `requestAnimationFrame` throttle: escucha `scroll` (capture:true) y `resize`, llama `requestAnimationFrame(() => setPanelStyle(getPortalStyle()))` con flag `isScheduled` — 15m — dep 3.5
- [ ] 3.7 Implementar `useEffect` de outside click: `mousedown` en `document`, verifica que el target no está dentro del panel ni del trigger, si es así llama `setOpen(false)` — 15m — dep 3.6
- [ ] 3.8 Implementar `handleKeyDown`: si `e.key === 'Escape'`, llama `setOpen(false)` y `triggerRef.current?.focus()` — 10m — dep 3.7
- [ ] 3.9 Implementar foco inicial al abrir: `useEffect` que cuando `open === true` hace `firstLinkRef.current?.focus()` (agregar `firstLinkRef` al primer NavLink de `NavPanel`) — 15m — dep 3.8
- [ ] 3.10 Reemplazar el `{open && <div className={styles.navChildren}>...</div>}` por `{open && ReactDOM.createPortal(<NavPanel .../>, document.body)}` — 10m — dep 3.9
- [ ] 3.11 Agregar `ref={triggerRef}` al `<button>` del trigger — 2m — dep 3.10
- [ ] 3.12 Verificar: `npx vitest run src/__tests__/components/organisms/Sidebar/CollapsibleNavItem.test.tsx` → todos GREEN — (verificación) — 5m — dep 3.11
- [ ] 3.13 Verificar suite completa sin regresión: `npx vitest run` → 100% verde — (verificación) — 5m — dep 3.12
- [ ] 3.14 Commit GREEN: `feat(sidebar): migrate CollapsibleNavItem to createPortal with fixed positioning` — (git) — 2m — dep 3.13

---

## Phase 4 — CSS y polish visual
> Checkpoint: smoke visual — abrir sidebar en dev, verificar que el panel se posiciona correctamente y la transición es fluida.
> Commit: `style(sidebar): add navPanel CSS with opacity transition`

- [ ] 4.1 Agregar clase `.navPanel` en `Sidebar.module.css`: `position: fixed; z-index: 9999; min-width: 200px; background`, `border-radius: 8px`, `box-shadow`, `padding: 4px 0`, `opacity: 0`, `transform: translateX(-4px)`, `transition: opacity 0.15s ease-out, transform 0.15s ease-out`, `pointer-events: none` — `src/components/organisms/Sidebar/Sidebar.module.css` (Modify) — 15m — dep Phase 3
- [ ] 4.2 Agregar clase `.navPanelOpen`: `opacity: 1; transform: translateX(0); pointer-events: auto` — mismo archivo — 5m — dep 4.1
- [ ] 4.3 Aplicar `.navPanelOpen` al panel en `NavPanel` mediante prop `isOpen` o `data-open` attr, o agregando la clase al montarse (dado que el portal solo existe cuando `open === true`, aplicar siempre `.navPanelOpen` es suficiente para la transición de apertura) — `Sidebar.tsx` (Modify) — 10m — dep 4.2
- [ ] 4.4 Verificar que la clase `.navChildren` existente en `Sidebar.module.css` NO se usa ya en el portal (el portal usa `.navPanel` / `.navPanelOpen`). Eliminar o renombrar si queda huérfana — (verificación) — 5m — dep 4.3
- [ ] 4.5 Smoke visual: `npx vitest run` → verde. Smoke manual opcional (abrir en browser dev, verificar posición y transición) — (verificación) — 5m — dep 4.4
- [ ] 4.6 Commit: `style(sidebar): add navPanel CSS with opacity transition` — (git) — 2m — dep 4.5

---

## Phase 5 — Verificación final
> No genera commit. Gates de cierre del cambio.

- [ ] 5.1 `npx vitest run` → 100% verde (todos los tests existentes + nuevos de este change) — 5m
- [ ] 5.2 Verificar que `navChildren` en el DOM ya no está dentro del `<aside>` al abrir un grupo (inspección en test o browser DevTools) — 5m
- [ ] 5.3 Verificar `aria-expanded` correcto en todos los botones trigger (abrir/cerrar cada grupo y revisar atributo) — 5m
- [ ] 5.4 Verificar navegación con teclado: Tab hasta trigger → Enter abre panel → Tab navega hijos → Escape cierra y devuelve foco — 10m (smoke manual o test de a11y)
- [ ] 5.5 Verificar que permisos (`canSee`) siguen funcionando: grupos sin permiso no aparecen (test existente en `Sidebar.test.tsx` debe seguir verde) — 5m
- [ ] 5.6 Verificar sin regresión TypeScript: `npx tsc --noEmit` → 0 errores — 3m

---

## Task Count Summary

| Fase | Tasks | Estimación |
|------|-------|------------|
| Phase 1 — Infraestructura de tests | 5 | ~35m |
| Phase 2 — Tests RED | 13 | ~120m |
| Phase 3 — Implementación GREEN | 14 | ~130m |
| Phase 4 — CSS y polish visual | 6 | ~40m |
| Phase 5 — Verificación final | 6 | ~28m |
| **TOTAL** | **44** | **~353m** |

## Batch Checkpoints para sdd-apply

| Batch | Fases | Condición de entrada |
|-------|-------|----------------------|
| Batch A | Phase 1 | Sin prerequisito |
| Batch B | Phase 2 | Infraestructura de test lista, Vitest configurado |
| Batch C | Phase 3 | Tests RED escritos y fallando |
| Batch D | Phase 4 | Tests GREEN, suite completa verde |
| Batch E | Phase 5 | CSS aplicado, commits de implementación listos |

---
**Phase**: sdd-tasks
**Change**: menu-dropdown
**Project**: ipnext-frontend
**Artifact store**: hybrid
**Date**: 2026-05-30
