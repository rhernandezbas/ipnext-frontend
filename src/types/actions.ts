/**
 * actions-worklist (EPIC Titularidad & bajas F2) — tipos del wire contract
 * de `/api/actions`. Campo a campo contra el BE real (OwnershipCaseDto /
 * RecentBajaDto) — NO inventar campos.
 */

// ── Ownership cases ──────────────────────────────────────────────────────────

export type OwnershipCaseStatus = 'pending' | 'ambiguous' | 'done' | 'dismissed';

/**
 * Estado de un check AUTO computado en la lectura del BE.
 * `null` = no evaluable (ej. caso sin target) — el FE muestra "—".
 */
export type AutoCheckState = 'ok' | 'pending' | null;

export interface OwnershipCaseCandidate {
  contractId: string;
  clientId: string;
  clientName: string | null;
}

export interface OwnershipEquipmentCheck {
  sourceActive: number;
  /** null cuando el caso no tiene target (no evaluable). */
  targetActive: number | null;
  reviewed: boolean;
  reviewedAt: string | null;
  reviewedByName: string | null;
}

export interface OwnershipCaseChecks {
  tv: AutoCheckState;
  pppoe: AutoCheckState;
  equipment: OwnershipEquipmentCheck;
}

export interface OwnershipCaseDto {
  id: string;
  status: OwnershipCaseStatus;
  sourceContractId: string;
  sourceClientId: string;
  sourceClientName: string | null;
  motivoBaja: string;
  bajaDate: string | null;
  targetContractId: string | null;
  targetClientId: string | null;
  targetClientName: string | null;
  candidates: OwnershipCaseCandidate[] | null;
  dismissReason: string | null;
  checks: OwnershipCaseChecks;
  detectedAt: string;
  updatedAt: string;
}

/**
 * PATCH /actions/ownership-cases/:id — body con EXACTAMENTE UN discriminador.
 *
 * `{targetContractId}` — tres ramas en el BE:
 *   · ambiguous → pick por membership en `candidates`
 *   · pending CON candidates → RE-pick por membership (corrige la elección)
 *   · pending SIN target NI candidates → SET-target validado contra el mirror
 *     (el contrato existe / no está en baja / pertenece a OTRO cliente)
 * `{status:'pending'}` — reopen SOLO desde dismissed; si el caso tenía
 *   candidates vuelve a `ambiguous` Y el target heredado se limpia.
 *
 * Errores: 404 OWNERSHIP_CASE_NOT_FOUND · 422 INVALID_CANDIDATE_PICK /
 * INVALID_TARGET_ASSIGNMENT / INVALID_CASE_TRANSITION · 400
 * DISMISS_REASON_REQUIRED / validación.
 */
export type UpdateOwnershipCaseBody =
  | { equipmentReviewed: boolean }
  | { targetContractId: string }
  | { status: 'dismissed'; reason: string }
  | { status: 'pending' };

/**
 * Respuesta REAL del PATCH: el BE devuelve la ENTIDAD de dominio cruda
 * (OwnershipTransferCase), NO el DTO de lectura enriquecido — sin `checks`,
 * sin `*ClientName`, candidates sin `clientName`, y el rastro del check
 * manual plano (`equipmentReviewedById/At`). La mutación del FE descarta
 * este body e invalida ['actions'] para re-leer el DTO completo; este tipo
 * existe para que el contrato no mienta.
 */
export interface OwnershipCaseMutationResult {
  id: string;
  status: OwnershipCaseStatus;
  sourceContractId: string;
  sourceClientId: string;
  motivoBaja: string;
  bajaDate: string | null;
  targetContractId: string | null;
  targetClientId: string | null;
  candidates: Array<{ contractId: string; clientId: string }> | null;
  dismissReason: string | null;
  equipmentReviewed: boolean;
  equipmentReviewedById: string | null;
  equipmentReviewedAt: string | null;
  detectedAt: string;
  updatedAt: string;
}

export interface OwnershipCasesQuery {
  status?: OwnershipCaseStatus;
  page?: number;
  pageSize?: number;
}

// ── Recent bajas ─────────────────────────────────────────────────────────────

export interface RecentBajaDto {
  contractId: string;
  clientId: string;
  clientName: string | null;
  address: string | null;
  startDate: string;
  motivoBaja: string | null;
  retirementOrder: { exists: boolean; taskId?: string };
  activeEquipmentCount: number;
  // NOTA: NO hay fecha de baja en el DTO — limitación aceptada del mirror.
}

export interface RecentBajasQuery {
  page?: number;
  pageSize?: number;
}

// ── Paginación compartida del router /api/actions ────────────────────────────

export interface ActionsPaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Labels ───────────────────────────────────────────────────────────────────

export const OWNERSHIP_CASE_STATUS_LABELS: Record<OwnershipCaseStatus, string> = {
  pending: 'Pendiente',
  ambiguous: 'Ambiguo',
  done: 'Completado',
  dismissed: 'Descartado',
};
