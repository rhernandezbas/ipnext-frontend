# Change 1 — Bulk composer polish (#4 variables + #5 modal de confirmación)

> EPIC Bulk v2 · quick wins · FE-puro · worktree `feat/bulk-composer-polish-fe`
> Fecha: 2026-07-14 · Modo: interactivo · TDD estricto (Vitest)

## Proposal (qué / por qué)

Dos mejoras al composer del Bulk (F2, en prod), pedidas por el usuario mirando el Bulk v1:

- **#5** — Al "Crear campaña" hoy se dispara `createAsync` DIRECTO, sin confirmar. Viola la regla
  innegociable de front (doble-confirmación con impacto explícito en acciones con costo). Se agrega
  un modal de confirmación con el RESUMEN de lo que se va a hacer.
- **#4** — El bloque "Variables del template" se ve confuso: repite el contexto truncado por variable,
  duplica el `{{N}}`, el highlight sale amarillo (mark nativo) y hay CSS muerto. Se rediseña.

## Design (decisiones)

### #5 — CreateCampaignConfirmModal (componente dedicado)
- **NO** se toca el `ConfirmModal` compartido (solo acepta `message: string`, no puede mostrar el
  desglose rico). **NO** se reusa el `PreviewModal` (está en prod, es solo-lectura, tiene tabla
  paginada) para no acoplar ni arriesgar lo que ya anda.
- Se crea `CreateCampaignConfirmModal.tsx` que **reusa el shell de a11y ya establecido** (patrón de
  `ConfirmModal`/`PreviewModal`: portal a `document.body`, focus-trap cíclico Tab/Shift+Tab, foco
  inicial + restauración, Esc/backdrop cierran, scroll-lock). NO se reinventa la accesibilidad.
- Contenido = resumen de impacto: **nombre de campaña + template (`friendlyName`) + total
  (`previewData.count`) + desglose por estado (`statusCounts` con `StatusBadge`) + excluidos
  (`skipped`)**. Todo de `previewData` (ya en memoria por el gate `canCreate`) → **cero fetch nuevo**.
- Copy claro: **"esto CREA la campaña, todavía NO se envía nada"** (crear la deja en `pending`; el
  envío es otro paso con su propia doble-confirmación). `tone=default` (crear no es destructivo).
- `CampaignComposer`: el click de "Crear campaña" abre el modal; el confirm del modal llama al
  `handleCreate` real. `busy` = `isCreating`.

### #4 — VariablesMapForm rediseñado
- **Mensaje completo del template UNA sola vez arriba** (todo el `body`, cada `{{N}}` resaltado en su
  lugar real con el token gris — reusar/adaptar `splitTemplateBody`, NO el `<mark>` pelado). El
  operador lee la frase entera como le llega al cliente.
- **Debajo, lista limpia de mapeo**: una fila por variable `{{N}} → [Select fuente]` (+ input si
  `literal`). Sin repetir el mensaje, sin fragmentos truncados con `…`, sin duplicar el `{{N}}`.
- **Borrar el CSS muerto** (`.select`, `.varLabel` — ya no los usa nadie, los reemplazó el molecule
  `Select`).
- Reglas de front: tokens `var(--color-*)` (hex/px NUNCA), contraste ≥4.5:1, focus-visible, el
  `Select` propio accesible, sin emojis como iconos, transiciones 150–300ms, `prefers-reduced-motion`.

## Spec / scenarios (TDD — el test PRIMERO)

### #5 modal (CampaignComposer + CreateCampaignConfirmModal)
- [ ] Click "Crear campaña" con todo válido → **NO** llama `createAsync`; abre el modal.
- [ ] El modal muestra: nombre de campaña + nombre del template + total + desglose por estado.
- [ ] Confirmar en el modal → llama `createAsync` con los args correctos (name/templateRef/
      templateName/segment/variablesMap) + cierra el modal.
- [ ] Cancelar / Esc / backdrop → **NO** llama `createAsync`, el estado del composer queda intacto,
      el modal cierra.
- [ ] El copy aclara que crea, NO envía.
- [ ] a11y: foco inicial dentro del diálogo, focus-trap, Esc cancela.
- [ ] `busy` refleja `isCreating` (botón confirmar deshabilitado mientras crea).

### #4 variables (VariablesMapForm)
- [ ] Renderiza el mensaje completo del template con cada `{{N}}` resaltado (token, no `<mark>` pelado).
- [ ] Una fila de mapeo por variable, con su `Select` (Nombre del cliente / Monto de deuda / Valor fijo).
- [ ] `literal` → muestra el input de valor fijo con su label sr-only.
- [ ] Missing variable (422) → resalta la fila + `role="alert"`.
- [ ] Sin repetición del contexto ni fragmentos truncados por variable.
- [ ] Sin referencias al CSS muerto (`.select`/`.varLabel` removidos).

## Tasks

- [ ] T1 — Tests de `CreateCampaignConfirmModal` (render del resumen, confirm/cancel, a11y). RED.
- [ ] T2 — `CreateCampaignConfirmModal.tsx` + `.module.css` (shell a11y reusado, resumen rico). GREEN.
- [ ] T3 — Tests de `CampaignComposer` (click abre modal / confirm llama createAsync / cancel no). RED.
- [ ] T4 — Wire en `CampaignComposer`: interceptar `handleCreate` con el modal. GREEN.
- [ ] T5 — Tests del rediseño de `VariablesMapForm` (mensaje completo + mapeo + missing + literal). RED.
- [ ] T6 — Rediseño `VariablesMapForm.tsx` + `.module.css` (borrar CSS muerto). GREEN.
- [ ] T7 — Gate: `vitest run` (suite completa) + `tsc --noEmit`, ambos verdes.
- [ ] T8 — Review adversarial (foco a11y/UX/motion + `review-animations` de Emil) → fix wave → re-review CLEAN.
- [ ] T9 — Playwright contra prod (crear campaña: aparece el modal con resumen; variables legibles).
- [ ] T10 — Push confirmado con el usuario + seguir el run en `gh` + sync `main` local FE.
```