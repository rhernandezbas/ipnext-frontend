import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axiosClient from '@/api/axios-client';
import {
  getBillingSummary,
  getMonthlyBilling,
  getInvoices,
  getPayments,
  getTransactions,
  getCreditNotes,
  createCreditNote,
  applyCreditNote,
  voidCreditNote,
  getProformas,
  createProforma,
  cancelProforma,
  convertToInvoice,
  getFinanceHistory,
  InvoicesQuery,
  PaymentsQuery,
  TransactionsQuery,
  FinanceHistoryQuery,
} from '../api/billing.api';

export function useBillingSummary() {
  return useQuery({
    queryKey: ['billing-summary'],
    queryFn: getBillingSummary,
    staleTime: 60_000,
  });
}

export function useMonthlyBilling() {
  return useQuery({
    queryKey: ['billing-monthly'],
    queryFn: getMonthlyBilling,
    staleTime: 60_000,
  });
}

export function useInvoices(query: InvoicesQuery) {
  return useQuery({
    queryKey: ['invoices', query],
    queryFn: () => getInvoices(query),
    staleTime: 30_000,
  });
}

export function usePayments(query: PaymentsQuery) {
  return useQuery({
    queryKey: ['payments', query],
    queryFn: () => getPayments(query),
    staleTime: 30_000,
  });
}

export function useTransactions(query: TransactionsQuery) {
  return useQuery({
    queryKey: ['transactions', query],
    queryFn: () => getTransactions(query),
    staleTime: 30_000,
  });
}

export function useCreditNotes() {
  return useQuery({
    queryKey: ['credit-notes'],
    queryFn: getCreditNotes,
    staleTime: 30_000,
  });
}

export function useCreateCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCreditNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credit-notes'] }),
  });
}

export function useApplyCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: applyCreditNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credit-notes'] }),
  });
}

export function useVoidCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: voidCreditNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credit-notes'] }),
  });
}

export function useProformas() {
  return useQuery({
    queryKey: ['proformas'],
    queryFn: getProformas,
    staleTime: 30_000,
  });
}

export function useCreateProforma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProforma,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proformas'] }),
  });
}

export function useCancelProforma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelProforma,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proformas'] }),
  });
}

export function useConvertToInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: convertToInvoice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proformas'] }),
  });
}

export function useFinanceHistory(query: FinanceHistoryQuery = {}) {
  return useQuery({
    queryKey: ['finance-history', query],
    queryFn: () => getFinanceHistory(query),
    staleTime: 30_000,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      customerName: string;
      issuedAt: string;
      dueAt: string;
      total: number;
      concept?: string;
      status?: string;
    }) => axiosClient.post('/billing/invoices', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      customerName: string;
      amount: number;
      date: string;
      method?: string;
      reference?: string;
    }) => axiosClient.post('/billing/payments', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

export function useSendInvoiceEmail() {
  return useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      axiosClient.post(`/billing/invoices/${id}/send-email`, { email }).then(r => r.data),
  });
}
