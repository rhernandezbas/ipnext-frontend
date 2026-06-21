# Proposal: Rediseño del panel "PPPoE activo" + cambiar velocidad (FE-puro)

## Intent

Rediseñar la vista "PPPoE activo" del `InternetPanel` (UX/ui-ux-pro-max) y agregar un control de **cambiar velocidad** (plan) — hoy las acciones están dispersas (Desasociar arriba, Reducir/Cortar al medio, Dar de baja abajo) y no hay forma directa de cambiar la velocidad sin entrar al form de Editar (que pisa password/IP).

## Why

- El operador necesita **cambiar la velocidad** de un cliente fácil (ahora que el rate-limit está centralizado en RADIUS, cambiar el plan = cambiar la velocidad). Hoy solo se puede vía Editar (free-text del perfil, riesgoso).
- Las acciones del panel están desordenadas → confunde. Agruparlas por intención mejora la operación.

## Scope

### In Scope (FE-puro — cero BE)

**Cambiar velocidad:**
- Control dedicado (inline, FUERA del form de Editar): `<select>` de planes + botón "Aplicar".
- Fuente: `usePlans()` (ya existe) → `GET /api/plans` → `PlanDto`. Filtrar `status==='enabled' && category!=='Corte'`. `<option value={plan.code}>` (= el `profile`), label `name — rateLimit`. Pre-seleccionar el `profile` actual.
- "Aplicar" → `update.mutateAsync({ id, body: { profile: code } })` (el `PATCH /api/pppoe/:id` ya rutea a `orchestrator.changePlan`). Confirmación + estado de carga + error.
- **Degradación**: si `usePlans` falla/vacío (ej. operador sin `plan.read`) → ocultar el dropdown y dejar el perfil visible (no romper). Gateado `pppoe.manage`.

**Rediseño (ui-ux-pro-max, tokens globales):**
- Reagrupar las acciones en 3 bloques con encabezado:
  - **Modificar** (`pppoe.manage`): Editar · Cambiar velocidad.
  - **Control de servicio** (`pppoe.cut`): Reducir · Cortar · Restaurar (adaptativo, ya existe).
  - **Ciclo de vida**: Desasociar (`pppoe.manage`) · Dar de baja PPPoE (`pppoe.cut`).
- Jerarquía limpia: status badge prominente, data en grid legible, acciones agrupadas y separadas por severidad (secundarias vs destructivas).
- Checklist a11y: cursor-pointer, :focus-visible, transiciones 150–300ms, prefers-reduced-motion, responsive, SVG (sin emojis). Mantener tokens globales (`--space/--color/--radius/--font`); opcional: tokenizar los hex de los badges.

### Out of Scope
- BE (el cambio de plan ya funciona end-to-end). El form de Editar (password/IP/router) se mantiene; solo se le saca el perfil free-text (pasa al control de velocidad) — o se deja pero la velocidad es el camino primario.

## Capabilities
### Modified Capabilities
- InternetPanel: UX reorganizado + cambiar velocidad por dropdown.

## Approach
1. FE: control de velocidad (usePlans + select + aplicar). TDD.
2. FE: reorganización visual de las acciones en 3 grupos + a11y. TDD (los botones siguen funcionando).

## Affected Areas
| Área | Impacto |
|------|---------|
| `src/pages/customers/tabs/contracts/InternetPanel.tsx` | Rediseño de `ActivePppoeView` + control de velocidad |
| `src/pages/customers/tabs/contracts/InternetPanel.module.css` | Grupos de acciones, jerarquía, a11y |
| (reusa) `src/hooks/usePlans.ts`, `src/api/plans.api.ts`, `src/types/plans.ts` | Fuente de planes (sin cambios) |

## Risks
| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| `usePlans` 403 (operador sin `plan.read`) | Media | Degradar: ocultar dropdown, mostrar perfil actual; gate pppoe.manage. (Follow-up: alinear permisos) |
| Romper los botones existentes al reorganizar | Media | Tests FE: cada acción sigue disparando su flujo; mantener los handlers |
| Cambiar plan a un código inválido | Baja | El dropdown solo ofrece planes `enabled` reales; el BE valida |

## Rollback
FE-puro, aditivo + reorg. Rollback = `git revert`.

## Dependencies
- `usePlans`/`GET /api/plans` (en prod). `PATCH /api/pppoe/:id {profile}` (en prod). Enforcement/baja/desasociar (en prod).

## Success Criteria
- [ ] Control "Cambiar velocidad": dropdown de planes (enabled, no-Corte) → Aplicar → cambia el plan (verificado: el perfil se actualiza).
- [ ] Acciones agrupadas (Modificar / Control de servicio / Ciclo de vida), jerarquía limpia.
- [ ] Degradación si no hay planes/permiso.
- [ ] vitest verde + typecheck limpio; review GO; verificación visual Playwright.
