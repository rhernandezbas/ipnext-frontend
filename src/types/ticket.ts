/**
 * Ticket status is catalog-driven (TicketStatus catalog) so it can be any slug
 * the operator defines. The four legacy built-ins are kept in
 * {@link LEGACY_TICKET_STATUSES} for the hardcoded transition fallbacks.
 */
export type TicketStatus = string;

/** The four built-in ticket statuses that predate the catalog. */
export const LEGACY_TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

/** A ScheduledTask created from this ticket — surfaced in the Relacionado tab.
 *  Comes from the enriched GET /tickets/:id payload (#44). */
export interface RelatedTask {
  id: string;
  sequenceNumber: number;
  title: string;
}

export interface Ticket {
  id: string;                    // #44 — was number; the BE id is a UUID
  sequenceNumber: number;        // #11 — monotonic display number (#N), like tasks
  subject: string;
  description: string;           // #28 follow-up — the BE field is `description`, not `message`
  status: TicketStatus;
  priority: TicketPriority;
  /** @deprecated #78 — campo MUERTO: el BE nunca lo popula (no existe en la
   *  entity Ticket, el TicketDto ni el modelo Prisma). La columna 'Tipo' del
   *  listado se eliminó. Se conserva el campo opcional sólo por compat de mocks. */
  type?: string | null;
  customerId: string;
  customerName: string;
  // El BE expone contractId en TicketDto (el contrato es obligatorio al crear el
  // ticket). null para tickets legacy creados antes de la regla del contrato.
  contractId: string | null;
  // #28 follow-up — the BE returns `assigneeId` (RbacUser id, string) and
  // `assigneeName`; the legacy `assignedTo:number`/`assignedToName` never existed
  // in the real payload, so assignment rendered empty everywhere.
  assigneeId: string | null;
  assigneeName: string | null;
  // #48 — quien creo el ticket. reporterName es JOIN-derived (RbacUser.name) del BE.
  // `reporter` (solo nombre) queda DEPRECADO en favor de reporterName.
  reporterId: string | null;
  reporterName: string | null;
  /** @deprecated #48 — usar reporterName. Conservado por compat hasta confirmar consumidores. */
  reporter: string | null;
  // #49 — area de soporte del ticket.
  areaId: string | null;
  areaName: string | null;
  // #69 — color del catalogo de areas, para la pill en el listado.
  areaColor: string | null;
  /** ScheduledTasks created from this ticket (#44 — enriched GET /tickets/:id). */
  tasks?: RelatedTask[];
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  archivedAt: string | null;
  tags: string[];
}

export interface TicketStats {
  open: number;
  pending: number;
  resolved: number;
  closed: number;
  total: number;
  avgResolutionTimeHours: number;
  closedToday: number;
  avgResolutionTime: string;
  unassigned: number;
}

// #28 follow-up — wire shape of POST /tickets: the BE requires `description`
// (400 without it) and reads `assigneeId` (RbacUser id string).
// #49 — areaId is REQUIRED per the BE contract (422 TICKET_AREA_REQUIRED if missing).
export interface CreateTicketData {
  subject: string;
  description: string;
  priority: TicketPriority;
  customerId: string | null;
  // contractId is REQUIRED by the BE (POST /tickets → 400 if missing, 422 if it
  // doesn't exist or doesn't belong to the customer). The FE picks it from the
  // selected client's contracts (AD-2: tickets have no implicit contract).
  contractId: string | null;
  assigneeId?: string;
  areaId: string;
  tags?: string[];
}
