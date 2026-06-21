# Proposal: Pulido del editar del InternetPanel (auto-IP + Perfil redundante + Editar llamativo) — FE-puro

## Intent
Tres mejoras en la vista "PPPoE activo" del InternetPanel (ui-ux-pro-max):
1. **Auto-asignar IP** en el form de Editar (botón que trae una IP libre del router, reusando el allocator que ya usa el form de CREAR).
2. **Sacar el "Perfil" free-text** del Editar — es redundante y peligroso (el control "Velocidad" ya cambia el plan con una lista validada).
3. **Editar más explícito/llamativo** — hoy es un botón secundario discreto; hacerlo claro (ícono + estilo) para que se note.

## Why
- El operador edita la IP a mano (error-prone); el allocator ya existe (`GET /nas/:id/next-free-ip`) y el form de CREAR ya lo usa.
- Tener "Perfil" free-text + "Velocidad" dropdown que escriben el MISMO campo (`profile`) confunde y permite tipear un plan inválido.
- "Editar" pasa desapercibido.

## Scope (FE-puro — cero BE)

**Auto-asignar IP (reusa lo del form CREAR):**
- En el form de Editar de `ActivePppoeView`, junto al campo "IP remota": toggle Privada/Pública + botón "Auto-asignar" (o "cambiar") que llama `useNextFreeIp(pppoe.nasId, ipType)` y rellena la IP. Reusa `useNextFreeIp`, `ipFetchHint()` (ya en el archivo). Estado `ipAutoFilled` (no pisa edición manual). Mensajes de error (404 sin pool / 422 lleno / 502 router caído) ya mapeados por `ipFetchHint`.

**Sacar Perfil redundante:**
- Quitar el `<input>` free-text "Perfil" del form de Editar + el `editForm.profile` state + el diff `updateBody.profile`. El plan se cambia SOLO por "Velocidad". El Editar queda: Nueva contraseña, IP remota (+ auto), Router.

**Editar más llamativo:**
- El botón "Editar" (colapsado) pasa a ser claramente visible: ícono (lápiz SVG) + estilo de acción primaria/secundaria fuerte, no un link discreto. Buena affordance (cursor-pointer, focus-visible).

## Out of Scope
- Baja-terminar + caller-id (Change B, orchestrator+BE).

## Affected Areas
| Área | Impacto |
|------|---------|
| `src/pages/customers/tabs/contracts/InternetPanel.tsx` | Editar: auto-IP, sin Perfil, botón Editar llamativo |
| `src/pages/customers/tabs/contracts/InternetPanel.module.css` | Estilos del botón Editar + el row de auto-IP |
| (reusa) `useNextFreeIp`, `ipFetchHint`, `api.getNextFreeIp` | sin cambios |

## Risks
| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Sacar Perfil rompe el flujo de cambio de plan | Baja | La "Velocidad" ya cambia `profile`; tests FE |
| Auto-IP trae IP ocupada | Baja | El allocator ya excluye asignadas (radreply); 409 si choca |
| Reusar mal el hook de IP | Baja | Copiar el patrón EXACTO del form CREAR (mismo archivo) |

## Success Criteria
- [ ] Editar: botón "Auto-asignar IP" trae una libre del router y la rellena.
- [ ] El form de Editar ya NO tiene "Perfil" free-text (solo password/IP/router).
- [ ] El botón Editar es claramente visible (ícono + estilo).
- [ ] vitest verde + typecheck limpio; review GO.
