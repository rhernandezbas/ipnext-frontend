import { useState } from 'react';
import { Can } from '@/components/auth/Can';
import { useRecaptacionLead, useClaimLead, useReleaseLead, useAddContact } from '@/hooks/useRecaptacion';
import { formatDateTimeShort } from '@/utils/formatDate';
import {
  RECAPTURE_STATUS_LABELS,
  RECAPTURE_STATUS_COLOR,
  RECAPTURE_CHANNEL_LABELS,
  RECAPTURE_OUTCOME_LABELS,
  RecaptureContactChannel,
  RecaptureContactOutcome,
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
  const [advanceStatus, setAdvanceStatus] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: AddContactInput = {
      channel,
      outcome,
      ...(note.trim()     ? { note: note.trim() }         : {}),
      ...(proposal.trim() ? { proposal: proposal.trim() } : {}),
      ...(nextStepAt      ? { nextStepAt }                : {}),
      ...(advanceStatus   ? { advanceStatus: true }        : {}),
    };
    await addContact.mutateAsync({ leadId, body });
    setNote(''); setProposal(''); setNextStepAt(''); setAdvanceStatus(false);
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

      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.formLabel}>Próximo paso</label>
          <input
            type="datetime-local"
            className={styles.formInput}
            value={nextStepAt}
            onChange={(e) => setNextStepAt(e.target.value)}
          />
        </div>
        <div className={styles.formField} style={{ justifyContent: 'flex-end', paddingBottom: 2 }}>
          <label className={styles.formLabel} style={{ marginBottom: 'auto' }}>Avanzar estado</label>
          <input
            type="checkbox"
            checked={advanceStatus}
            onChange={(e) => setAdvanceStatus(e.target.checked)}
          />
        </div>
      </div>

      {addContact.isError && (
        <p className={styles.errorMsg}>Error al registrar el contacto. Intentá nuevamente.</p>
      )}

      <div className={styles.formActions}>
        <button
          type="submit"
          className={styles.btnPrimary}
          disabled={addContact.isPending}
        >
          {addContact.isPending ? 'Guardando…' : 'Guardar contacto'}
        </button>
      </div>
    </form>
  );
}

// ── LeadDetailDrawer ─────────────────────────────────────────────────────────

interface LeadDetailDrawerProps {
  lead: RecaptureLeadDto | null;
  onClose: () => void;
}

export function LeadDetailDrawer({ lead, onClose }: LeadDetailDrawerProps) {
  const { data: detail, isLoading } = useRecaptacionLead(lead?.id ?? null);
  const claimLead   = useClaimLead();
  const releaseLead = useReleaseLead();

  const [showForm, setShowForm] = useState(false);

  if (!lead) return null;

  const statusColor = RECAPTURE_STATUS_COLOR[lead.status] ?? '#94a3b8';
  const statusLabel = RECAPTURE_STATUS_LABELS[lead.status];

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
            </div>
          </section>

          {/* Actions */}
          <div className={styles.actions}>
            <span
              className={styles.statusPill}
              style={{ backgroundColor: statusColor }}
            >
              {statusLabel}
            </span>

            <Can permission="recapture.manage">
              {!isAssigned && (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  disabled={claimLead.isPending}
                  onClick={() => claimLead.mutate(lead.id)}
                >
                  {claimLead.isPending ? 'Tomando…' : 'Tomar lead'}
                </button>
              )}
              {isAssigned && (
                <button
                  type="button"
                  className={styles.btnDanger}
                  disabled={releaseLead.isPending}
                  onClick={() => releaseLead.mutate(lead.id)}
                >
                  {releaseLead.isPending ? 'Liberando…' : 'Liberar lead'}
                </button>
              )}
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? 'Cancelar' : 'Registrar contacto'}
              </button>
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
                    <p className={styles.metaValue} style={{ fontSize: 12 }}>
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
