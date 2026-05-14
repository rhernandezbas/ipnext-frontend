# Tech Debt — IPNext Frontend

Registro de deuda técnica conocida del frontend. Cada entrada tiene fecha, contexto y acción pendiente.

---

## Scheduling — manejar error 400 al crear tarea

**Fecha**: 2026-05-14
**Archivos a tocar**: `src/hooks/useScheduling.ts` (mutation `useCreateTask`), `src/pages/empresa/SchedulingPage.tsx` (componente `TaskModal`)

### Contexto

Cuando el back rechaza el payload con `400 VALIDATION_ERROR`, el modal se cierra silenciosamente y el usuario no se entera de que la tarea no se guardó. Esto puede pasar por cualquier campo que el back valide (no solo fecha/hora).

### Decisión

El back se afloja: `scheduledDate` y `scheduledTime` pasan a ser opcionales (ver `../ipnext-backend/md/SCHEDULING-OPTIONAL-DATETIME.md`). Una tarea puede crearse "pendiente de agendar" y completarse después.

Pero el front igual tiene que manejar errores 400 del back de forma robusta — no solo para fecha/hora.

### Acción pendiente

- Capturar el error en la mutation `useCreateTask`, NO cerrar el modal si hay error, y mostrar el mensaje del back (toast o inline) al usuario.
- Idealmente mapear los `details` del payload de error (Zod issues) a errores por campo.

### Riesgo si no se hace

- **UX rota**: el usuario hace click en "Guardar", el modal se cierra, y la tarea no se guarda sin feedback visible.

### Historial

- **2026-05-14**: Primero se agregó `required` a los inputs `f-date` y `f-time` (commit `9792859`) bajo la premisa de mantener el back estricto. Decisión revertida el mismo día — se prefiere flexibilidad: las tareas pueden existir sin agendar. Back y front se ajustaron en consecuencia.
