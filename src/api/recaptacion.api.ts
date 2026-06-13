import axios from 'axios';
import axiosClient from './axios-client';
import type {
  RecaptureLeadDto,
  RecaptureLeadDetailDto,
  RecaptureContactDto,
  RecaptureLeadsQuery,
  AddContactInput,
  RecapturePaginatedResult,
} from '@/types/recaptacion';

/**
 * True when the error is a 409 conflict from a claim/release — i.e. another
 * operator already took (or freed) the lead. This is expected business state,
 * not a failure, and callers handle it with explicit feedback + a refresh.
 */
export function isLeadConflictError(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 409;
}

/** GET /recapture/leads — paginated lead list */
export async function listRecaptureLeads(
  params: RecaptureLeadsQuery = {},
): Promise<RecapturePaginatedResult<RecaptureLeadDto>> {
  // Remove empty strings so the BE does not receive empty filter values
  const clean: Record<string, unknown> = {};
  if (params.status)      clean['status']      = params.status;
  if (params.assigneeId)  clean['assigneeId']  = params.assigneeId;
  if (params.unassigned)  clean['unassigned']  = 'true';
  if (params.page)        clean['page']        = params.page;
  if (params.limit)       clean['limit']       = params.limit;

  const response = await axiosClient.get<RecapturePaginatedResult<RecaptureLeadDto>>(
    '/recapture/leads',
    { params: clean },
  );
  return response.data;
}

/** GET /recapture/leads/:id — single lead with contacts */
export async function getRecaptureLead(id: string): Promise<RecaptureLeadDetailDto> {
  const response = await axiosClient.get<RecaptureLeadDetailDto>(`/recapture/leads/${id}`);
  return response.data;
}

/** POST /recapture/leads/:id/claim — 200 on success, 409 if already claimed */
export async function claimRecaptureLead(id: string): Promise<RecaptureLeadDto> {
  const response = await axiosClient.post<RecaptureLeadDto>(`/recapture/leads/${id}/claim`);
  return response.data;
}

/**
 * POST /recapture/leads/claim-next
 * Returns the claimed lead, or null when the BE responds 204 (no free leads).
 */
export async function claimNextRecaptureLead(): Promise<RecaptureLeadDto | null> {
  const response = await axiosClient.post<RecaptureLeadDto | null>(
    '/recapture/leads/claim-next',
    null,
    { validateStatus: (s) => s === 200 || s === 204 },
  );
  if (response.status === 204) return null;
  return response.data;
}

/** POST /recapture/leads/:id/release */
export async function releaseRecaptureLead(id: string): Promise<RecaptureLeadDto> {
  const response = await axiosClient.post<RecaptureLeadDto>(`/recapture/leads/${id}/release`);
  return response.data;
}

/** PATCH /recapture/leads/:id — update status */
export async function updateRecaptureLeadStatus(
  id: string,
  status: string,
): Promise<RecaptureLeadDto> {
  const response = await axiosClient.patch<RecaptureLeadDto>(`/recapture/leads/${id}`, { status });
  return response.data;
}

/** POST /recapture/leads/:id/contacts — register a contact attempt */
export async function addRecaptureContact(
  leadId: string,
  body: AddContactInput,
): Promise<RecaptureContactDto> {
  const response = await axiosClient.post<RecaptureContactDto>(
    `/recapture/leads/${leadId}/contacts`,
    body,
  );
  return response.data;
}

/** POST /recapture/ingest-churned — seed leads from churned clients */
export async function ingestChurnedClients(): Promise<{ created: number; skipped: number }> {
  const response = await axiosClient.post<{ created: number; skipped: number }>(
    '/recapture/ingest-churned',
  );
  return response.data;
}

/** POST /recapture/import-csv — bulk-import leads from a CSV string */
export async function importCsvLeads(
  csv: string,
): Promise<{ created: number; errors: string[] }> {
  const response = await axiosClient.post<{ created: number; errors: string[] }>(
    '/recapture/import-csv',
    { csv },
  );
  return response.data;
}

/** GET /recapture/import-csv/template — download the CSV template as a Blob */
export async function downloadCsvTemplate(): Promise<Blob> {
  const response = await axiosClient.get<Blob>('/recapture/import-csv/template', {
    responseType: 'blob',
  });
  return response.data;
}
