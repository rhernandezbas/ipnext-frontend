import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Can } from '@/components/auth/Can';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { ServiceRemovalReasonModal } from '@/components/molecules/ServiceRemovalReasonModal/ServiceRemovalReasonModal';
import { TransferServiceModal } from '@/components/molecules/TransferServiceModal/TransferServiceModal';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useUpdateOwnershipCase } from '@/hooks/useActions';
import { formatDateShort } from '@/utils/formatDate';
import {
  OWNERSHIP_CASE_STATUS_LABELS,
  type OwnershipCaseDto,
  type OwnershipCaseStatus,
  type UpdateOwnershipCaseBody,
} from '@/types/actions';
import { AssignTargetPanel } from './AssignTargetPanel';
import { CaseChecklist } from './CaseChecklist';
import styles from './CaseCard.module.css';

/**
 * CaseCard — un caso de cambio de titularidad con su checklist y acciones.
 *
 * - Checks AUTO read-only + check manual (CaseChecklist; read-only en casos
 *   cerrados — done/dismissed).
 * - 1-click "Transferir TV": reusa TransferServiceModal (endpoint F1, guard
 *   tv:transfer en el BE) con el destino del caso precargado → arranca en
 *   la confirmación. Al cerrar, invalida ['actions'] para re-leer los checks.
 *   Solo visible con tv PENDIENTE (null = no aplica), caso abierto y destino.
 * - Ambiguo: pick de candidato (PATCH {targetContractId}) gateado actions.manage.
 *   En pending CON candidates el mismo picker permite RE-pick ("Cambiar destino")
 *   con el candidato actual marcado.
 * - Pending SIN target NI candidates: "Asignar destino" (AssignTargetPanel) →
 *   PATCH {targetContractId} validado contra el mirror en el BE.
 * - Descartar (motivo obligatorio) / Reabrir — gateados actions.manage.
 */

/** Variante visual del StatusBadge por estado del caso (label en español). */
const STATUS_VARIANT: Record<OwnershipCaseStatus, 'active' | 'late' | 'blocked' | 'inactive'> = {
  pending: 'late',
  ambiguous: 'blocked',
  done: 'active',
  dismissed: 'inactive',
};

/** Errores tipados del PATCH /actions/ownership-cases/:id → mensaje curado. */
function mapActionsError(err: unknown): string {
  const e = err as {
    response?: { data?: { code?: string; error?: string; message?: string } };
  };
  const code = e?.response?.data?.code ?? null;
  const message = e?.response?.data?.error ?? e?.response?.data?.message ?? null;
  switch (code) {
    case 'INVALID_CANDIDATE_PICK':
      return 'El candidato elegido no es válido para este caso. Actualizá la lista y volvé a intentar.';
    case 'INVALID_TARGET_ASSIGNMENT':
      return 'Ese contrato no puede ser el destino: no existe, está de baja o pertenece al mismo cliente.';
    case 'INVALID_CASE_TRANSITION':
      return 'El caso cambió de estado y esa transición ya no es válida. Actualizá la lista.';
    case 'OWNERSHIP_CASE_NOT_FOUND':
      return 'El caso ya no existe. Actualizá la lista.';
    case 'DISMISS_REASON_REQUIRED':
      return 'El motivo del descarte es obligatorio.';
    default:
      return message ?? 'No se pudo actualizar el caso. Reintentá.';
  }
}

interface CaseCardProps {
  caso: OwnershipCaseDto;
}

/**
 * El bajaDate viene del raw de GR como dd-mm-yyyy (no ISO): se convierte antes
 * de pasar por la util canónica — `new Date('01-07-2026')` parsearía MM-DD.
 * Cualquier otro shape va directo a formatDateShort (ISO ok, basura → "—").
 */
function formatBajaDate(raw: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  return formatDateShort(m ? `${m[3]}-${m[2]}-${m[1]}` : raw);
}

