import { useEffect, useState } from 'react';
import { Can } from '@/components/auth/Can';
import { Button } from '@/components/atoms/Button';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { ContractHistoryModal } from '@/components/molecules/ContractHistoryModal';
import { useRecaptacionLead, useAddContact, useUpdateLeadStatus, useAssignLead } from '@/hooks/useRecaptacion';
import { useAssignableOperators } from '@/hooks/useAssignableOperators';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { formatDateTimeShort } from '@/utils/formatDate';
import {
  RECAPTURE_STATUS_LABELS,
  RECAPTURE_STATUS_COLOR,
  RECAPTURE_CHANNEL_LABELS,
  RECAPTURE_OUTCOME_LABELS,
  ACTIVE_MATCH_SIGNAL_LABELS,
  RecaptureContactChannel,
  RecaptureContactOutcome,
  RecaptureLeadStatus,
} from '@/types/recaptacion';
import type { RecaptureLeadDto, AddContactInput, MatchedClientSummary } from '@/types/recaptacion';
import styles from './LeadDetailDrawer.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDatetime(iso: string | null): string {
  return formatDateTimeShort(iso);
}

const CHANNELS = Object.entries(RECAPTURE_CHANNEL_LABELS) as [RecaptureContactChannel, string][];
const OUTCOMES = Object.entries(RECAPTURE_OUTCOME_LABELS) as [RecaptureContactOutcome, string][];

// ── Possible active-client match section ─────────────────────────────────────

/** Maps CustomerStatus onto the shared StatusBadge presentation variant.
 *  Mirrors ContractHistoryModal's local badgeStatus mapper. In practice the
 *  candidate set is always `status:'active'`, but this stays honest for any
 *  other value the DTO's CustomerStatus type allows. */
function matchedClientBadgeStatus(status: string): 'active' | 'late' | 'blocked' | 'inactive' | 'baja' {
  switch (status) {
    case 'active':  return 'active';
    case 'blocked': return 'blocked';
    case 'baja':    return 'baja';
    default:        return 'inactive';
  }
}

interface MatchedClientRowProps {
  client: MatchedClientSummary;
  onViewContracts: (clientId: string) => void;
}

function MatchedClientRow({ client, onViewContracts }: MatchedClientRowProps) {
  return (
    <div className={styles.matchedClientRow}>
      <div className={styles.matchedClientInfo}>
        <span className={styles.matchedClientName}>{client.name}</span>
        <StatusBadge status={matchedClientBadgeStatus(client.status)} />
        <span className={styles.matchChips}>
          {client.matchedBy.map((s) => (
            <span key={s} className={styles.matchChip}>{ACTIVE_MATCH_SIGNAL_LABELS[s] ?? s}</span>
          ))}
        </span>
      </div>
      <Button variant="secondary" onClick={() => onViewContracts(client.clientId)}>
        Ver contratos del match
      </Button>
    </div>
  );
}

interface PossibleActiveMatchSectionProps {
  match: { signals: string[]; matchedClients: MatchedClientSummary[] };
  onViewContracts: (clientId: string) => void;
}

/** Informational only — never mutates the lead. Absent entirely when there
 *  are zero fired signals (no empty shell). */
