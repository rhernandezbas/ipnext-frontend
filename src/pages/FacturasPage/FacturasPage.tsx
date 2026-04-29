import { useState } from 'react';
import { FilterBar } from '../../components/molecules/FilterBar/FilterBar';
import { Pagination } from '../../components/molecules/Pagination/Pagination';
import { DataTable } from '../../components/organisms/DataTable/DataTable';
import { StatusBadge } from '../../components/atoms/StatusBadge/StatusBadge';
import { useInvoices, useCreateInvoice, useSendInvoiceEmail } from '../../hooks/useBilling';
import { Invoice, InvoiceStatus } from '../../types/billing';
import styles from './FacturasPage.module.css';

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'paid', label: 'Pagada' },
  { value: 'sent', label: 'Pendiente' },
  { value: 'overdue', label: 'Vencida' },
  { value: 'draft', label: 'Borrador' },
  { value: 'cancelled', label: 'Cancelada' },
];

type BadgeStatus = 'active' | 'late' | 'blocked' | 'inactive';

const invoiceStatusMap: Record<InvoiceStatus, BadgeStatus> = {
  paid: 'active',
  sent: 'inactive',
  overdue: 'late',
  draft: 'inactive',
  cancelled: 'blocked',
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  paid: 'Pagada',
  sent: 'Pendiente',
  overdue: 'Vencida',
  draft: 'Borrador',
  cancelled: 'Cancelada',
};

function formatArgDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR');
}