export function CaseCard({ caso }: CaseCardProps) {
  const { can } = useMyPermissions();
  const qc = useQueryClient();
  const update = useUpdateOwnershipCase();

  const [error, setError] = useState<string | null>(null);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [tvOpen, setTvOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  // GAP 2 — en un pending que ya salió de un pick, el candidato actual arranca
  // marcado: el picker es un RE-pick ("Cambiar destino"), no una elección ciega.
  const [picked, setPicked] = useState(() =>
    caso.status === 'pending' && caso.targetContractId ? caso.targetContractId : '',
  );

  async function patch(body: UpdateOwnershipCaseBody): Promise<boolean> {
    setError(null);
    try {
      await update.mutateAsync({ id: caso.id, body });
      return true;
    } catch (err) {
      setError(mapActionsError(err));
      return false;
    }
  }

  const isOpenCase = caso.status === 'pending' || caso.status === 'ambiguous';
  const candidates = caso.candidates ?? [];

  // M1 — visible solo si la TV está PENDIENTE de transferir (null = no aplica:
  // el origen no tiene TV), el caso sigue abierto, hay destino y el operador
  // puede transferir (el guard duro tv:transfer vive en el endpoint F1 del BE).
  const showTransferTv =
    caso.checks.tv === 'pending' &&
    isOpenCase &&
    !!caso.targetContractId &&
    !!caso.targetClientId &&
    can('tv.transfer');

  // GAP 2 — picker de candidatos: ambiguous (pick original) O pending con
  // candidates (re-pick). En pending el título cambia y el actual va marcado.
  const showCandidatePick = isOpenCase && candidates.length > 0;
  const isRepick = caso.status === 'pending';

  // GAP 1 — pending nacido sin candidatos NI target: dead-end sin este control.
  const showAssignTarget =
    caso.status === 'pending' && caso.targetContractId === null && candidates.length === 0;

  const statusLabel = OWNERSHIP_CASE_STATUS_LABELS[caso.status];

  return (
    <article className={styles.card}>
      {/* ── Header: origen → destino + estado ── */}
      <header className={styles.header}>
        <div className={styles.parties}>
          <Link className={styles.party} to={`/admin/customers/${caso.sourceClientId}`}>
            {caso.sourceClientName ?? caso.sourceClientId}
          </Link>
          <span className={styles.arrow} aria-hidden="true">
            →
          </span>
          {caso.targetClientId ? (
            <Link className={styles.party} to={`/admin/customers/${caso.targetClientId}`}>
              {caso.targetClientName ?? caso.targetClientId}
            </Link>
          ) : (
            <span className={styles.noTarget}>Sin destino</span>
          )}
        </div>
        <span aria-label={`Estado del caso: ${statusLabel}`}>
          <StatusBadge status={STATUS_VARIANT[caso.status]} label={statusLabel} />
        </span>
      </header>

      {/* ── Meta: motivo + fechas ── */}
      <p className={styles.meta}>
        <span>Motivo: {caso.motivoBaja}</span>
        <span aria-hidden="true">·</span>
        <span>Detectado: {formatDateShort(caso.detectedAt)}</span>
        {caso.bajaDate && (
          <>
            <span aria-hidden="true">·</span>
            <span>Baja (GR): {formatBajaDate(caso.bajaDate)}</span>
          </>
        )}
      </p>

      {caso.status === 'dismissed' && caso.dismissReason && (
        <p className={styles.dismissReason}>Motivo del descarte: {caso.dismissReason}</p>
      )}

      {/* ── Checklist ── */}
      <CaseChecklist
        caseId={caso.id}
        checks={caso.checks}
        caseStatus={caso.status}
        togglePending={update.isPending}
        onToggleEquipmentReviewed={(reviewed) => void patch({ equipmentReviewed: reviewed })}
      />

      {/* ── Pick / re-pick de candidato (ambiguous o pending con candidates) ── */}
      {showCandidatePick && (
        <section className={styles.candidates} aria-label="Candidatos de destino">
          <Can
            permission="actions.manage"
            fallback={
              <p className={styles.candidatesReadOnly}>
                Candidatos: {candidates.map((c) => c.clientName ?? c.clientId).join(', ')}
              </p>
            }
          >
            <p className={styles.candidatesTitle}>
              {isRepick ? 'Cambiar destino' : 'Elegí el contrato destino:'}
            </p>
            <div className={styles.candidateList} role="radiogroup" aria-label="Candidatos">
              {candidates.map((c) => (
                <label key={c.contractId} className={styles.candidateRow}>
                  <input
                    type="radio"
                    name={`pick-${caso.id}`}
                    value={c.contractId}
                    checked={picked === c.contractId}
                    onChange={() => setPicked(c.contractId)}
                  />
                  <span className={styles.candidateName}>{c.clientName ?? c.clientId}</span>
                  <span className={styles.candidateMeta}>Contrato {c.contractId}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className={styles.btnSecondary}
              // En re-pick, "elegir" el candidato ya vigente no cambia nada → deshabilitado.
              disabled={picked === '' || picked === caso.targetContractId || update.isPending}
              onClick={() => void patch({ targetContractId: picked })}
            >
              Elegir
            </button>
          </Can>
        </section>
      )}

      {/* ── GAP 1: asignar destino a un pending nacido sin candidatos ── */}
      {showAssignTarget && assignOpen && (
        <Can permission="actions.manage">
          <AssignTargetPanel
            caseId={caso.id}
            sourceClientId={caso.sourceClientId}
            pending={update.isPending}
            onAssign={(targetContractId) => {
              void (async () => {
                const ok = await patch({ targetContractId });
                if (ok) setAssignOpen(false);
              })();
            }}
            onCancel={() => setAssignOpen(false)}
          />
        </Can>
      )}

      {/* ── Error del PATCH (422/404/400 visibles) ── */}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {/* ── Acciones ── */}
      <div className={styles.actions}>
        {showTransferTv && (
          <button type="button" className={styles.btnPrimary} onClick={() => setTvOpen(true)}>
            Transferir TV
          </button>
        )}
        <Can permission="actions.manage">
          {showAssignTarget && (
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={update.isPending}
              aria-expanded={assignOpen}
              onClick={() => setAssignOpen((v) => !v)}
            >
              Asignar destino
            </button>
          )}
          {isOpenCase && (
            <button
              type="button"
              className={styles.btnSecondary}
              disabled={update.isPending}
              onClick={() => setDismissOpen(true)}
            >
              Descartar
            </button>
          )}
          {caso.status === 'dismissed' && (
            <button
              type="button"
              className={styles.btnSecondary}
              disabled={update.isPending}
              onClick={() => void patch({ status: 'pending' })}
            >
              Reabrir
            </button>
          )}
        </Can>
      </div>

      {/* ── Modal de descarte (motivo obligatorio) ── */}
      <ServiceRemovalReasonModal
        open={dismissOpen}
        serviceName="caso"
        title="Descartar caso"
        confirmLabel="Descartar"
        tone="primary"
        placeholder="Ej: caso duplicado, ya resuelto a mano…"
        onConfirm={(reason) => {
          setDismissOpen(false);
          void patch({ status: 'dismissed', reason });
        }}
        onCancel={() => setDismissOpen(false)}
      />

      {/* ── 1-click Transferir TV (destino precargado → arranca en confirm) ── */}
      {tvOpen && caso.targetClientId && caso.targetContractId && (
        <TransferServiceModal
          variant={{ kind: 'tv' }}
          sourceClientId={caso.sourceClientId}
          sourceClientName={caso.sourceClientName}
          sourceContractId={caso.sourceContractId}
          initialTarget={{ id: caso.targetClientId, name: caso.targetClientName }}
          initialTargetContractId={caso.targetContractId}
          onClose={() => {
            setTvOpen(false);
            // Los checks AUTO (tv) cambian con la transferencia → re-leer el worklist.
            void qc.invalidateQueries({ queryKey: ['actions'] });
          }}
        />
      )}
    </article>
  );
}