function PossibleActiveMatchSection({ match, onViewContracts }: PossibleActiveMatchSectionProps) {
  // Defensive against a malformed payload (e.g. `possibleActiveMatch: {}`)
  // that satisfies the TS shape at compile time but omits one or both arrays
  // at runtime — degrade to section-absent instead of throwing on `.length`.
  const signals = match.signals ?? [];
  const matchedClients = match.matchedClients ?? [];
  if (signals.length === 0) return null;
  return (
    <section className={styles.section}>
      <p className={styles.sectionTitle}>Posible cliente activo</p>
      <div className={styles.matchChips}>
        {signals.map((s) => (
          <span key={s} className={styles.matchChip}>
            {ACTIVE_MATCH_SIGNAL_LABELS[s as keyof typeof ACTIVE_MATCH_SIGNAL_LABELS] ?? s}
          </span>
        ))}
      </div>
      {matchedClients.length > 0 && (
        <div className={styles.matchedClientsList}>
          {matchedClients.map((c) => (
            <MatchedClientRow key={c.clientId} client={c} onViewContracts={onViewContracts} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── RegisterContactForm ──────────────────────────────────────────────────────

interface RegisterContactFormProps {
  leadId: string;
  onSuccess: () => void;
}

function RegisterContactForm({ leadId, onSuccess }: RegisterContactFormProps) {
  const addContact = useAddContact();

  const [channel, setChannel] = useState<RecaptureContactChannel>('llamada');
  const [outcome, setOutcome] = useState<RecaptureContactOutcome>('sin_respuesta');
  const [note, setNote] = useState('');
  const [proposal, setProposal] = useState('');
  const [nextStepAt, setNextStepAt] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: AddContactInput = {
      channel,
      outcome,
      ...(note.trim()     ? { note: note.trim() }         : {}),
      ...(proposal.trim() ? { proposal: proposal.trim() } : {}),
      ...(nextStepAt      ? { nextStepAt }                : {}),
    };
    await addContact.mutateAsync({ leadId, body });
    setNote(''); setProposal(''); setNextStepAt('');
    onSuccess();
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
      <p className={styles.formTitle}>Registrar contacto</p>

      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Canal</label>
          <select
            className={styles.formSelect}
            value={channel}
            onChange={(e) => setChannel(e.target.value as RecaptureContactChannel)}
          >
            {CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Resultado</label>
          <select
            className={styles.formSelect}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as RecaptureContactOutcome)}
          >
            {OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Nota</label>
        <textarea
          className={styles.formTextarea}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notas del contacto…"
        />
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Propuesta</label>
        <input
          type="text"
          className={styles.formInput}
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
          placeholder="Propuesta ofrecida…"
        />
      </div>

      <div className={styles.formField}>
        <label className={styles.formLabel}>Próximo paso</label>
        <input
          type="datetime-local"
          className={styles.formInput}
          value={nextStepAt}
          onChange={(e) => setNextStepAt(e.target.value)}
        />
      </div>

      {addContact.isError && (
        <p className={styles.errorMsg}>Error al registrar el contacto. Intentá nuevamente.</p>
      )}

      <div className={styles.formActions}>
        <Button type="submit" variant="primary" loading={addContact.isPending}>
          Guardar contacto
        </Button>
      </div>
    </form>
  );
}

// ── LeadDetailDrawer ─────────────────────────────────────────────────────────

interface LeadDetailDrawerProps {
  lead: RecaptureLeadDto | null;
  onClose: () => void;
}

const STATUS_OPTIONS = Object.entries(RECAPTURE_STATUS_LABELS) as [RecaptureLeadStatus, string][];

export function LeadDetailDrawer({ lead, onClose }: LeadDetailDrawerProps) {
  const { can } = useMyPermissions();
  // The operator select is gated by recapture.assign; only an actor that can
  // assign may fetch the candidate pool. GET /admin/rbac/users requires the
  // admin/rbac permission, so a manage-only agent must NOT fire it.
  const canAssign = can('recapture.assign');

  const { data: detail, isLoading } = useRecaptacionLead(lead?.id ?? null);
  const updateLeadStatus = useUpdateLeadStatus();
  const assignLead       = useAssignLead();
  // Assignee candidates come from the SAME shared pool as the page's inline +
  // bulk selects: ACTIVE RbacUsers WITH ≥1 role and NONE technical (`tecnico`).
  // The BE validates `operatorId` against RbacUser (NOT the Admin table) and
  // re-enforces the same rule (422 RECAPTURE_ASSIGNEE_NOT_ALLOWED), so their ids
  // match `lead.assigneeId`. Gated by `canAssign` so a manage-only agent never
  // fires GET /admin/rbac/users.
  const { operators } = useAssignableOperators(canAssign);

  const [showForm, setShowForm] = useState(false);
  // Which client's contracts the modal shows — null = closed. Shared by the
  // lead's own "Ver contratos" button AND each matched client's "Ver
  // contratos del match" button (each just sets a different clientId).
  const [contractsClientId, setContractsClientId] = useState<string | null>(null);

  // Reset whenever the lead identity changes so the modal can never stay open
  // (or armed) against a PREVIOUS lead's client. Safe no-op today — the drawer
  // currently unmounts between leads — but hardens against a future "next
  // lead" control that would reuse the same mounted instance.
  useEffect(() => {
    setContractsClientId(null);
  }, [lead?.id]);

  if (!lead) return null;

  // `lead` is a frozen snapshot from the page; `detail` is the re-fetched, always-fresh
  // copy (RecaptureLeadDetailDto extends RecaptureLeadDto + contacts). Mutations that
  // invalidate recaptacionLeadKey(id) — status, assign, contact — refresh `detail`, so
  // rendering from `view` makes the drawer reflect changes instantly. Falls back to the
  // prop while the detail is still loading.
  const view = detail ?? lead;

  // A controlled <select> only shows what's in its <option> list. If the lead's
  // assignee is NOT in the pool — e.g. a technician assigned before the filter
  // existed — the select would render blank and silently misreport "Sin
  // asignar". Inject a phantom option so the select ALWAYS reflects the real
  // assignee. The pool filter trims the CHOICES, it never erases an assignment.
  const assigneeInPool =
    view.assigneeId != null && operators.some((op) => op.id === view.assigneeId);
  const showPhantom = view.assigneeId != null && !assigneeInPool;

  // The contracts modal can be opened for the lead's own client OR for any
  // matched client — resolve whichever name applies for the modal subtitle.
  const contractsClientName =
    contractsClientId === view.clientId
      ? view.contactName
      // `?.` twice: possibleActiveMatch itself is optional, and even when present
      // a malformed payload may omit matchedClients — guard both so this never
      // throws (see PossibleActiveMatchSection's own array guard for the section).
      : view.possibleActiveMatch?.matchedClients?.find((m) => m.clientId === contractsClientId)?.name;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle lead: ${view.contactName}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <aside className={styles.drawer}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>{view.contactName}</h2>
            <p className={styles.subtitle}>{view.email ?? view.phone ?? 'Sin contacto directo'}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Meta info */}
          <section className={styles.section}>
            <p className={styles.sectionTitle}>Información</p>
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Teléfono</span>
                <span className={styles.metaValue}>{view.phone ?? '—'}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Email</span>
                <span className={styles.metaValue}>{view.email ?? '—'}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Origen</span>
                <span className={styles.metaValue}>{view.source === 'churned_client' ? 'Cliente dado de baja' : 'CSV'}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Creado</span>
                <span className={styles.metaValue}>{formatDatetime(view.createdAt)}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Tomado el</span>
                <span className={styles.metaValue}>{formatDatetime(view.claimedAt)}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Asignado</span>
                <span className={styles.metaValue}>{view.assigneeName ?? '—'}</span>
              </div>
            </div>
            {view.clientId && (
              <div className={styles.contractsAction}>
                <Button variant="secondary" onClick={() => setContractsClientId(view.clientId)}>
                  Ver contratos
                </Button>
              </div>
            )}
          </section>

          {/* Possible active-client match (informational, never mutates the lead) */}
          {view.possibleActiveMatch && (
            <PossibleActiveMatchSection
              match={view.possibleActiveMatch}
              onViewContracts={setContractsClientId}
            />
          )}

          {/* Actions */}
          <div className={styles.actions}>
            {/* Status display (no permission) */}
            <Can permission="recapture.manage" fallback={
              <span
                className={styles.statusPill}
                style={{ backgroundColor: RECAPTURE_STATUS_COLOR[view.status] ?? '#94a3b8' }}
              >
                {RECAPTURE_STATUS_LABELS[view.status]}
              </span>
            }>
              <div className={styles.statusSelectWrapper}>
                <label htmlFor="lead-status-select" className={styles.statusSelectLabel}>Estado</label>
                <select
                  id="lead-status-select"
                  aria-label="Estado"
                  className={styles.statusSelect}
                  value={view.status}
                  disabled={updateLeadStatus.isPending}
                  onChange={(e) =>
                    updateLeadStatus.mutate({ id: lead.id, status: e.target.value as RecaptureLeadStatus })
                  }
                >
                  {STATUS_OPTIONS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </Can>

            {/* Operator assignment — admin only (recapture.assign) */}
            <Can permission="recapture.assign">
              <div className={styles.statusSelectWrapper}>
                <label htmlFor="lead-operator-select" className={styles.statusSelectLabel}>Operador</label>
                <select
                  id="lead-operator-select"
                  aria-label="Operador"
                  className={styles.statusSelect}
                  value={view.assigneeId ?? ''}
                  disabled={assignLead.isPending}
                  onChange={(e) => {
                    const operatorId = e.target.value === '' ? null : e.target.value;
                    assignLead.mutate({ leadId: lead.id, operatorId });
                  }}
                >
                  <option value="">— Sin asignar —</option>
                  {showPhantom && (
                    <option value={view.assigneeId!}>
                      {view.assigneeName ?? 'Asignado (fuera de lista)'}
                    </option>
                  )}
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </select>
                {operators.length === 0 && (
                  <p className={styles.operatorHint} role="note">
                    No hay usuarios disponibles para asignar.
                  </p>
                )}
              </div>
            </Can>

            {/* Register contact — agent + admin (recapture.manage) */}
            <Can permission="recapture.manage">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? 'Cancelar' : 'Registrar contacto'}
              </Button>
            </Can>
          </div>

          {/* Register contact form (gated) */}
          <Can permission="recapture.manage">
            {showForm && (
              <RegisterContactForm
                leadId={lead.id}
                onSuccess={() => setShowForm(false)}
              />
            )}
          </Can>

          {/* Contact timeline */}
          <section className={styles.timeline}>
            <p className={styles.sectionTitle}>Historial de contactos</p>
            {isLoading ? (
              <p className={styles.timelineEmpty}>Cargando…</p>
            ) : !detail || detail.contacts.length === 0 ? (
              <p className={styles.timelineEmpty}>Sin contactos registrados todavía.</p>
            ) : (
              detail.contacts.map((c) => (
                <div key={c.id} className={styles.contactCard}>
                  <div className={styles.contactCardHeader}>
                    <span className={styles.channelBadge}>
                      {RECAPTURE_CHANNEL_LABELS[c.channel]}
                    </span>
                    <span className={styles.contactDate}>{formatDatetime(c.createdAt)}</span>
                  </div>
                  <span className={styles.outcomeBadge}>
                    {RECAPTURE_OUTCOME_LABELS[c.outcome]}
                  </span>
                  {c.note && <p className={styles.contactNote}>{c.note}</p>}
                  {c.proposal && <p className={styles.metaValue}>Propuesta: {c.proposal}</p>}
                  {c.nextStepAt && (
                    <p className={styles.metaValue}>
                      Próximo paso: {formatDatetime(c.nextStepAt)}
                    </p>
                  )}
                </div>
              ))
            )}
          </section>
        </div>
      </aside>
      {contractsClientId && (
        <ContractHistoryModal
          open
          clientId={contractsClientId}
          clientName={contractsClientName}
          onClose={() => setContractsClientId(null)}
        />
      )}
    </div>
  );
}
