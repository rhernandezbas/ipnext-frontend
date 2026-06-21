# Archive Report — recapture-drawer-live (FE)

**Fecha:** 2026-06-21
**Estado:** ✅ COMPLETO Y EN PRODUCCIÓN
**Repo:** ipnext-frontend

## Qué se entregó
Fix del bug reportado: en el drawer de detalle de lead de Recaptación, al cambiar el ESTADO se guardaba pero el modal no se actualizaba hasta cerrar/reabrir (en la lista sí).

- **Causa**: el drawer renderizaba desde el prop `lead` (snapshot congelado de `selectedLead` en RecaptacionPage), no desde `detail` (`useRecaptacionLead`, que SÍ se re-fetchea — `useUpdateLeadStatus` ya invalidaba el detalle).
- **Fix**: `const view = detail ?? lead` (tras el guard); todos los campos de display (status pill+select, assigneeId/assigneeName, claimedAt, phone, email, source, createdAt, contactName, clientId) renderizan desde `view`. La `id`, las mutations y el guard quedan en `lead`. `RecaptureLeadDetailDto extends RecaptureLeadDto` → type-safe (detail solo agrega `contacts`).
- **De yapa**: también refresca al instante al cambiar el operador desde el drawer (mismo mecanismo).

## Pipeline SDD aplicado
- proposal + design + spec + tasks.
- **verify** (typecheck + vitest, corrido por el orquestador): limpio. Suite verde — los 12 "errors" de una corrida fueron timeouts de worker por saturación de máquina (turno con muchas corridas paralelas); los 15 archivos afectados se re-corrieron aislados → 121/0. Cero regresiones.
- **review adversarial**: CLEAN, sin hallazgos — el revisor revirtió el fix y confirmó RED (los tests fallan sin él). Todos los campos de display en `view`, lo correcto en `lead`, fallback (detail undefined → lead) sin romper.
- gate final: typecheck limpio + suite verde.

## Commits / Deploy
- Commit `880eabe` → deploy verde `27896539460`.

## Notas
- La invalidación de queries ya estaba bien (no se tocó); el bug era 100% de render (prop vs query).
