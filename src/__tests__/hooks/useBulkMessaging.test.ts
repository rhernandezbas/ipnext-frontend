/**
 * useBulkMessaging — hooks del Envío masivo WhatsApp (F2, apply chunk 1).
 * Un archivo, molde `useWhatsapp.ts` (convención del repo).
 *
 *  MBH-1 useTemplates(): queryKey ['messagingBulk','templates'], gateado por
 *        `enabled` (permiso `messaging.templates`, decisión del caller)
 *  MBH-2 usePreviewSegment(): mutation on-demand (NO se dispara sola, el
 *        composer la llama explícitamente en cada "Ver preview")
 *  MBH-3 useCreateCampaign(): mutation, invalida el listado de campañas al
 *        crear (para que Historial la vea sin esperar el poll); expone
 *        `missingVariablesError` (422 MISSING_TEMPLATE_VARIABLES, CAMP-4)
 *  MBH-4 useSendCampaign(): mutation por campaignId (vars, NO closure);
 *        invalida detalle+lista al resolver; detecta el 409
 *        CAMPAIGN_SEND_IN_PROGRESS y lo expone como `conflict`
 *  MBH-5 useCampaign(id): polling vía `campaignPollInterval` — 5s si
 *        'running', 30s si 'pending'/'paused' (bulk-detail-polling-fe Change
 *        A), false si 'done'/'failed' o la pestaña está oculta
 *        (useDocumentVisible)
 *  MBH-6 useCampaigns(query): queryKey ['messagingBulk','campaigns',query],
 *        pollea cada 30s gateado por useDocumentVisible (Change A — el
 *        historial también se refresca solo)
 *  MBH-7 useSegmentRecipients(segment,page,limit,enabled) (v1.1, BE en PROD):
 *        queryKey ['messagingBulk','segmentRecipients',segment,page,limit],
 *        gateado por `enabled`; `keepPreviousData` para paginar SIN flash de
 *        loading entre páginas
 *  MBH-9 campaignPollInterval(status,visible): función pura con la política
 *        de polling del detalle (extraída para testear todas las ramas)
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { AxiosError, AxiosHeaders } from 'axios';
import type {
  CampaignDto,
  CampaignSummaryDto,
  GetCampaignOutput,
  PaginatedResult,
  PreviewSegmentOutput,
  SegmentRecipientsOutput,
  TemplateSummaryDto,
} from '@/types/messagingBulk';

vi.mock('@/api/messagingBulk.api', () => ({
  listBulkTemplates: vi.fn(),
  previewSegment: vi.fn(),
  createCampaign: vi.fn(),
  sendCampaign: vi.fn(),
  getCampaign: vi.fn(),
  listCampaigns: vi.fn(),
  listSegmentRecipients: vi.fn(),
}));

vi.mock('@/hooks/useDocumentVisible', () => ({
  useDocumentVisible: vi.fn(),
}));

import {
  listBulkTemplates,
  previewSegment,
  createCampaign,
  sendCampaign,
  getCampaign,
  listCampaigns,
  listSegmentRecipients,
} from '@/api/messagingBulk.api';
import { useDocumentVisible } from '@/hooks/useDocumentVisible';
import {
  useTemplates,
  usePreviewSegment,
  useCreateCampaign,
  useSendCampaign,
  useCampaign,
  useCampaigns,
  useSegmentRecipients,
  bulkTemplatesKey,
  bulkCampaignsKey,
  bulkCampaignKey,
  campaignPollInterval,
} from '@/hooks/useBulkMessaging';

const TEMPLATE: TemplateSummaryDto = {
  contentSid: 'HX123',
  friendlyName: 'Recordatorio de pago',
  language: 'es',
  variables: ['1', '2'],
  approvalStatus: 'approved',
  sendable: true,
  body: 'Hola {{1}}, tu saldo de ${{2}} vence pronto.',
};

const PREVIEW: PreviewSegmentOutput = {
  count: 42,
  sample: [{ clientId: 'cli-1', name: 'Juan Perez', phoneE164: '+5491100000000', status: 'late' }],
  skipped: { optedOut: 1, duplicatePhone: 2, invalidPhone: 3 },
  statusCounts: { late: 42 },
};

function makeCampaignDto(overrides: Partial<CampaignDto> = {}): CampaignDto {
  return {
    id: 'camp-1',
    name: 'Recordatorio julio',
    templateName: 'Recordatorio de pago',
    status: 'pending',
    total: 42,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    optedOutCount: 0,
    createdAt: '2026-07-01T12:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    templateRef: 'HX123',
    segment: { statuses: ['late'] },
    ...overrides,
  };
}

const CAMPAIGN_SUMMARY: CampaignSummaryDto = {
  id: 'camp-1',
  name: 'Recordatorio julio',
  templateName: 'Recordatorio de pago',
  status: 'done',
  total: 42,
  sentCount: 42,
  failedCount: 0,
  skippedCount: 0,
  optedOutCount: 0,
  createdAt: '2026-07-01T12:00:00.000Z',
  startedAt: '2026-07-01T12:05:00.000Z',
  finishedAt: '2026-07-01T12:10:00.000Z',
};

const CAMPAIGNS_PAGE: PaginatedResult<CampaignSummaryDto> = {
  data: [CAMPAIGN_SUMMARY],
  total: 1,
  page: 1,
  limit: 20,
};

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

function makeConflictError(): AxiosError {
  const error = new AxiosError('Request failed with status code 409', 'ERR_BAD_REQUEST');
  error.response = {
    status: 409,
    statusText: 'Conflict',
    headers: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture mínimo de AxiosResponse
    config: { headers: new AxiosHeaders() } as any,
    data: {
      error: 'Ya hay un envío de campañas en curso (se procesa una campaña a la vez); reintentá cuando termine',
      code: 'CAMPAIGN_SEND_IN_PROGRESS',
    },
  };
  return error;
}

function makeMissingVariablesError(missing: string[]): AxiosError {
  const error = new AxiosError('Request failed with status code 422', 'ERR_BAD_REQUEST');
  error.response = {
    status: 422,
    statusText: 'Unprocessable Entity',
    headers: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture mínimo de AxiosResponse
    config: { headers: new AxiosHeaders() } as any,
    data: {
      error: 'Faltan variables del template por mapear',
      code: 'MISSING_TEMPLATE_VARIABLES',
      missing,
    },
  };
  return error;
}

/** manual-recipients-fe (ERR-1) — fixture genérico de error de create con status + body. */
function makeCreateError(status: number, data: Record<string, unknown>): AxiosError {
  const error = new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST');
  error.response = {
    status,
    statusText: 'Error',
    headers: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture mínimo de AxiosResponse
    config: { headers: new AxiosHeaders() } as any,
    data,
  };
  return error;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useDocumentVisible).mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MBH-1: useTemplates', () => {
  it('llama a listBulkTemplates y cachea bajo ["messagingBulk","templates"]', async () => {
    vi.mocked(listBulkTemplates).mockResolvedValue([TEMPLATE]);
    const { qc, wrapper } = makeWrapper();

    const { result } = renderHook(() => useTemplates(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([TEMPLATE]);
    expect(qc.getQueryData(bulkTemplatesKey)).toEqual([TEMPLATE]);
  });

  it('enabled:false (sin permiso messaging.templates) NO dispara el fetch', () => {
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useTemplates(false), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(listBulkTemplates).not.toHaveBeenCalled();
  });
});

