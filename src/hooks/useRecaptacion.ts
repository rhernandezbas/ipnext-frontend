import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listRecaptureLeads,
  getRecaptureLead,
  updateRecaptureLeadStatus,
  addRecaptureContact,
  assignRecaptureLead,
  assignBulkRecaptureLeads,
  ingestChurnedClients,
  importCsvLeads,
  downloadCsvTemplate,
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

export function useAssignLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, operatorId }: { leadId: string; operatorId: string | null }) =>
      assignRecaptureLead(leadId, operatorId),
    onSuccess: (_, { leadId }) => {
      void qc.invalidateQueries({ queryKey: ['recaptacion'] });
      void qc.invalidateQueries({ queryKey: recaptacionLeadKey(leadId) });
    },
  });
}

/**
 * Admin bulk-assign: assign (or unassign when operatorId is null) many leads at
 * once. Resolves to `{ assigned }` — the real count the BE applied, which MAY be
 * less than the number requested. Invalidates the leads list so all visible rows
 * refresh.
 */
export function useAssignBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { leadIds: string[]; operatorId: string | null }) =>
      assignBulkRecaptureLeads(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recaptacion'] });
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
