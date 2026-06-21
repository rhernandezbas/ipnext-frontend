# Tasks: Rediseño InternetPanel + cambiar velocidad (FE-puro)

> TDD estricto. Worktree `feat/internetpanel-redesign` (panel-fe). Skill ui-ux-pro-max.

## Cambiar velocidad
- [ ] **(test primero)** control de velocidad: dropdown con planes (enabled, no-Corte) pre-seleccionado en el `profile` actual; "Aplicar" → `update` con `{profile: code}`; si no hay planes/error → no se rompe (degrada).
- [ ] Reusar `usePlans()` (filtrar `status==='enabled' && category!=='Corte'`).
- [ ] Control inline (FUERA del form de Editar) en el grupo "Modificar": `<select>` + "Aplicar" (deshabilitado si no cambió) + estado de carga + error. Gate `pppoe.manage`. Degradar si vacío/403.

## Rediseño (ui-ux-pro-max, tokens globales)
- [ ] **(test primero)** las 3 acciones existentes (Reducir/Cortar/Restaurar, Desasociar, Dar de baja) siguen presentes y disparan su flujo tras la reorg.
- [ ] Reagrupar en 3 secciones con encabezado: **Modificar** (Editar + Cambiar velocidad), **Control de servicio** (Reducir/Cortar/Restaurar), **Ciclo de vida** (Desasociar + Dar de baja).
- [ ] Jerarquía: badge de estado prominente, data en grid legible, acciones separadas por severidad (secundarias vs destructivas, los destructivos no mezclados con los normales).
- [ ] A11y/CSS (`.module.css`, tokens globales): cursor-pointer, :focus-visible, transiciones 150–300ms, prefers-reduced-motion, responsive; SVG (sin emojis). Opcional: tokenizar los hex de los badges.

## Verificación
- [ ] vitest verde (los tests existentes del InternetPanel + los nuevos) + typecheck limpio.
- [ ] Review adversarial (obligatorio): foco en degradación de planes + que ningún botón/flujo se rompió + a11y.

## Post-deploy
- [ ] Playwright en vivo: abrir el panel → ver los grupos limpios → cambiar velocidad (dropdown → Aplicar → el perfil cambia). Sin ensuciar un cliente real (restaurar el plan original al final).

## Salida
- [ ] Panel rediseñado + cambiar velocidad por dropdown, en prod, verificado.