describe('MBH-2: usePreviewSegment', () => {
  it('NO dispara solo — hace falta llamar a preview() explícitamente', () => {
    const { wrapper } = makeWrapper();

    renderHook(() => usePreviewSegment(), { wrapper });

    expect(previewSegment).not.toHaveBeenCalled();
  });

  it('preview(input) llama a previewSegment con el segmento y resuelve el output', async () => {
    vi.mocked(previewSegment).mockResolvedValue(PREVIEW);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => usePreviewSegment(), { wrapper });

    act(() => {
      result.current.preview({ statuses: ['late'] });
    });

    await waitFor(() => expect(result.current.data).toEqual(PREVIEW));
    expect(previewSegment).toHaveBeenCalledWith({ statuses: ['late'] });
  });
});

describe('MBH-3: useCreateCampaign', () => {
  it('create(input) llama a createCampaign e invalida el listado de campañas', async () => {
    vi.mocked(createCampaign).mockResolvedValue({ campaignId: 'camp-1', total: 42, status: 'pending' });
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreateCampaign(), { wrapper });

    act(() => {
      result.current.create({
        name: 'Recordatorio julio',
        templateRef: 'HX123',
        segment: { statuses: ['late'] },
        variablesMap: { '1': { source: 'name' } },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ campaignId: 'camp-1', total: 42, status: 'pending' });
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['messagingBulk', 'campaigns']) }),
    );
  });

  it('422 MISSING_TEMPLATE_VARIABLES se expone como `missingVariablesError` (CAMP-4)', async () => {
    vi.mocked(createCampaign).mockRejectedValue(makeMissingVariablesError(['2', '3']));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateCampaign(), { wrapper });

    act(() => {
      result.current.create({
        name: 'Recordatorio julio',
        templateRef: 'HX123',
        segment: { statuses: ['late'] },
        variablesMap: { '1': { source: 'name' } },
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.missingVariablesError).toEqual({
      code: 'MISSING_TEMPLATE_VARIABLES',
      message: 'Faltan variables del template por mapear',
      missing: ['2', '3'],
    });
  });

  it('sin error, `missingVariablesError` es null', () => {
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateCampaign(), { wrapper });

    expect(result.current.missingVariablesError).toBeNull();
  });
});

