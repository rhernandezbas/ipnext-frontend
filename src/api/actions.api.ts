import axiosClient from './axios-client';
import type {
  ActionsPaginatedResult,
  OwnershipCaseDto,
  OwnershipCaseMutationResult,
  OwnershipCasesQuery,
  RecentBajaDto,
  RecentBajasQuery,
  UpdateOwnershipCaseBody,
} from '@/types/actions';

/**
 * actions-worklist (EPIC Titularidad & bajas F2) — cliente del router
 * `/api/actions`. Tres endpoints: listar casos de titularidad (checks AUTO
 * computados en el BE), patchear un caso (UN discriminador por request) y
 * listar bajas recientes con su retiro-check.
 */

/** GET /actions/ownership-cases — casos de cambio de titularidad, paginados. */
export async function listOwnershipCases(
  params: OwnershipCasesQuery = {},
): Promise<ActionsPaginatedResult<OwnershipCaseDto>> {
  // Solo mandamos filtros con valor — nada de strings vacíos al BE.
  const clean: Record<string, unknown> = {};
  if (params.status)   clean['status']   = params.status;
  if (params.page)     clean['page']     = params.page;
  if (params.pageSize) clean['pageSize'] = params.pageSize;

  const response = await axiosClient.get<ActionsPaginatedResult<OwnershipCaseDto>>(
    '/actions/ownership-cases',
    { params: clean },
  );
  return response.data;
}

/**
 * PATCH /actions/ownership-cases/:id — body con EXACTAMENTE UN discriminador:
 * `{equipmentReviewed}` | `{targetContractId}` (pick en ambiguous, RE-pick en
 * pending con candidates, o SET-target validado contra el mirror en pending
 * sin target ni candidates) | `{status:'dismissed', reason}` |
 * `{status:'pending'}` (reopen desde dismissed; con candidates vuelve a
 * ambiguous y limpia el target heredado).
 *
 * OJO con la respuesta: el BE devuelve la ENTIDAD de dominio cruda, no el DTO
 * de lectura — la mutación descarta el body e invalida ['actions'].
 *
 * Errores: 404 OWNERSHIP_CASE_NOT_FOUND · 422 INVALID_CANDIDATE_PICK /
 * INVALID_TARGET_ASSIGNMENT / INVALID_CASE_TRANSITION · 400
 * DISMISS_REASON_REQUIRED.
 */
export async function updateOwnershipCase(
  id: string,
  body: UpdateOwnershipCaseBody,
): Promise<OwnershipCaseMutationResult> {
  const response = await axiosClient.patch<OwnershipCaseMutationResult>(
    `/actions/ownership-cases/${id}`,
    body,
  );
  return response.data;
}

/** GET /actions/recent-bajas — bajas recientes (excluye titularidad) con retiro-check. */
export async function listRecentBajas(
  params: RecentBajasQuery = {},
): Promise<ActionsPaginatedResult<RecentBajaDto>> {
  const clean: Record<string, unknown> = {};
  if (params.page)     clean['page']     = params.page;
  if (params.pageSize) clean['pageSize'] = params.pageSize;

  const response = await axiosClient.get<ActionsPaginatedResult<RecentBajaDto>>(
    '/actions/recent-bajas',
    { params: clean },
  );
  return response.data;
}
