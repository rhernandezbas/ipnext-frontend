# Proposal: FE — mostrar caller-id (MAC) en el panel + hint de baja=terminar

## Intent
Cerrar Change B en el FE: mostrar el **caller-id (MAC del dispositivo conectado)** en los detalles del PPPoE activo, y reflejar que "Dar de baja" ahora **borra del RADIUS + libera la IP** (el BE ya cambió).

## Scope (FE-puro — BE+ORCH ya deployados)
1. **Caller-id**: hook `usePppoeCallerId(pppoeId)` → `GET /api/pppoe/:id/caller-id` → `{ callerId: string | null }` (lazy, se llama al mostrar el PPPoE activo). Mostrar "Caller-ID (MAC)" en el `<dl>` de detalles (después de IP remota). Estados: cargando ("…"), null/sin sesión ("— sin sesión activa"), error (silencioso → "—"). No bloquear el panel si falla.
2. **Hint de baja**: el texto del "Dar de baja PPPoE" (y/o el modal de motivo) pasa a aclarar que **borra el usuario del RADIUS y libera la IP** (irreversible) — antes decía "corta el servicio". El flujo no cambia (misma ruta, ya pide motivo).

## Out of Scope
- BE/ORCH (ya hechos). El cambio de la baja a terminar es server-side (mismo endpoint).

## Affected Areas
| Área | Impacto |
|------|---------|
| `src/api/pppoe.api.ts` (o donde viva) | +`getCallerId(id)` |
| `src/hooks/...` | +`usePppoeCallerId` |
| `src/pages/customers/tabs/contracts/InternetPanel.tsx` | mostrar caller-id en el `<dl>`; ajustar hint de baja |

## Risks
| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| caller-id endpoint 403/500 | Baja | degradar a "—", no romper el panel |
| El PPPoE sin sesión activa | Alta (normal) | mostrar "— sin sesión activa", no es error |

## Success Criteria
- [ ] El panel muestra el Caller-ID (MAC) de la sesión activa (o "— sin sesión activa").
- [ ] El hint de baja aclara que borra del RADIUS + libera IP.
- [ ] vitest verde + typecheck limpio; review GO.
