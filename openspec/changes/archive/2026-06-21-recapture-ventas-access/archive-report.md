# Archive Report — recapture-ventas-access (FE)

**Fecha:** 2026-06-21
**Estado:** ✅ COMPLETO Y EN PRODUCCIÓN
**Repo:** ipnext-frontend

## Qué se entregó
Dos bugs reportados por el usuario (agente de ventas con `recapture.read`+`manage`+rol `ventas`, SIN `clients.read`):

1. **Menú**: el grupo "Clientes" gateaba `clients.read` y ocultaba el grupo entero antes de mirar los hijos → ventas no veía Recaptación/Mis clientes ni la sección CRM. **Fix en Sidebar**: `canSeeChild` hereda el permiso del padre si el hijo no tiene propio (preserva el gating actual de Añadir/Lista/etc.); `canSee` de un grupo = visible si tiene ≥1 hijo visible. Ventas ve "Clientes" con SOLO Recaptación+Mis clientes, sin exponer nada gateado. Generaliza el comportamiento correcto (ej. `pppoe.cut` → ve "Gestión de red" con solo "Cortes PPPoE").
2. **Empty state**: `RecaptacionTableView` ramifica el vacío sin filtros por `canAssign` → admin ve "Ejecutá Ingestar bajas", agente ve "El administrador todavía no te asignó leads".

## Pipeline SDD aplicado
- proposal + design + spec + tasks.
- **verify** (typecheck + vitest, corrido por el orquestador): limpio + suite verde.
- **review adversarial** (foco navegación/seguridad — el Sidebar toca TODA la nav): **CLEAN, sin CRITICAL**. No-leak verificado (todos los grupos contenedores tienen `requiredPermission` → la herencia cierra; ningún ítem gateado queda expuesto). Sin regresión por rol. 1 WARNING pre-existente fuera de scope → backlog (link "Informes" sin permiso, ruta protegida).
- gate final: typecheck limpio + suite **3531/0**.

## Commits / Deploy
- Commit `a7c2244` (rebaseado a `44e1e76`) → deploy verde `27895120696`.

## Notas
- La RUTA ya estaba bien gateada (`recapture.read`, no anidada bajo `clients.read`); solo el menú tenía el muro del padre.
- Pendientes derivados (backlog): bug del estado que no refresca en el drawer de recaptación; "Informes" sin permiso en el sidebar.
