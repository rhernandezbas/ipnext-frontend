# Spec: TicketStatusesPage

## Requirements
1. Lists all ticket statuses ordered by weight (backend returns ordered)
2. Shows color swatch, name, weight, edit/delete actions per row
3. Create modal: name (required), color picker (default #3b82f6), weight (default = max+1)
4. Edit modal: pre-fills existing values
5. Delete: confirm dialog → DELETE /api/tickets/statuses/:id
   - 409 TICKET_STATUS_IN_USE → alert "No se puede eliminar: hay tickets que usan este estado."
   - Other error → generic alert
6. Create/Edit 409 TICKET_STATUS_NAME_CONFLICT → inline error in modal
7. Loading state: "Cargando…"
8. Empty state: "No hay estados. Creá el primero."

## Scenarios
- Given catalog has 3 statuses → table renders 3 rows
- Given user clicks Editar → modal opens with pre-filled name/color/weight
- Given user saves edit with duplicate name → inline error shown
- Given user deletes in-use status → alert with friendly message
