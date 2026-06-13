import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listRecaptureLeads,
  getRecaptureLead,
  claimRecaptureLead,
  claimNextRecaptureLead,
  releaseRecaptureLead,
  updateRecaptureLeadStatus,
  addRecaptureContact,
} from '@/api/recaptacion.api';
import type { RecaptureLeadsQuery, AddContactInput } from '@/types/recaptacion';

// ── Query keys ───────────────────────────────────────────────────────────────

export function recaptacionLeadsKey(query: RecaptureLeadsQuery) {
  return ['recaptacion', query] as const;
}

export function recaptacionLeadKey(id: string) {
  return ['recaptacion-lead', id] as const;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useRecaptacionLeads(query: RecaptureLeadsQuery) {
  return useQuery({
    queryKey: recaptacionLeadsKey(query),
    queryFn: () => listRecaptureLeads(query),
    staleTime: 30_000,
  });
}

export function useRecaptacionLead(id: string | null) {
  return useQuery({
    queryKey: recaptacionLeadKey(id ?? ''),
    queryFn: () => getRecaptureLead(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useClaimLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => claimRecaptureLead(id),
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: ['recaptacion'] });
      void qc.invalidateQueries({ queryKey: recaptacionLeadKey(id) });
    },
  });
}

export function useClaimNext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => claimNextRecaptureLead(),
    onSuccess: (lead) => {
      void qc.invalidateQueries({ queryKey: ['recaptacion'] });
      if (lead) {
        void qc.invalidateQueries({ queryKey: recaptacionLeadKey(lead.id) });
      }
    },
  });
}

export function useReleaseLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => releaseRecaptureLead(id),
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: ['recaptacion'] });
      void qc.invalidateQueries({ queryKey: recaptacionLeadKey(id) });
    },
  });
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateRecaptureLeadStatus(id, status),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: ['recaptacion'] });
      void qc.invalidateQueries({ queryKey: recaptacionLeadKey(id) });
    },
  });
}

export function useAddContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, body }: { leadId: string; body: AddContactInput }) =>
      addRecaptureContact(leadId, body),
    onSuccess: (_, { leadId }) => {
      void qc.invalidateQueries({ queryKey: ['recaptacion'] });
      void qc.invalidateQueries({ queryKey: recaptacionLeadKey(leadId) });
    },
  });
}
