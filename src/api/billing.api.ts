import axiosClient from './axios-client';
import type { Invoice, Payment, Transaction, BillingSummary, MonthlyBilling, CreditNote, ProformaInvoice, FinanceHistoryEvent } from '@/types/billing';
import type { PaginatedResponse } from '@/types/api';

export interface InvoicesQuery {
  page?: number;
  limit?: number;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface PaymentsQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface TransactionsQuery {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}

export async function getBillingSummary(): Promise<BillingSummary> {
  const response = await axiosClient.get<BillingSummary>('/billing/summary');
  return response.data;
}

export async function getInvoices(
  query: InvoicesQuery = {}
): Promise<PaginatedResponse<Invoice>> {
  const { limit, ...rest } = query;
  const response = await axiosClient.get<PaginatedResponse<Invoice>>('/billing/invoices', {
    params: { ...rest, pageSize: limit },
  });
  return response.data;
}

export async function getInvoiceById(id: number): Promise<Invoice> {
  const response = await axiosClient.get<Invoice>(`/billing/invoices/${id}`);
  return response.data;
}

export async function getPayments(
  query: PaymentsQuery = {}
): Promise<PaginatedResponse<Payment>> {
  const { limit, ...rest } = query;
  const response = await axiosClient.get<PaginatedResponse<Payment>>('/billing/payments', {
    params: { ...rest, pageSize: limit },
  });
  return response.data;
}

export async function getMonthlyBilling(): Promise<MonthlyBilling> {
  const response = await axiosClient.get<MonthlyBilling>('/billing/monthly');
  return response.data;
}

export async function getTransactions(
  query: TransactionsQuery = {}
): Promise<PaginatedResponse<Transaction>> {
  const { limit, ...rest } = query;
  const response = await axiosClient.get<PaginatedResponse<Transaction>>(
    '/billing/transactions',
    { params: { ...rest, pageSize: limit } }
  );
  return response.data;
}

// Credit Notes
export async function getCreditNotes(): Promise<CreditNote[]> {
  const response = await axiosClient.get<CreditNote[]>('/billing/credit-notes');
  return response.data;
}

export async function createCreditNote(data: Omit<CreditNote, 'id' | 'status' | 'appliedAt'>): Promise<CreditNote> {
  const response = await axiosClient.post<CreditNote>('/billing/credit-notes', data);
  return response.data;
}

export async function applyCreditNote(id: string): Promise<CreditNote> {
  const response = await axiosClient.post<CreditNote>(`/billing/credit-notes/${id}/apply`);
  return response.data;
}

export async function voidCreditNote(id: string): Promise<CreditNote> {
  const response = await axiosClient.post<CreditNote>(`/billing/credit-notes/${id}/void`);
  return response.data;
}

// Proformas
export async function getProformas(): Promise<ProformaInvoice[]> {
  const response = await axiosClient.get<ProformaInvoice[]>('/billing/proformas');
  return response.data;
}

export async function createProforma(data: Omit<ProformaInvoice, 'id' | 'status' | 'convertedToInvoiceId'>): Promise<ProformaInvoice> {
  const response = await axiosClient.post<ProformaInvoice>('/billing/proformas', data);
  return response.data;
}

export async function cancelProforma(id: string): Promise<ProformaInvoice> {
  const response = await axiosClient.post<ProformaInvoice>(`/billing/proformas/${id}/cancel`);
  return response.data;
}

export async function convertToInvoice(id: string): Promise<ProformaInvoice> {
  const response = await axiosClient.post<ProformaInvoice>(`/billing/proformas/${id}/convert`);
  return response.data;
}

// Finance History
export interface FinanceHistoryQuery {
  clientId?: string;
  from?: string;
  to?: string;
}

export async function getFinanceHistory(query: FinanceHistoryQuery = {}): Promise<FinanceHistoryEvent[]> {
  const response = await axiosClient.get<FinanceHistoryEvent[]>('/billing/history', { params: query });
  return response.data;
}
