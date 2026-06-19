import { useState } from 'react';
import { Can } from '@/components/auth/Can';
import { Button } from '@/components/atoms/Button';
import { useRecaptacionLead, useClaimLead, useReleaseLead, useAddContact, useUpdateLeadStatus, useAssignLead } from '@/hooks/useRecaptacion';
import { useAdmins } from '@/hooks/useAdmins';
import { formatDateTimeShort } from '@/utils/formatDate';
import {
  RECAPTURE_STATUS_LABELS,
  RECAPTURE_STATUS_COLOR,
  RECAPTURE_CHANNEL_LABELS,
  RECAPTURE_OUTCOME_LABELS,
  RecaptureContactChannel,
  RecaptureContactOutcome,
  RecaptureLeadStatus,
} from '@/types/recaptacion';
import type { RecaptureLeadDto, AddContactInput } from '@/types/recaptacion';
import styles from './LeadDetailDrawer.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDatetime(iso: string | null): string {
  return formatDateTimeShort(iso);
}

const CHANNELS = Object.entries(RECAPTURE_CHANNEL_LABELS) as [RecaptureContactChannel, string][];
const OUTCOMES = Object.entries(RECAPTURE_OUTCOME_LABELS) as [RecaptureContactOutcome, string][];

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
  const { data: detail, isLoading } = useRecaptacionLead(lead?.id ?? null);
  const claimLead        = useClaimLead();
  const releaseLead      = useReleaseLead();
  const updateLeadStatus = useUpdateLeadStatus();
  const assignLead       = useAssignLead();
  const { data: admins = [] } = useAdmins();

  const [showForm, setShowForm] = useState(false);

  if (!lead) return null;

  const isAssigned = !!lead.assigneeId;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle lead: ${lead.contactName}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <aside className={styles.drawer}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 className={styles.title}>{lead.contactName}</h2>
            <p className={styles.subtitle}>{lead.email ?? lead.phone ?? 'Sin contacto directo'}</p>
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
                <span className={styles.metaValue}>{lead.phone ?? '—'}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Email</span>
                <span className={styles.metaValue}>{lead.email ?? '—'}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Origen</span>
                <span className={styles.metaValue}>{lead.source === 'churned_client' ? 'Cliente dado de baja' : 'CSV'}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Creado</span>
                <span className={styles.metaValue}>{formatDatetime(lead.createdAt)}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Tomado el</span>
                <span className={styles.metaValue}>{formatDatetime(lead.claimedAt)}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Asignado</span>
                <span className={styles.metaValue}>{lead.assigneeName ?? '—'}</span>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className={styles.actions}>
            {/* Status display (no permission) */}
            <Can permission="recapture.manage" fallback={
              <span
                className={styles.statusPill}
                style={{ backgroundColor: RECAPTURE_STATUS_COLOR[lead.status] ?? '#94a3b8' }}
              >
                {RECAPTURE_STATUS_LABELS[lead.status]}
              </span>
            }>
              <div className={styles.statusSelectWrapper}>
                <label htmlFor="lead-status-select" className={styles.statusSelectLabel}>Estado</label>
                <select
                  id="lead-status-select"
                  aria-label="Estado"
                  className={styles.statusSelect}
                  value={lead.status}
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

            <Can permission="recapture.manage">
              <div className={styles.statusSelectWrapper}>
                <label htmlFor="lead-operator-select" className={styles.statusSelectLabel}>Operador</label>
                <select
                  id="lead-operator-select"
                  aria-label="Operador"
                  className={styles.statusSelect}
                  value={lead.assigneeId ?? ''}
                  disabled={assignLead.isPending}
                  onChange={(e) => {
                    const operatorId = e.target.value === '' ? null : e.target.value;
                    assignLead.mutate({ leadId: lead.id, operatorId });
                  }}
                >
                  <option value="">— Sin asignar —</option>
                  {admins.map((admin) => (
                    <option key={admin.id} value={admin.id}>{admin.name}</option>
                  ))}
                </select>
              </div>
              {!isAssigned && (
                <Button
                  type="button"
                  variant="primary"
                  loading={claimLead.isPending}
                  onClick={() => claimLead.mutate(lead.id)}
                >
                  Tomar lead
                </Button>
              )}
              {isAssigned && (
                <Button
                  type="button"
                  variant="danger"
                  loading={releaseLead.isPending}
                  onClick={() => releaseLead.mutate(lead.id)}
                >
                  Liberar lead
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? 'Cancelar' : 'Registrar contacto'}
              </Button>
            </Can>
          </div>

          {/* Claim/release feedback — 409 means another operator beat us to it */}
          {claimLead.isError && (
            <p className={styles.errorMsg} role="alert">
              {claimLead.error instanceof Error
                ? claimLead.error.message
                : 'No se pudo tomar el lead.'}
            </p>
          )}
          {releaseLead.isError && (
            <p className={styles.errorMsg} role="alert">No se pudo liberar el lead.</p>
          )}

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
    </div>
  );
}
