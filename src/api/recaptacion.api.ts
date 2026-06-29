import axiosClient from './axios-client';
import type {
  RecaptureLeadDto,
  RecaptureLeadDetailDto,
  RecaptureContactDto,
  RecaptureLeadsQuery,
  AddContactInput,
  RecapturePaginatedResult,
} from '@/types/recaptacion';

/** GET /recapture/leads — paginated lead list */
export async function listRecaptureLeads(
  params: RecaptureLeadsQuery = {},
): Promise<RecapturePaginatedResult<RecaptureLeadDto>> {
  // Remove empty strings so the BE does not receive empty filter values
  const clean: Record<string, unknown> = {};
  if (params.status)      clean['status']      = params.status;
  if (params.source)      clean['source']      = params.source;
  if (params.assigneeId)  clean['assigneeId']  = params.assigneeId;
  if (params.unassigned)  clean['unassigned']  = 'true';
  if (params.technology)  clean['technology']  = params.technology;
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

/** PATCH /recapture/leads/:id — update status */
export async function updateRecaptureLeadStatus(
  id: string,
  status: string,
): Promise<RecaptureLeadDto> {
  const response = await axiosClient.patch<RecaptureLeadDto>(`/recapture/leads/${id}`, { status });
  return response.data;
}

/** PATCH /recapture/leads/:id/assign — assign (or unassign when null) */
export async function assignRecaptureLead(
  id: string,
  operatorId: string | null,
): Promise<RecaptureLeadDto> {
  const response = await axiosClient.patch<RecaptureLeadDto>(
    `/recapture/leads/${id}/assign`,
    { operatorId },
  );
  return response.data;
}

/**
 * PATCH /recapture/leads/assign-bulk — assign (or unassign when null) many leads
 * at once. Returns the number actually assigned, which MAY be less than the
 * number requested (the BE skips leads it could not assign).
 */
export async function assignBulkRecaptureLeads(input: {
  leadIds: string[];
  operatorId: string | null;
}): Promise<{ assigned: number }> {
  const response = await axiosClient.patch<{ assigned: number }>(
    '/recapture/leads/assign-bulk',
    input,
  );
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
