# PERF — Suite de tests FE: jsdom → happy-dom

> Pedido del usuario "optimizar el build". FE-puro (config de test). Worktree perf-happydom-fe.
> MEDIDO: Duration 670s→384s (−43%); environment 2810s→1082s (era el cuello). El deploy no era el problema (56s, no corre tests).
> Review adversarial OBLIGATORIO — toca la config de test de TODO el FE.

## Estado del worktree (ya hecho en el experimento)
- happy-dom instalado (devDep en package.json del worktree).
- vite.config.ts → `environment: 'happy-dom'` (ya cambiado).
- 20 tests rompen (baseline del experimento).

## Los 20 fails (2 patrones a arreglar)
**Patrón 1 — `window.alert` (~8 tests, TRIVIAL):** happy-dom no implementa `window.alert`. Tests con `vi.spyOn(window, 'alert')` tiran "can only spy on a function. Received undefined". Archivos: `TicketStatusesBody`, `TicketAreasBody`, `VehiclesBody`, `MaterialsBody`, `DeviceTypesBody`, `ServiceTechnologiesPage`.
→ **Fix: polyfill global en `src/test/setup.ts`** — definir `window.alert`/`confirm`/`prompt` como funciones (ej. `window.alert = () => {}` o `vi.fn()` según lo que los tests esperen espiar). Ojo: si el test hace `vi.spyOn(window,'alert')`, el polyfill debe existir ANTES (una función real), no ser undefined.

**Patrón 2 — `<select>` NATIVOS (~12 tests):** happy-dom maneja el `<select>` nativo (change event / value) distinto que jsdom. Archivos: `IClassSoTypesCatalogBody`, `IClassResultCodeMappingBody`, `IClassProjectMappingBody`, `DatosForm.iclassCity`, `TasksTableView.stageSelect`, `PlansPage`.
→ **Fix: ajustar la INTERACCIÓN del test con el `<select>`** (ej. `fireEvent.change` con el value correcto vs `userEvent.selectOptions`, o esperar el commit de React) para que happy-dom lo procese. **NO migrar los componentes al Select propio** (eso es deuda aparte, change separado). Investigá el error real de cada uno (puede ser el value que no se refleja, o el onChange que no dispara).

## Tasks
- [ ] T1 — Polyfill `window.alert`/`confirm`/`prompt` en `src/test/setup.ts` → correr los 6 archivos del patrón 1, confirmar verdes.
- [ ] T2 — Fix de los ~12 tests del patrón 2 (`<select>` nativo). Investigar el error real de cada uno; ajustar SOLO el test (no el componente). Confirmar verdes.
- [ ] T3 — Correr la SUITE COMPLETA (`npx vitest run`) → 0 fails + anotar la Duration (esperado ~384s).
- [ ] T4 — `npx tsc --noEmit` limpio.
- [ ] (orquestador) review adversarial + verify + push confirmado.

## Reglas
- SOLO tocar: `vite.config.ts` (ya), `package.json` (happy-dom devDep, ya), `src/test/setup.ts` (polyfills), y los archivos de TEST del patrón 2. NO tocar componentes de producción. NO commitear.
