# Change 3 (FE) — Page de gestión de templates WhatsApp

> EPIC Bulk v2 · mergea PRIMERO · el BE ya está (contrato abajo) · TDD estricto (Vitest) · FE-puro

## Contrato BE (ya implementado y verde — consumilo tal cual)
Base `/api/messaging/templates`. RBAC: read=`messaging.templates`, write(create/submit/delete)=`messaging.bulk`.
| Método | Path | Body | Respuesta | Envelope |
|---|---|---|---|---|
| GET | `/templates` | — | lista de templates | **`{data:[...]}`** (unwrap `.data.data`) |
| GET | `/templates/:sid` | — | `TemplateDetailDto` | **pelado** (sin {data}) |
| POST | `/templates` | `CreateTemplateInput` | `TemplateDetailDto` | **pelado** |
| POST | `/templates/:sid/submit` | `{name, category}` | `{contentSid, submitted}` | pelado |
| DELETE | `/templates/:sid` | — | — | **204 No Content** |

**DTOs:**
- `TemplateDetailDto`: `{ contentSid, friendlyName, language, variables: string[] (keys), approvalStatus: 'approved'|'pending'|'rejected'|'unsubmitted', category, sendable: boolean, body: string }`
- `CreateTemplateInput`: `{ friendlyName, language, category: 'UTILITY'|'MARKETING'|'AUTHENTICATION', body, variables: string[] }`

**Errores (mapear a UI):**
- 400 `VALIDATION_ERROR` — input inválido (body vacío, category fuera de enum).
- 422 — provider (Twilio) rechazó.
- 503 — provider no disponible (reintentar).
- 404 `TEMPLATE_NOT_FOUND`.
- **409 `TEMPLATE_IN_USE`** — al borrar un template usado por campañas activas. **El body trae `campaignIds: string[]`** → mostrar CUÁLES campañas bloquean el borrado.

**Meta NO deja editar submitted/aprobado** → "editar aprobado" = **Clonar** (crear uno nuevo con el body modificado + re-submit).

## FE — approach (reglas INNEGOCIABLES: Select propio, tokens, a11y, ui-ux-pro-max + Emil motion)
- **Page nueva** `src/pages/whatsapp/WhatsappTemplatesPage/` (hermana de BulkMessagingPage/WhatsappInboxPage/WhatsappSettingsPage).
  - **Listar** con `DataTable` (`components/organisms/DataTable/DataTable.tsx`): columnas friendlyName / language / category / **status Meta** / acciones.
  - **Status Meta** con `StatusBadge` (`components/atoms/StatusBadge/StatusBadge.tsx`) + label override: approved→verde "Aprobado", pending→ámbar "Pendiente", rejected→rojo "Rechazado", unsubmitted→gris "Borrador". Indicador NO-solo-color (label textual).
  - **Crear**: form con friendlyName + body (textarea con preview de `{{1}}` resaltado) + `variables` + `category` con el **`Select` propio** (`components/molecules/Select/Select.tsx`, NUNCA `<select>` nativo). Validación cliente (body no vacío, category elegida).
  - **Submit-for-approval**: `ConfirmModal` — pide `name` (o autogenera del friendlyName) + category → `POST /:sid/submit`.
  - **Borrar**: `ConfirmModal` `tone="danger"` con impacto explícito ("esto lo borra TAMBIÉN de WhatsApp/Meta, irreversible ~24-48h para re-crear"). Si el BE devuelve **409 TEMPLATE_IN_USE**, mostrar las campañas (campaignIds) que lo bloquean — NO borrar.
  - **Clonar** (para "editar aprobado"): abre el form de crear pre-cargado con el body del template + aclaración de que genera versión nueva + re-submit.
- **API** `src/api/messagingTemplates.api.ts` NUEVO (o extender messagingBulk.api.ts). OJO envelopes por-endpoint (tabla arriba).
- **Hooks** `src/hooks/useTemplatesAdmin.ts` (o extender useBulkMessaging): `useCreateTemplate`/`useSubmitTemplate`/`useDeleteTemplate` (mutations con invalidate de la key de templates). Reusar `useTemplates(enabled)` para el listado.
- **Types** extender `src/types/messagingBulk.ts` (o messagingTemplates.ts).
- **Sidebar** `components/organisms/Sidebar/Sidebar.tsx`: child bajo "WhatsApp" `{ to:'/admin/whatsapp/templates', label:'Templates', requiredPermission:'messaging.templates' }`.
- **Ruta** `App.tsx` bajo `whatsapp`: `<Route path="templates" element={<RequirePermission permission="messaging.templates"><WhatsappTemplatesPage/></RequirePermission>}/>` + lazy import.
- **Gates de escritura**: los botones crear/submit/borrar gateados con `<Can permission="messaging.bulk">`.

## Scenarios (TDD — test primero, Vitest + Testing Library)
- Lista: renderiza templates con su status Meta (badge + label, no-solo-color); loading (skeleton) / empty (CTA crear) / error (role=alert + reintento).
- Crear: form valida (body vacío / category sin elegir → deshabilita o error); submit exitoso invalida la lista + toast; error 400/422 → mensaje visible (role=alert).
- Borrar: ConfirmModal danger + impacto; 409 TEMPLATE_IN_USE → muestra las campañas (campaignIds), NO cierra como éxito; éxito → quita de la lista.
- Submit-for-approval: modal → POST → status pasa a "Pendiente".
- Select propio (no nativo) para category. Contraste ≥4.5:1 en badges. Focus-visible, 44px, focus-trap en modales.
- Envelopes: la api desenvuelve `.data.data` en el list y pelado en get/create (round-trip test del cliente).

## Tasks
- [ ] T1 tests + api client (envelopes por-endpoint) + types. RED→GREEN.
- [ ] T2 tests + hooks (create/submit/delete + invalidate). RED→GREEN.
- [ ] T3 tests + WhatsappTemplatesPage: lista + status Meta + 4 ramas de estado. RED→GREEN. (ui-ux-pro-max anclado primero.)
- [ ] T4 tests + crear (form + Select propio + validación + preview). RED→GREEN.
- [ ] T5 tests + submit + borrar (ConfirmModal danger + 409 campaignIds) + clonar. RED→GREEN.
- [ ] T6 Sidebar + ruta (RequirePermission) + Can en botones de escritura.
- [ ] T7 gate: `vitest run` archivos del change + `tsc --noEmit`. NO commitear.
```