describe('MBH-8: useCreateCampaign — errores de manual recipients (ERR-1)', () => {
  const CREATE_INPUT = {
    name: 'Recordatorio julio',
    templateRef: 'HX123',
    segment: { statuses: [] as string[] },
    variablesMap: { '1': { source: 'name' as const } },
    manualClientIds: ['x', 'y'],
  };

  it('422 MANUAL_RECIPIENTS_NOT_FOUND se expone como `missingRecipientsError` con los ids', async () => {
    vi.mocked(createCampaign).mockRejectedValue(
      makeCreateError(422, {
        error: 'Algunos destinatarios ya no existen',
        code: 'MANUAL_RECIPIENTS_NOT_FOUND',
        missingClientIds: ['x', 'y'],
      }),
    );
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateCampaign(), { wrapper });
    act(() => result.current.create(CREATE_INPUT));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.missingRecipientsError).toEqual({
      code: 'MANUAL_RECIPIENTS_NOT_FOUND',
      message: 'Algunos destinatarios ya no existen',
      missingClientIds: ['x', 'y'],
    });
    // NO se duplica en el error genérico (lo maneja el error dedicado).
    expect(result.current.serverError).toBeNull();
  });

  it('422 TOO_MANY_MANUAL_RECIPIENTS → mensaje con el máximo de 5000', async () => {
    vi.mocked(createCampaign).mockRejectedValue(
      makeCreateError(422, { error: 'demasiados', code: 'TOO_MANY_MANUAL_RECIPIENTS' }),
    );
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateCampaign(), { wrapper });
    act(() => result.current.create(CREATE_INPUT));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.serverError).toMatch(/5000/);
    expect(result.current.missingRecipientsError).toBeNull();
  });

  it('400 VALIDATION_ERROR → mensaje de validación genérico', async () => {
    vi.mocked(createCampaign).mockRejectedValue(
      makeCreateError(400, { error: 'inválido', code: 'VALIDATION_ERROR' }),
    );
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateCampaign(), { wrapper });
    act(() => result.current.create(CREATE_INPUT));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.serverError).toMatch(/inválid/i);
  });

  it('sin error, `missingRecipientsError` es null', () => {
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateCampaign(), { wrapper });

    expect(result.current.missingRecipientsError).toBeNull();
  });
});

describe('MBH-4: useSendCampaign', () => {
  it('send(campaignId) llama a sendCampaign(id) e invalida detalle + lista al resolver', async () => {
    vi.mocked(sendCampaign).mockResolvedValue({ campaignId: 'camp-1', accepted: true });
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useSendCampaign(), { wrapper });

    act(() => {
      result.current.send('camp-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sendCampaign).toHaveBeenCalledWith('camp-1');
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['messagingBulk', 'campaign', 'camp-1']) }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['messagingBulk', 'campaigns']) }),
    );
  });

  it('deriva las keys de invalidación de LAS VARS del mutate, no de un closure con id fijo', async () => {
    vi.mocked(sendCampaign).mockResolvedValue({ campaignId: 'camp-2', accepted: true });
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useSendCampaign(), { wrapper });

    act(() => {
      result.current.send('camp-2');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['messagingBulk', 'campaign', 'camp-2']) }),
    );
  });

  it('409 CAMPAIGN_SEND_IN_PROGRESS se expone como `conflict` (lock global de otra campaña)', async () => {
    vi.mocked(sendCampaign).mockRejectedValue(makeConflictError());
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSendCampaign(), { wrapper });

    act(() => {
      result.current.send('camp-1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.conflict).toEqual({
      code: 'CAMPAIGN_SEND_IN_PROGRESS',
      message: 'Ya hay un envío de campañas en curso (se procesa una campaña a la vez); reintentá cuando termine',
    });
  });

  it('sin error, `conflict` es null', () => {
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSendCampaign(), { wrapper });

    expect(result.current.conflict).toBeNull();
  });
});