function printInvoice(invoice: Invoice) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <html>
    <head>
      <title>Factura ${invoice.number}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
        h1 { color: #4f46e5; }
        .header { display: flex; justify-content: space-between; margin-bottom: 2rem; }
        .label { font-size: 12px; color: #666; text-transform: uppercase; }
        .value { font-size: 16px; font-weight: 600; }
        .total { font-size: 24px; font-weight: bold; color: #4f46e5; margin-top: 2rem; }
        .divider { border-top: 2px solid #e5e7eb; margin: 1rem 0; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div><h1>IPNEXT</h1><p>Sistema de Gestión ISP</p></div>
        <div><h2>FACTURA</h2><p>${invoice.number}</p></div>
      </div>
      <div class="divider"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1rem 0">
        <div><div class="label">Cliente</div><div class="value">${invoice.customerName}</div></div>
        <div><div class="label">Estado</div><div class="value">${invoice.status}</div></div>
        <div><div class="label">Fecha de emisión</div><div class="value">${invoice.issuedAt}</div></div>
        <div><div class="label">Vencimiento</div><div class="value">${invoice.dueAt}</div></div>
      </div>
      <div class="divider"></div>
      <div class="total">Total: $${invoice.total.toFixed(2)}</div>
      <p style="margin-top:3rem;font-size:12px;color:#999">Generado por IPNEXT — ${new Date().toLocaleDateString('es-AR')}</p>
    </body>
    </html>
  `);
  win.document.close();
  win.print();
}

function exportToCSV(rows: Invoice[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]).join(',');
  const csv = [headers, ...rows.map((r) => Object.values(r).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const COLUMNS = [
  { label: 'Número', key: 'number' as keyof Invoice },
  { label: 'Cliente', key: 'customerName' as keyof Invoice },
  {
    label: 'Fecha de emisión',
    key: 'issuedAt' as keyof Invoice,
    render: (row: Invoice) => formatArgDate(row.issuedAt),
  },
  {
    label: 'Vencimiento',
    key: 'dueAt' as keyof Invoice,
    render: (row: Invoice) => formatArgDate(row.dueAt),
  },
  {
    label: 'Monto',
    key: 'total' as keyof Invoice,
    render: (row: Invoice) => `$${row.total.toFixed(2)}`,
  },
  {
    label: 'Estado',
    key: 'status' as keyof Invoice,
    render: (row: Invoice) => (
      <StatusBadge status={invoiceStatusMap[row.status]} />
    ),
  },
];

export function FacturasPage() {
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [emailInput, setEmailInput] = useState('');

  const createInvoice = useCreateInvoice();
  const sendEmail = useSendInvoiceEmail();

  const { data, isLoading } = useInvoices({
    page,
    limit: 25,
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    search: search || undefined,
  });
  const totalPages = data ? Math.ceil(data.total / 25) : 1;

  const filters = [{ key: 'status', label: 'Estado', options: STATUS_FILTERS }];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Facturas</h1>
      <div className={styles.actionsBar}>
        <button
          className={styles.exportBtn}
          onClick={() => exportToCSV(data?.data ?? [], 'facturas.csv')}
        >
          Exportar
        </button>
        <button className={styles.exportBtn} onClick={() => setShowNewForm(true)}>
          Nueva factura
        </button>
      </div>
      <div className={styles.filterRow}>
        <FilterBar
          onSearch={(v) => { setSearch(v); setPage(1); }}
          filters={filters}
          onFilterChange={(_, v) => {
            setStatus(v);
            setPage(1);
          }}
        />
        <div className={styles.dateFilters}>
          <label className={styles.dateLabel}>Desde</label>
          <input
            type="date"
            className={styles.dateInput}
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
          <label className={styles.dateLabel}>Hasta</label>
          <input
            type="date"
            className={styles.dateInput}
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      <DataTable
        columns={COLUMNS}
        data={data?.data ?? []}
        loading={isLoading}
        actions={[{ label: 'Ver detalle', onClick: (row) => setSelectedInvoice(row) }]}
        emptyMessage="No hay facturas."
        totals={{
          number: 'Total',
          status: `${data?.data?.length ?? 0} facturas`,
        }}
      />
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      {showNewForm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Nueva factura</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setFormError('');
                const fd = new FormData(e.currentTarget);
                createInvoice.mutate(
                  {
                    customerName: fd.get('customerName') as string,
                    issuedAt: fd.get('issuedAt') as string,
                    dueAt: fd.get('dueAt') as string,
                    total: Number(fd.get('total')),
                    concept: fd.get('concept') as string,
                    status: fd.get('status') as string,
                  },
                  {
                    onSuccess: () => setShowNewForm(false),
                    onError: () => setFormError('Error al crear la factura.'),
                  }
                );
              }}
            >
              <div className={styles.formGroup}>
                <label htmlFor="customerName">Nombre del cliente</label>
                <input id="customerName" name="customerName" required disabled={createInvoice.isPending} />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="issuedAt">Fecha de emisión</label>
                <input id="issuedAt" name="issuedAt" type="date" required disabled={createInvoice.isPending} />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="dueAt">Vencimiento</label>
                <input id="dueAt" name="dueAt" type="date" required disabled={createInvoice.isPending} />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="total">Monto</label>
                <input id="total" name="total" type="number" required disabled={createInvoice.isPending} />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="concept">Concepto</label>
                <textarea id="concept" name="concept" disabled={createInvoice.isPending} />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="status">Estado</label>
                <select id="status" name="status" disabled={createInvoice.isPending}>
                  <option value="draft">Borrador</option>
                  <option value="sent">Pendiente</option>
                  <option value="paid">Pagada</option>
                </select>
              </div>
              {formError && <p>{formError}</p>}
              <div className={styles.actionsBar}>
                <button type="submit" disabled={createInvoice.isPending}>Crear factura</button>
                <button type="button" onClick={() => setShowNewForm(false)} disabled={createInvoice.isPending}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedInvoice && (
        <div className={styles.overlay} onClick={() => setSelectedInvoice(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h2 className={styles.drawerTitle}>Factura #{selectedInvoice.number}</h2>
              <button
                className={styles.closeBtn}
                onClick={() => setSelectedInvoice(null)}
              >
                ✕
              </button>
            </div>
            <dl className={styles.detailList}>
              <div className={styles.detailField}>
                <dt>Cliente</dt>
                <dd>{selectedInvoice.customerName}</dd>
              </div>
              <div className={styles.detailField}>
                <dt>Fecha de emisión</dt>
                <dd>{selectedInvoice.issuedAt}</dd>
              </div>
              <div className={styles.detailField}>
                <dt>Vencimiento</dt>
                <dd>{selectedInvoice.dueAt}</dd>
              </div>
              <div className={styles.detailField}>
                <dt>Monto</dt>
                <dd>${selectedInvoice.total.toFixed(2)}</dd>
              </div>
              <div className={styles.detailField}>
                <dt>Estado</dt>
                <dd>
                  <StatusBadge status={invoiceStatusMap[selectedInvoice.status]} />
                  <span className={styles.statusLabel}>
                    {STATUS_LABELS[selectedInvoice.status]}
                  </span>
                </dd>
              </div>
            </dl>
            {selectedInvoice.items.length > 0 && (
              <table className={styles.lineItems}>
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Cant.</th>
                    <th>Precio unit.</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items.map((li) => (
                    <tr key={li.id}>
                      <td>{li.description}</td>
                      <td>{li.quantity}</td>
                      <td>${li.unitPrice.toFixed(2)}</td>
                      <td>${li.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className={styles.actionsBar}>
              <button onClick={() => printInvoice(selectedInvoice)}>Descargar PDF</button>
            </div>
            <div>
              <input
                type="email"
                placeholder="Email del cliente"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
              <button
                onClick={() => sendEmail.mutate(
                  { id: String(selectedInvoice.id), email: emailInput },
                  { onSuccess: () => { setEmailInput(''); alert('Email enviado correctamente'); } }
                )}
                disabled={!emailInput || sendEmail.isPending}
              >
                {sendEmail.isPending ? 'Enviando...' : 'Enviar por email'}
              </button>
              {sendEmail.isError && <p>Error al enviar el email.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
