export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

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
