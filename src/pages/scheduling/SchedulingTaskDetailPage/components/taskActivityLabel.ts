import type { ActivityDto } from '@/types/taskActivity';

function val(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function isDone(v: unknown): boolean {
  return typeof v === 'object' && v !== null && (v as { done?: unknown }).done === true;
}

/** FK change with resolved names in metadata (project/customer/reporter): "cambió X: A → B". */
function nameDiff(label: string, m: Record<string, unknown>): string {
  if (m.fromName !== undefined || m.toName !== undefined) {
    return `cambió ${label}: ${val(m.fromName)} → ${val(m.toName)}`;
  }
  return `cambió ${label}`;
}

/** FK change WITHOUT a resolvable name (contract/partner): describe by presence. */
function presenceDiff(noun: string, label: string, from: unknown, to: unknown): string {
  if (to == null) return `quitó ${label}`;
  if (from == null) return `asignó ${noun}`;
  return `cambió ${label}`;
}

/**
 * Human-readable, Spanish description of a task activity entry. Stage/category
 * style events surface the from→to values (using metadata labels when present).
 * Unknown future types fall back to a de-snake-cased label so the feed never breaks.
 */
export function describeActivity(a: ActivityDto): string {
  const m = a.metadata ?? {};
  switch (a.type) {
    case 'created': return 'creó la tarea';
    case 'stage_changed': return `movió de etapa: ${val(m.fromStageName ?? a.fromValue)} → ${val(m.toStageName ?? a.toValue)}`;
    case 'priority_changed': return `cambió la prioridad: ${val(a.fromValue)} → ${val(a.toValue)}`;
    case 'category_changed': return `cambió la categoría: ${val(a.fromValue)} → ${val(a.toValue)}`;
    case 'assigned': return 'asignó la tarea';
    case 'unassigned': return 'quitó la asignación';
    case 'reporter_changed': return nameDiff('el reportante', m);
    case 'customer_changed': return nameDiff('el cliente', m);
    case 'contract_changed': return presenceDiff('un contrato', 'el contrato', a.fromValue, a.toValue);
    case 'partner_changed': return presenceDiff('un partner', 'el partner', a.fromValue, a.toValue);
    case 'watcher_added': return 'agregó un observador';
    case 'watcher_removed': return 'quitó un observador';
    case 'commented': return 'comentó';
    case 'comment_deleted': return 'eliminó un comentario';
    case 'attachment_added': return 'adjuntó un archivo';
    case 'attachment_removed': return 'quitó un archivo';
    case 'status_changed': return a.toValue ? 'cerró la tarea' : 'reabrió la tarea';
    case 'due_date_changed': return `cambió la fecha (${val(m.field)})`;
    case 'description_changed': return 'editó la descripción';
    case 'project_changed': return nameDiff('el proyecto', m);
    case 'address_changed': return 'cambió la dirección';
    case 'estimated_hours_changed': return `cambió las horas estimadas: ${val(a.fromValue)} → ${val(a.toValue)}`;
    case 'travel_time_changed': return 'cambió el tiempo de viaje';
    case 'notes_changed': return 'editó las notas';
    case 'inventory_review_changed': return a.toValue ? 'marcó revisado por inventario' : 'desmarcó la revisión de inventario';
    case 'sent_to_iclass': return 'envió la tarea a IClass';
    case 'checklist_item_added': return 'agregó un ítem al checklist';
    case 'checklist_item_removed': return 'quitó un ítem del checklist';
    case 'checklist_item_toggled': return isDone(a.toValue) ? 'completó un ítem del checklist' : 'reabrió un ítem del checklist';
    case 'checklist_item_updated': return 'editó un ítem del checklist';
    case 'checklist_reordered': return 'reordenó el checklist';
    case 'checklist_template_assigned': return 'asignó una plantilla de checklist';
    case 'checklist_cleared': return 'vació el checklist';
    default: return a.type.replace(/_/g, ' ');
  }
}
