# Tech Debt — IPNext Frontend

Registro de deuda técnica conocida del frontend. Cada entrada tiene fecha, contexto y acción pendiente.

---

## ~~Scheduling — `scheduledDate` y `scheduledTime` no son `required` en el form~~ ✅ Resuelto 2026-05-14

**Fecha**: 2026-05-14
**Archivos a tocar**: `src/pages/empresa/SchedulingPage.tsx` (componente `TaskModal`, líneas ~186-194)

### Contexto

El endpoint `POST /api/scheduling` del backend valida con Zod (`CreateTaskSchema`) y exige:

```ts
scheduledDate: z.string().min(1),
scheduledTime: z.string().min(1),
title:         z.string().min(1),
```

El form del front (`TaskModal` en `SchedulingPage.tsx`) tiene esos inputs **sin `required`**, así que el usuario puede submitear con valores vacíos. Cuando eso pasa, el back devuelve `400 VALIDATION_ERROR` y la tarea **no se guarda**, pero el modal se cierra igual y el usuario no se entera.

Ejemplo real del log de nginx en prod (2026-05-14):
```
06:36:19 "POST /api/scheduling HTTP/1.1" 400 376
06:40:30 "POST /api/scheduling HTTP/1.1" 400 376
```

### Decisión

Mantener el back estricto — una "tarea agendada" sin fecha/hora no es una tarea, es una nota. El fix correcto va del lado del front: marcar los inputs como `required` para que el browser bloquee el submit hasta que estén completos.

### Acción pendiente

En `src/pages/empresa/SchedulingPage.tsx`, dentro del componente `TaskModal`:

- Agregar `required` al input `f-date` (línea ~187-188)
- Agregar `required` al input `f-time` (línea ~192-193)
- (Opcional pero recomendado) manejar el error 400 en `useCreateTask` y mostrar un toast/inline error al usuario cuando el back rechace el payload — hoy el modal se cierra silenciosamente.

### Riesgo si no se hace

- **UX rota**: el usuario llena el form, hace click en "Guardar", el modal se cierra, y la tarea nunca se guarda. No hay feedback visible del error.
- **Tareas perdidas**: el usuario cree que guardó y no lo hizo. Llama a soporte preguntando dónde está su tarea.
