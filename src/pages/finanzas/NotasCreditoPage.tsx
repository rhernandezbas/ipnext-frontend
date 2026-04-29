import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { useCreditNotes, useCreateCreditNote, useApplyCreditNote, useVoidCreditNote } from '@/hooks/useBilling';
import type { CreditNote, CreditNoteStatus } from '@/types/billing';
import styles from './finanzas.module.css';

type BadgeStatus = 'active' | 'late' | 'blocked' | 'inactive';

const STATUS_MAP: Record<CreditNoteStatus, BadgeStatus> = {
  draft: 'inactive',
  sent: 'inactive',
  applied: 'active',
  voided: 'blocked',
};

const STATUS_LABELS: Record<CreditNoteStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  applied: 'Aplicada',
  voided: 'Anulada',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR');
}

const COLUMNS = [
  { label: 'Número', key: 'number' as keyof CreditNote },
  { label: 'Cliente', key: 'clientName' as keyof CreditNote },
  {
    label: 'Monto',
    key: 'amount' as keyof CreditNote,
    render: (row: CreditNote) => `$${row.amount.toFixed(2)}`,
  },
  {
    label: 'Impuesto',
    key: 'taxAmount' as keyof CreditNote,
    render: (row: CreditNote) => `$${row.taxAmount.toFixed(2)}`,
  },
  {
    label: 'Total',
    key: 'totalAmount' as keyof CreditNote,
    render: (row: CreditNote) => `$${row.totalAmount.toFixed(2)}`,
  },
  { label: 'Motivo', key: 'reason' as keyof CreditNote },
  {
    label: 'Estado',
    key: 'status' as keyof CreditNote,
    render: (row: CreditNote) => (
      <span>
        <StatusBadge status={STATUS_MAP[row.status]} />
        <span style={{ marginLeft: '0.25rem', fontSize: '0.75rem' }}>{STATUS_LABELS[row.status]}</span>
      </span>
    ),
  },
  {
    label: 'Fecha',
    key: 'issuedAt' as keyof CreditNote,
    render: (row: CreditNote) => formatDate(row.issuedAt),
  },
  {
    label: 'Factura relacionada',
    key: 'relatedInvoiceId' as keyof CreditNote,
    render: (row: CreditNote) => row.relatedInvoiceId ?? '—',
  },
];

export default function NotasCreditoPage() {
  const [showForm, setShowForm] = useState(false);
  const [viewNote, setViewNote] = useState<CreditNote | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('');
  const [relatedInvoiceId, setRelatedInvoiceId] = useState('');
  const [notes, setNotes] = useState('');

  const { data: creditNotes = [], isLoading } = useCreditNotes();
  const { mutate: createNote } = useCreateCreditNote();
  const { mutate: applyNote } = useApplyCreditNote();
  const { mutate: voidNote } = useVoidCreditNote();

  const actions = [
    { label: 'Ver', onClick: (row: CreditNote) => setViewNote(row) },
    { label: 'Aplicar', onClick: (row: CreditNote) => applyNote(row.id) },
    { label: 'Anular', onClick: (row: CreditNote) => voidNote(row.id) },
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const taxAmount = amount * 0.21;
    createNote({
      number: `NC-${Date.now()}`,
      clientId: clientId || 'cli-new',
      clientName,
      amount,
      taxAmount,
      totalAmount: amount + taxAmount,
      reason,
      relatedInvoiceId: relatedInvoiceId || null,
      issuedAt: new Date().toISOString().split('T')[0],
      notes,
    });
    setShowForm(false);
    setClientName('');
    setAmount(0);
    setReason('');
    setRelatedInvoiceId('');
    setNotes('');
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Notas de crédito</h1>
        <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>
          Nueva nota de crédito
        </button>
      </div>

      <DataTable
        columns={COLUMNS}
        data={creditNotes}
        loading={isLoading}
        actions={actions}
        emptyMessage="No hay notas de crédito."
      />

      {viewNote && (
        <div className={styles.overlay}>
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h2 className={styles.modalTitle}>Detalle de nota de crédito</h2>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', margin: '1rem 0' }}>
              <dt style={{ fontWeight: 600 }}>Número</dt><dd>{viewNote.number}</dd>
              <dt style={{ fontWeight: 600 }}>Cliente</dt><dd>{viewNote.clientName}</dd>
              <dt style={{ fontWeight: 600 }}>Monto</dt><dd>${viewNote.amount.toFixed(2)}</dd>
              <dt style={{ fontWeight: 600 }}>Impuesto</dt><dd>${viewNote.taxAmount.toFixed(2)}</dd>
              <dt style={{ fontWeight: 600 }}>Total</dt><dd>${viewNote.totalAmount.toFixed(2)}</dd>
              <dt style={{ fontWeight: 600 }}>Motivo</dt><dd>{viewNote.reason}</dd>
              <dt style={{ fontWeight: 600 }}>Estado</dt><dd>{STATUS_LABELS[viewNote.status]}</dd>
              <dt style={{ fontWeight: 600 }}>Fecha</dt><dd>{formatDate(viewNote.issuedAt)}</dd>
              <dt style={{ fontWeight: 600 }}>Factura relacionada</dt><dd>{viewNote.relatedInvoiceId ?? '—'}</dd>
            </dl>
            <div className={styles.modalActions}>
              <button className={styles.btnPrimary} onClick={() => setViewNote(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className={styles.overlay}>
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h2 className={styles.modalTitle}>Nueva nota de crédito</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="nc-client">Cliente</label>
                <input
                  id="nc-client"
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="nc-amount">Monto</label>
                <input
                  id="nc-amount"
                  type="number"
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value))}
                  min={0}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="nc-reason">Motivo</label>
                <input
                  id="nc-reason"
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="nc-invoice">Factura relacionada (opcional)</label>
                <input
                  id="nc-invoice"
                  type="text"
                  value={relatedInvoiceId}
                  onChange={e => setRelatedInvoiceId(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="nc-notes">Notas</label>
                <textarea
                  id="nc-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Crear nota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
