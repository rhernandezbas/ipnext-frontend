import { useState } from 'react';
import { DataTable } from '@/components/organisms/DataTable/DataTable';
import { StatusBadge } from '@/components/atoms/StatusBadge/StatusBadge';
import { useProformas, useCreateProforma, useCancelProforma, useConvertToInvoice } from '@/hooks/useBilling';
import type { ProformaInvoice, ProformaStatus } from '@/types/billing';
import styles from './finanzas.module.css';

type BadgeStatus = 'active' | 'late' | 'blocked' | 'inactive';

const STATUS_MAP: Record<ProformaStatus, BadgeStatus> = {
  draft: 'inactive',
  sent: 'inactive',
  paid: 'active',
  cancelled: 'blocked',
  expired: 'late',
};

const STATUS_LABELS: Record<ProformaStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  paid: 'Pagada',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR');
}

const COLUMNS = [
  { label: 'Número', key: 'number' as keyof ProformaInvoice },
  { label: 'Cliente', key: 'clientName' as keyof ProformaInvoice },
  {
    label: 'Total',
    key: 'total' as keyof ProformaInvoice,
    render: (row: ProformaInvoice) => `$${row.total.toFixed(2)}`,
  },
  {
    label: 'Estado',
    key: 'status' as keyof ProformaInvoice,
    render: (row: ProformaInvoice) => (
      <span>
        <StatusBadge status={STATUS_MAP[row.status]} />
        <span style={{ marginLeft: '0.25rem', fontSize: '0.75rem' }}>{STATUS_LABELS[row.status]}</span>
      </span>
    ),
  },
  {
    label: 'Emitida',
    key: 'issuedAt' as keyof ProformaInvoice,
    render: (row: ProformaInvoice) => formatDate(row.issuedAt),
  },
  {
    label: 'Válida hasta',
    key: 'validUntil' as keyof ProformaInvoice,
    render: (row: ProformaInvoice) => formatDate(row.validUntil),
  },
  {
    label: 'Convertida a factura',
    key: 'convertedToInvoiceId' as keyof ProformaInvoice,
    render: (row: ProformaInvoice) => row.convertedToInvoiceId ?? '—',
  },
];

export default function ProformasPage() {
  const [showForm, setShowForm] = useState(false);
  const [viewProforma, setViewProforma] = useState<ProformaInvoice | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemPrice, setItemPrice] = useState(0);
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');

  const { data: proformas = [], isLoading } = useProformas();
  const { mutate: createProforma } = useCreateProforma();
  const { mutate: cancelProf } = useCancelProforma();
  const { mutate: convertProforma } = useConvertToInvoice();

  const actions = [
    { label: 'Ver', onClick: (row: ProformaInvoice) => setViewProforma(row) },
    {
      label: 'Convertir a factura',
      onClick: (row: ProformaInvoice) => {
        if (window.confirm('¿Convertir proforma a factura?')) convertProforma(row.id);
      },
    },
    { label: 'Cancelar', onClick: (row: ProformaInvoice) => cancelProf(row.id) },
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const itemTotal = itemQty * itemPrice;
    const subtotal = itemTotal;
    const taxAmount = subtotal * 0.21;
    createProforma({
      number: `PRO-${Date.now()}`,
      clientId: clientId || 'cli-new',
      clientName,
      items: [{ description: itemDesc, quantity: itemQty, unitPrice: itemPrice, total: itemTotal }],
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
      issuedAt: new Date().toISOString().split('T')[0],
      validUntil,
      notes,
    });
    setShowForm(false);
    setClientName('');
    setItemDesc('');
    setItemQty(1);
    setItemPrice(0);
    setValidUntil('');
    setNotes('');
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Facturas proforma</h1>
        <button className={styles.btnPrimary} onClick={() => setShowForm(true)}>
          Nueva proforma
        </button>
      </div>

      <DataTable
        columns={COLUMNS}
        data={proformas}
        loading={isLoading}
        actions={actions}
        emptyMessage="No hay proformas."
      />

      {viewProforma && (
        <div className={styles.overlay}>
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h2 className={styles.modalTitle}>Detalle de proforma</h2>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', margin: '1rem 0' }}>
              <dt style={{ fontWeight: 600 }}>Número</dt><dd>{viewProforma.number}</dd>
              <dt style={{ fontWeight: 600 }}>Cliente</dt><dd>{viewProforma.clientName}</dd>
              <dt style={{ fontWeight: 600 }}>Total</dt><dd>${viewProforma.total.toFixed(2)}</dd>
              <dt style={{ fontWeight: 600 }}>Estado</dt><dd>{STATUS_LABELS[viewProforma.status]}</dd>
              <dt style={{ fontWeight: 600 }}>Emitida</dt><dd>{formatDate(viewProforma.issuedAt)}</dd>
              <dt style={{ fontWeight: 600 }}>Válida hasta</dt><dd>{formatDate(viewProforma.validUntil)}</dd>
              {viewProforma.notes && (
                <>
                  <dt style={{ fontWeight: 600 }}>Notas</dt><dd>{viewProforma.notes}</dd>
                </>
              )}
            </dl>
            {viewProforma.items && viewProforma.items.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Ítems</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', borderBottom: '1px solid #e5e7eb' }}>Descripción</th>
                      <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', borderBottom: '1px solid #e5e7eb' }}>Cant.</th>
                      <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', borderBottom: '1px solid #e5e7eb' }}>P. Unit.</th>
                      <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', borderBottom: '1px solid #e5e7eb' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewProforma.items.map((item, i) => (
                      <tr key={i}>
                        <td style={{ padding: '0.25rem 0.5rem' }}>{item.description}</td>
                        <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>{item.quantity}</td>
                        <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>${item.unitPrice.toFixed(2)}</td>
                        <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>${item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className={styles.modalActions}>
              <button className={styles.btnPrimary} onClick={() => setViewProforma(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className={styles.overlay}>
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h2 className={styles.modalTitle}>Nueva proforma</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="pro-client">Cliente</label>
                <input
                  id="pro-client"
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="pro-item-desc">Descripción del ítem</label>
                <input
                  id="pro-item-desc"
                  type="text"
                  value={itemDesc}
                  onChange={e => setItemDesc(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="pro-item-qty">Cantidad</label>
                <input
                  id="pro-item-qty"
                  type="number"
                  value={itemQty}
                  onChange={e => setItemQty(Number(e.target.value))}
                  min={1}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="pro-item-price">Precio unitario</label>
                <input
                  id="pro-item-price"
                  type="number"
                  value={itemPrice}
                  onChange={e => setItemPrice(Number(e.target.value))}
                  min={0}
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="pro-valid-until">Válida hasta</label>
                <input
                  id="pro-valid-until"
                  type="date"
                  value={validUntil}
                  onChange={e => setValidUntil(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="pro-notes">Notas</label>
                <textarea
                  id="pro-notes"
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
                  Crear proforma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