describe('MBH-5: useCampaign(id)', () => {
  it('con id vacío NO dispara el fetch (enabled:!!id)', () => {
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCampaign(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getCampaign).not.toHaveBeenCalled();
  });

  it('con id trae el detalle y cachea bajo ["messagingBulk","campaign",id,{}]', async () => {
    const output: GetCampaignOutput = { campaign: makeCampaignDto({ status: 'done' }) };
    vi.mocked(getCampaign).mockResolvedValue(output);
    const { qc, wrapper } = makeWrapper();

    const { result } = renderHook(() => useCampaign('camp-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCampaign).toHaveBeenCalledWith('camp-1', {});
    expect(result.current.data).toEqual(output);
    expect(qc.getQueryData(bulkCampaignKey('camp-1'))).toEqual(output);
  });

  it('status "running" + pestaña visible → refetchea a los 5s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getCampaign).mockResolvedValue({ campaign: makeCampaignDto({ status: 'running' }) });
    vi.mocked(useDocumentVisible).mockReturnValue(true);
    const { wrapper } = makeWrapper();

    renderHook(() => useCampaign('camp-1'), { wrapper });
    await vi.waitFor(() => expect(getCampaign).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(getCampaign).toHaveBeenCalledTimes(2);
  });

  it('status "done" (terminal) → NO refetchea aunque pase el tiempo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getCampaign).mockResolvedValue({ campaign: makeCampaignDto({ status: 'done' }) });
    vi.mocked(useDocumentVisible).mockReturnValue(true);
    const { wrapper } = makeWrapper();

    renderHook(() => useCampaign('camp-1'), { wrapper });
    await vi.waitFor(() => expect(getCampaign).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(getCampaign).toHaveBeenCalledTimes(1);
  });

  it('status "running" pero pestaña OCULTA → NO refetchea (gate useDocumentVisible)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getCampaign).mockResolvedValue({ campaign: makeCampaignDto({ status: 'running' }) });
    vi.mocked(useDocumentVisible).mockReturnValue(false);
    const { wrapper } = makeWrapper();

    renderHook(() => useCampaign('camp-1'), { wrapper });
    await vi.waitFor(() => expect(getCampaign).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(getCampaign).toHaveBeenCalledTimes(1);
  });

  // bulk-detail-polling-fe (Change A) — `pending`/`paused` dejan de ser "página
  // muerta" (antes `refetchInterval` devolvía `false`): pollean cada 30s para
  // que el detalle se refresque solo sin que el usuario tenga que F5.
  it('status "pending" + pestaña visible → refetchea a los 30s (NO a los 5s)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getCampaign).mockResolvedValue({ campaign: makeCampaignDto({ status: 'pending' }) });
    vi.mocked(useDocumentVisible).mockReturnValue(true);
    const { wrapper } = makeWrapper();

    renderHook(() => useCampaign('camp-1'), { wrapper });
    await vi.waitFor(() => expect(getCampaign).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(getCampaign).toHaveBeenCalledTimes(1); // a los 5s todavía NO (eso es solo para "running")

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000);
    });
    expect(getCampaign).toHaveBeenCalledTimes(2); // a los 30s sí
  });

  it('status "paused" + pestaña visible → refetchea a los 30s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getCampaign).mockResolvedValue({ campaign: makeCampaignDto({ status: 'paused' }) });
    vi.mocked(useDocumentVisible).mockReturnValue(true);
    const { wrapper } = makeWrapper();

    renderHook(() => useCampaign('camp-1'), { wrapper });
    await vi.waitFor(() => expect(getCampaign).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(getCampaign).toHaveBeenCalledTimes(2);
  });

  it('status "pending" pero pestaña OCULTA → NO refetchea', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getCampaign).mockResolvedValue({ campaign: makeCampaignDto({ status: 'pending' }) });
    vi.mocked(useDocumentVisible).mockReturnValue(false);
    const { wrapper } = makeWrapper();

    renderHook(() => useCampaign('camp-1'), { wrapper });
    await vi.waitFor(() => expect(getCampaign).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(getCampaign).toHaveBeenCalledTimes(1);
  });
});

describe('MBH-9: campaignPollInterval (pura, bulk-detail-polling-fe Change A)', () => {
  it('pestaña no visible → false, sea cual sea el status', () => {
    expect(campaignPollInterval('running', false)).toBe(false);
    expect(campaignPollInterval('pending', false)).toBe(false);
    expect(campaignPollInterval(undefined, false)).toBe(false);
  });

  it('"running" + visible → 5_000', () => {
    expect(campaignPollInterval('running', true)).toBe(5_000);
  });

  it('"pending" + visible → 30_000', () => {
    expect(campaignPollInterval('pending', true)).toBe(30_000);
  });

  it('"paused" + visible → 30_000', () => {
    expect(campaignPollInterval('paused', true)).toBe(30_000);
  });

  it('"done" + visible → false (terminal)', () => {
    expect(campaignPollInterval('done', true)).toBe(false);
  });

  it('"failed" + visible → false (terminal)', () => {
    expect(campaignPollInterval('failed', true)).toBe(false);
  });

  it('status undefined (sin data todavía) + visible → false', () => {
    expect(campaignPollInterval(undefined, true)).toBe(false);
  });
});

