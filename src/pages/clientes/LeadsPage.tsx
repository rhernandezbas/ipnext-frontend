import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead, useConvertLeadToClient } from '@/hooks/useLeads';
import type { Lead, LeadStatus, LeadSource } from '@/types/lead';
import styles from './LeadsPage.module.css';

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  qualified: 'Calificado',
  proposal_sent: 'Propuesta enviada',
  won: 'Ganado',
  lost: 'Perdido',
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  website: 'Web',
  referral: 'Referido',
  cold_call: 'Llamada',
  social_media: 'Redes sociales',
  other: 'Otro',
};

const STATUS_FILTERS: Array<{ value: LeadStatus | ''; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'new', label: 'Nuevo' },
  { value: 'contacted', label: 'Contactado' },
  { value: 'qualified', label: 'Calificado' },
  { value: 'proposal_sent', label: 'Propuesta enviada' },
  { value: 'won', label: 'Ganado' },
  { value: 'lost', label: 'Perdido' },
];

function StatusBadge({ status }: { status: LeadStatus }) {
  const classMap: Record<LeadStatus, string> = {
    new: styles.badgeNew,
    contacted: styles.badgeContacted,
    qualified: styles.badgeQualified,
    proposal_sent: styles.badgeProposal,
    won: styles.badgeWon,
    lost: styles.badgeLost,
  };
  return (
    <span className={`${styles.badge} ${classMap[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function SourceBadge({ source }: { source: LeadSource }) {
  return (
    <span className={styles.sourceBadge}>{SOURCE_LABELS[source]}</span>
  );
}

interface LeadFormProps {
  initial?: Partial<Lead>;
  onClose: () => void;
  onSubmit: (data: Omit<Lead, 'id' | 'createdAt' | 'convertedAt' | 'convertedClientId'>) => void;
  title: string;
}

function LeadFormModal({ initial = {}, onClose, onSubmit, title }: LeadFormProps) {
  const [name, setName] = useState(initial.name ?? '');
  const [email, setEmail] = useState(initial.email ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [address, setAddress] = useState(initial.address ?? '');
  const [city, setCity] = useState(initial.city ?? '');
  const [source, setSource] = useState<LeadSource>(initial.source ?? 'website');
  const [assignedTo, setAssignedTo] = useState(initial.assignedTo ?? '');
  const [interestedIn, setInterestedIn] = useState(initial.interestedIn ?? '');
  const [followUpDate, setFollowUpDate] = useState(initial.followUpDate ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      email,
      phone,
      address,
      city,
      source,
      status: initial.status ?? 'new',
      assignedTo,
      assignedToId: initial.assignedToId ?? '',
      interestedIn,
      notes,
      followUpDate: followUpDate || null,
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <h2 className={styles.modalTitle}>{title}</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="lead-name">Nombre</label>
              <input id="lead-name" type="text" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="lead-email">Email</label>
              <input id="lead-email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="lead-phone">Teléfono</label>
              <input id="lead-phone" type="text" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="lead-city">Ciudad</label>
              <input id="lead-city" type="text" value={city} onChange={e => setCity(e.target.value)} />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="lead-address">Dirección</label>
            <input id="lead-address" type="text" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="lead-source">Fuente</label>
              <select id="lead-source" value={source} onChange={e => setSource(e.target.value as LeadSource)}>
                <option value="website">Web</option>
                <option value="referral">Referido</option>
                <option value="cold_call">Llamada</option>
                <option value="social_media">Redes sociales</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="lead-assigned">Asignado a</label>
              <select id="lead-assigned" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                <option value="">Sin asignar</option>
                <option value="María López">María López</option>
                <option value="Carlos Gómez">Carlos Gómez</option>
              </select>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="lead-interested">Interesado en</label>
            <input id="lead-interested" type="text" value={interestedIn} onChange={e => setInterestedIn(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="lead-followup">Fecha de seguimiento</label>
            <input id="lead-followup" type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="lead-notes">Notas</label>
            <textarea
              id="lead-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
            <button type="submit" className={styles.btnPrimary}>Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const [activeStatus, setActiveStatus] = useState<LeadStatus | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewLead, setViewLead] = useState<Lead | null>(null);
  const [editLead, setEditLead] = useState<Lead | null>(null);

  const { data: leads = [], isLoading } = useLeads();
  const { mutate: createLead } = useCreateLead();
  const { mutate: updateLead } = useUpdateLead();
  const { mutate: deleteLead } = useDeleteLead();
  const { mutate: convertLead } = useConvertLeadToClient();

  const filteredLeads = activeStatus
    ? leads.filter(l => l.status === activeStatus)
    : leads;

  function handleCreate(data: Omit<Lead, 'id' | 'createdAt' | 'convertedAt' | 'convertedClientId'>) {
    createLead(data);
    setShowModal(false);
  }

  const columns = [
    { label: 'Nombre', key: 'name' as keyof Lead },
    { label: 'Email', key: 'email' as keyof Lead },
    { label: 'Teléfono', key: 'phone' as keyof Lead },
    { label: 'Ciudad', key: 'city' as keyof Lead },
    {
      label: 'Fuente',
      key: 'source' as keyof Lead,
      render: (row: Lead) => <SourceBadge source={row.source} />,
    },
    {
      label: 'Estado',
      key: 'status' as keyof Lead,
      render: (row: Lead) => <StatusBadge status={row.status} />,
    },
    { label: 'Asignado a', key: 'assignedTo' as keyof Lead },
    { label: 'Interesado en', key: 'interestedIn' as keyof Lead },
    { label: 'Seguimiento', key: 'followUpDate' as keyof Lead },
  ];

  const actions = [
    { label: 'Ver', onClick: (row: Lead) => setViewLead(row) },
    { label: 'Editar', onClick: (row: Lead) => setEditLead(row) },
    {
      label: 'Cambiar estado',
      onClick: (row: Lead) => {
        updateLead({ id: row.id, data: { status: 'contacted' } });
      },
    },
    {
      label: 'Convertir a cliente',
      onClick: (row: Lead) => {
        if (window.confirm(`¿Convertir "${row.name}" a cliente?`)) convertLead({ id: row.id, clientId: row.id });
      },
    },
    {
      label: 'Eliminar',
      onClick: (row: Lead) => deleteLead(row.id),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Clientes potenciales</h1>
        <div className={styles.headerActions}>
          <button
            className={styles.btnSecondary}
            disabled={selectedIds.length === 0}
          >
            Convertir a cliente
          </button>
          <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>
            Nuevo lead
          </button>
        </div>
      </div>

      <div className={styles.filterBar} aria-label="Status filter tabs">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            className={`${styles.filterBtn} ${activeStatus === f.value ? styles.filterBtnActive : ''}`}
            onClick={() => setActiveStatus(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={filteredLeads}
        loading={isLoading}
        actions={actions}
        emptyMessage="No hay leads registrados."
        selectable
        onSelectionChange={(ids) => setSelectedIds(ids)}
      />

      {showModal && (
        <LeadFormModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
          title="Nuevo lead"
        />
      )}

      {editLead && (
        <LeadFormModal
          initial={editLead}
          onClose={() => setEditLead(null)}
          onSubmit={data => { updateLead({ id: editLead.id, data }); setEditLead(null); }}
          title="Editar lead"
        />
      )}

      {viewLead && (
        <div className={styles.overlay}>
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h2 className={styles.modalTitle}>Detalle de lead</h2>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', margin: '1rem 0' }}>
              <dt style={{ fontWeight: 600 }}>Nombre</dt><dd>{viewLead.name}</dd>
              <dt style={{ fontWeight: 600 }}>Email</dt><dd>{viewLead.email || '—'}</dd>
              <dt style={{ fontWeight: 600 }}>Teléfono</dt><dd>{viewLead.phone || '—'}</dd>
              <dt style={{ fontWeight: 600 }}>Ciudad</dt><dd>{viewLead.city || '—'}</dd>
              <dt style={{ fontWeight: 600 }}>Dirección</dt><dd>{viewLead.address || '—'}</dd>
              <dt style={{ fontWeight: 600 }}>Fuente</dt><dd>{SOURCE_LABELS[viewLead.source]}</dd>
              <dt style={{ fontWeight: 600 }}>Estado</dt><dd>{STATUS_LABELS[viewLead.status]}</dd>
              <dt style={{ fontWeight: 600 }}>Asignado a</dt><dd>{viewLead.assignedTo || '—'}</dd>
              <dt style={{ fontWeight: 600 }}>Interesado en</dt><dd>{viewLead.interestedIn || '—'}</dd>
              <dt style={{ fontWeight: 600 }}>Seguimiento</dt><dd>{viewLead.followUpDate || '—'}</dd>
              {viewLead.notes && (
                <>
                  <dt style={{ fontWeight: 600 }}>Notas</dt><dd>{viewLead.notes}</dd>
                </>
              )}
            </dl>
            <div className={styles.modalActions}>
              <button className={styles.btnPrimary} onClick={() => setViewLead(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
