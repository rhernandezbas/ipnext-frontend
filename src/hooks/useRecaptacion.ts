import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listRecaptureLeads,
  getRecaptureLead,
  claimRecaptureLead,
  claimNextRecaptureLead,
  releaseRecaptureLead,
  updateRecaptureLeadStatus,
  addRecaptureContact,
  isLeadConflictError,
  ingestChurnedClients,
  importCsvLeads,
  downloadCsvTemplate,
} from '@/api/recaptacion.api';
import type { RecaptureLeadsQuery, AddContactInput } from '@/types/recaptacion';

/** User-facing message for the 409 (another operator already took the lead). */
export const CLAIM_CONFLICT_MESSAGE = 'Este lead ya fue tomado por otro operador.';

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
    mutationFn: async (id: string) => {
      try {
        return await claimRecaptureLead(id);
      } catch (err) {
        // 409 = another operator already claimed it. Re-throw as a clean,
        // user-facing error so the UI can show a precise message.
        if (isLeadConflictError(err)) throw new Error(CLAIM_CONFLICT_MESSAGE);
        throw err;
      }
    },
    // Invalidate on BOTH outcomes: on a 409 the lead is no longer free, so the
    // list/detail must refresh to stop showing it as available.
    onSettled: (_data, _err, id) => {
      void qc.invalidateQueries({ queryKey: ['recaptacion'] });
      void qc.invalidateQueries({ queryKey: recaptacionLeadKey(id) });
    },
  });
}

export function useClaimNext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => claimNextRecaptureLead(),
    // Invalidate on both outcomes so a lost race refreshes the list anyway.
    onSettled: (lead) => {
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
    onSettled: (_data, _err, id) => {
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

export function useIngestChurned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => ingestChurnedClients(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recaptacion'] });
    },
  });
}

export function useImportCsvLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) => importCsvLeads(csv),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recaptacion'] });
    },
  });
}

/**
 * Triggers a browser download of the CSV template.
 * Not a hook — call directly from click handlers.
 */
export async function downloadRecaptureCsvTemplate(): Promise<void> {
  const blob = await downloadCsvTemplate();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'recaptacion-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}