describe('MBH-6: useCampaigns(query)', () => {
  it('llama a listCampaigns con el query y cachea bajo ["messagingBulk","campaigns",query]', async () => {
    vi.mocked(listCampaigns).mockResolvedValue(CAMPAIGNS_PAGE);
    const { qc, wrapper } = makeWrapper();
    const query = { page: 1, limit: 20 };

    const { result } = renderHook(() => useCampaigns(query), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listCampaigns).toHaveBeenCalledWith(query);
    expect(result.current.data).toEqual(CAMPAIGNS_PAGE);
    expect(qc.getQueryData(bulkCampaignsKey(query))).toEqual(CAMPAIGNS_PAGE);
  });

  // bulk-detail-polling-fe (Change A) — el historial también refleja avance
  // sin F5: pollea cada 30s, gateado por `useDocumentVisible` (mismo criterio
  // que `useCampaign`).
  it('pestaña visible → pollea cada 30s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(listCampaigns).mockResolvedValue(CAMPAIGNS_PAGE);
    vi.mocked(useDocumentVisible).mockReturnValue(true);
    const { wrapper } = makeWrapper();

    renderHook(() => useCampaigns({}), { wrapper });
    await vi.waitFor(() => expect(listCampaigns).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(listCampaigns).toHaveBeenCalledTimes(2);
  });

  it('pestaña OCULTA → NO pollea (gate useDocumentVisible)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(listCampaigns).mockResolvedValue(CAMPAIGNS_PAGE);
    vi.mocked(useDocumentVisible).mockReturnValue(false);
    const { wrapper } = makeWrapper();

    renderHook(() => useCampaigns({}), { wrapper });
    await vi.waitFor(() => expect(listCampaigns).toHaveBeenCalledTimes(1));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(listCampaigns).toHaveBeenCalledTimes(1);
  });
});

describe('MBH-7: useSegmentRecipients (v1.1)', () => {
  const RECIPIENTS_OUTPUT: SegmentRecipientsOutput = {
    data: [{ clientId: 'cli-1', name: 'Juan Perez', phoneE164: '+5491100000000', status: 'late' }],
    total: 42,
    page: 1,
    limit: 20,
    skipped: { optedOut: 0, duplicatePhone: 0, invalidPhone: 0 },
    statusCounts: { late: 42 },
  };

  it('llama a listSegmentRecipients(segment,page,limit) y cachea el resultado', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS_OUTPUT);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSegmentRecipients({ statuses: ['late'] }, 1, 20), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listSegmentRecipients).toHaveBeenCalledWith({ statuses: ['late'] }, 1, 20);
    expect(result.current.data).toEqual(RECIPIENTS_OUTPUT);
  });

  it('enabled:false NO dispara el fetch (ej. sin criterio de segmento todavía)', () => {
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSegmentRecipients({ statuses: [] }, 1, 20, false), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(listSegmentRecipients).not.toHaveBeenCalled();
  });

  it('cambiar de página mantiene la data anterior visible (keepPreviousData) mientras resuelve la nueva', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValueOnce(RECIPIENTS_OUTPUT);
    const { wrapper } = makeWrapper();

    const { result, rerender } = renderHook(({ page }) => useSegmentRecipients({ statuses: ['late'] }, page, 20), {
      wrapper,
      initialProps: { page: 1 },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    let resolvePage2!: (v: SegmentRecipientsOutput) => void;
    vi.mocked(listSegmentRecipients).mockReturnValueOnce(new Promise((res) => (resolvePage2 = res)));
    rerender({ page: 2 });

    // Sigue mostrando la data de la página 1 (isFetching true, isPending false) mientras espera la 2.
    expect(result.current.data).toEqual(RECIPIENTS_OUTPUT);
    expect(result.current.isFetching).toBe(true);

    const page2Output: SegmentRecipientsOutput = { ...RECIPIENTS_OUTPUT, page: 2 };
    act(() => resolvePage2(page2Output));
    await waitFor(() => expect(result.current.data).toEqual(page2Output));
  });
});
