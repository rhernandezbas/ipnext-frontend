# Spec: Rename sidebar group "WhatsApp" → "Comunicaciones"

## Requirements
1. El grupo de `CRM_ITEMS` que antes tenía `label:'WhatsApp'` debe tener `label:'Comunicaciones'`.
2. `matchPaths` (`['/admin/whatsapp']`) y `requiredPermission` (`messaging.read`) del grupo no
   cambian.
3. Los children del grupo (labels y `to`) no cambian: "Bandeja de entrada" (`/admin/whatsapp`),
   "Configuración" (`/admin/whatsapp/settings`), "Envío masivo" (`/admin/whatsapp/bulk`, gate propio
   `messaging.bulk`), "Templates" (`/admin/whatsapp/templates`, gate propio `messaging.templates`).
4. Ninguna ruta de `App.tsx` bajo `/admin/whatsapp/*` cambia.

## Scenarios
- Given un usuario con permiso `messaging.read` → el sidebar muestra un botón "Comunicaciones" (no
  "WhatsApp") dentro de la sección CRM.
- Given el grupo "Comunicaciones" abierto → sus children siguen linkeando a las mismas rutas que
  antes del rename (`/admin/whatsapp`, `/admin/whatsapp/settings`, `/admin/whatsapp/bulk`,
  `/admin/whatsapp/templates`).
- Given un usuario sin `messaging.read` → el grupo "Comunicaciones" no se renderiza (igual que antes
  con "WhatsApp"), el resto de CRM sigue visible.
- Given `isLoading=true` en `useMyPermissions` → el grupo "Comunicaciones" se renderiza (no hay
  layout shift), igual que el comportamiento previo de "WhatsApp".
