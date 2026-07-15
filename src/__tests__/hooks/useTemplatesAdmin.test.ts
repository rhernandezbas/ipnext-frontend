/**
 * useTemplatesAdmin — hooks del ABM de templates WhatsApp (Change 3). Un
 * archivo, molde `useBulkMessaging.ts` (convención del repo).
 *
 *  MTH-1 useTemplatesList(): queryKey ['messagingTemplates'], gateado por
 *        `enabled` (permiso `messaging.templates`, decisión del caller)
 *  MTH-2 useCreateTemplate(): mutation, invalida la lista de templates al
 *        crear; mapea 400/422/503 a `serverError`
 *  MTH-3 useSubmitTemplate(): mutation (sid,input), invalida la lista
 *  MTH-4 useDeleteTemplate(): mutation (sid), invalida la lista al resolver;
 *        detecta el 409 TEMPLATE_IN_USE y lo expone como `inUseError`
 *        (con `campaignIds`), NUNCA como éxito
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { AxiosError, AxiosHeaders } from 'axios';
import type { TemplateDetailDto } from '@/types/messagingTemplates';

vi.mock('@/api/messagingTemplates.api', () => ({
  listTemplates: vi.fn(),
  getTemplate: vi.fn(),
  createTemplate: vi.fn(),
  submitTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}));

import {
  listTemplates,
  createTemplate,
  submitTemplate,
  deleteTemplate,
} from '@/api/messagingTemplates.api';
import {
  useTemplatesList,
  useCreateTemplate,
  useSubmitTemplate,
  useDeleteTemplate,
  templatesAdminKey,
} from '@/hooks/useTemplatesAdmin';

const TEMPLATE: TemplateDetailDto = {
  contentSid: 'HX123',
  friendlyName: 'Recordatorio de pago',
  language: 'es',
  variables: ['1', '2'],
  approvalStatus: 'unsubmitted',
  category: 'UTILITY',
  sendable: false,
  body: 'Hola {{1}}, tu saldo de ${{2}} vence pronto.',
};

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

function makeAxiosError(status: number, data: unknown): AxiosError {
  const error = new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST');
  error.response = {
    status,
    statusText: '',
    headers: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture mínimo de AxiosResponse
    config: { headers: new AxiosHeaders() } as any,
    data,
  };
  return error;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MTH-1: useTemplatesList', () => {
  it('llama a listTemplates y cachea bajo ["messagingTemplates"]', async () => {
    vi.mocked(listTemplates).mockResolvedValue([TEMPLATE]);
    const { qc, wrapper } = makeWrapper();

    const { result } = renderHook(() => useTemplatesList(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([TEMPLATE]);
    expect(qc.getQueryData(templatesAdminKey)).toEqual([TEMPLATE]);
  });

  it('enabled:false (sin permiso messaging.templates) NO dispara el fetch', () => {
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useTemplatesList(false), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(listTemplates).not.toHaveBeenCalled();
  });
});

describe('MTH-2: useCreateTemplate', () => {
  it('create(input) llama a createTemplate e invalida la lista de templates', async () => {
    vi.mocked(createTemplate).mockResolvedValue(TEMPLATE);
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreateTemplate(), { wrapper });

    act(() => {
      result.current.create({
        friendlyName: 'Recordatorio de pago',
        language: 'es',
        category: 'UTILITY',
        body: 'Hola {{1}}',
        variables: ['1'],
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(TEMPLATE);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['messagingTemplates']) }),
    );
  });

  it.each([
    [400, 'VALIDATION_ERROR'],
    [422, 'PROVIDER_REJECTED'],
    [503, 'PROVIDER_UNAVAILABLE'],
  ])('status %i se expone como `serverError` (mensaje visible)', async (status, code) => {
    vi.mocked(createTemplate).mockRejectedValue(makeAxiosError(status, { code }));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useCreateTemplate(), { wrapper });

    act(() => {
      result.current.create({
        friendlyName: 'x',
        language: 'es',
        category: 'UTILITY',
        body: 'b',
        variables: [],
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.serverError).toBeTruthy();
    expect(typeof result.current.serverError).toBe('string');
  });

  it('sin error, `serverError` es null', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateTemplate(), { wrapper });
    expect(result.current.serverError).toBeNull();
  });
});

describe('MTH-3: useSubmitTemplate', () => {
  it('submit({sid,input}) llama a submitTemplate(sid,input) e invalida la lista', async () => {
    vi.mocked(submitTemplate).mockResolvedValue({ contentSid: 'HX123', submitted: true });
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useSubmitTemplate(), { wrapper });

    act(() => {
      result.current.submit({ sid: 'HX123', input: { name: 'recordatorio_pago', category: 'UTILITY' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(submitTemplate).toHaveBeenCalledWith('HX123', { name: 'recordatorio_pago', category: 'UTILITY' });
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['messagingTemplates']) }),
    );
  });
});

describe('MTH-4: useDeleteTemplate', () => {
  it('remove(sid) llama a deleteTemplate(sid) e invalida la lista al resolver', async () => {
    vi.mocked(deleteTemplate).mockResolvedValue(undefined);
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteTemplate(), { wrapper });

    act(() => {
      result.current.remove('HX123');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteTemplate).toHaveBeenCalledWith('HX123');
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['messagingTemplates']) }),
    );
  });

  it('409 TEMPLATE_IN_USE se expone como `inUseError` con los campaignIds (NO como éxito)', async () => {
    vi.mocked(deleteTemplate).mockRejectedValue(
      makeAxiosError(409, {
        error: 'El template está en uso',
        code: 'TEMPLATE_IN_USE',
        campaignIds: ['camp-1', 'camp-2'],
      }),
    );
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useDeleteTemplate(), { wrapper });

    act(() => {
      result.current.remove('HX123');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.inUseError).toEqual({
      code: 'TEMPLATE_IN_USE',
      message: 'El template está en uso',
      campaignIds: ['camp-1', 'camp-2'],
    });
  });

  it('sin error, `inUseError` es null', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteTemplate(), { wrapper });
    expect(result.current.inUseError).toBeNull();
  });
});
