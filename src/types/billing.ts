export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

/**
 * Status of a per-client invoice synced from Gestión Real (GR).
 * The BE serializes these three Spanish values verbatim (gr-invoices-sync).
 */
export type ClientInvoiceStatus = 'pagada' | 'pendiente' | 'vencida';

/**
 * Per-client invoice returned by `GET /clients/:id/invoices` — the exact BE
 * `InvoiceDto` contract for the GR sync (gr-invoices-sync). Consume verbatim.
 *
 * DISTINCT bounded context from the admin `Invoice` below: that one is the
 * `/billing/invoices` list (line items, customerName, 5 draft/sent/... states)
 * powering FacturasPage. This one is a read-only GR-synced summary with GR
 * document links (pdf / coupon / MercadoPago). Keeping them as separate types
 * is deliberate — collapsing them would break the admin billing subsystem.
 */
export interface ClientInvoice {
  id: string;
  number: string;
  grType: string | null;
  amount: number;
  balance: number;
  currency: string | null;
  status: ClientInvoiceStatus;
  issueDate: string; // ISO
  dueDate: string; // ISO
  pdfUrl: string | null;
  couponPdfUrl: string | null;
  paymentUrl: string | null;
}

export interface Invoice {
  id: number;
  number: string;
  customerId: number;
  customerName: string;
  amount: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Payment {
  id: number;
  customerId: number;
  customerName: string;
  invoiceId: number | null;
  amount: number;
  method: string;
  reference: string | null;
  date: string;
  notes: string | null;
}

export interface Transaction {
  id: number;
  customerId: number;
  customerName: string;
  type: 'credit' | 'debit';
  amount: number;
  balance: number;
  description: string;
  date: string;
  invoiceId: number | null;
  paymentId: number | null;
}

export interface BillingSummary {
  totalRevenue: number;
  pendingAmount: number;
  overdueAmount: number;
  paidThisMonth: number;
  invoiceCount: number;
  overdueCount: number;
  creditNotesAmount: number;
  proformaPaidAmount: number;
  proformaUnpaidAmount: number;
}

export interface MonthlyPeriod {
  period: string;
  label: string;
  invoiced: number;
  paid: number;
}

export interface MonthlyBilling {
  lastMonth: MonthlyPeriod;
  currentMonth: MonthlyPeriod;
  nextMonth: MonthlyPeriod;
}

export type CreditNoteStatus = 'draft' | 'sent' | 'applied' | 'voided';

export interface CreditNote {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  reason: string;
  relatedInvoiceId: string | null;
  status: CreditNoteStatus;
  issuedAt: string;
  appliedAt: string | null;
  notes: string;
}

export type ProformaStatus = 'draft' | 'sent' | 'paid' | 'cancelled' | 'expired';

export interface ProformaInvoice {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  taxAmount: number;
  total: number;
  status: ProformaStatus;
  issuedAt: string;
  validUntil: string;
  convertedToInvoiceId: string | null;
  notes: string;
}

export type FinanceEventType =
  | 'invoice_created'
  | 'invoice_paid'
  | 'payment_received'
  | 'credit_note_applied'
  | 'refund'
  | 'late_fee'
  | 'plan_changed'
  | 'service_activated'
  | 'service_deactivated';

export interface FinanceHistoryEvent {
  id: string;
  type: FinanceEventType;
  description: string;
  clientId: string;
  clientName: string;
  amount: number | null;
  referenceId: string | null;
  adminId: string;
  adminName: string;
  occurredAt: string;
}
