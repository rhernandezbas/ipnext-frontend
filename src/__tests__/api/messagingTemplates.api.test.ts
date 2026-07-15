/**
 * messagingTemplates.api — wire contract del router DEDICADO
 * `/api/messaging/templates` (Change 3 — CRUD de templates WhatsApp).
 *
 * OJO envelope ASIMETRICO por endpoint (contrato del change):
 *  MTAPI-1 listTemplates: GET /messaging/templates → `res.json({data})` →
 *          UNWRAP `.data.data`
 *  MTAPI-2 getTemplate: GET /messaging/templates/:sid → `TemplateDetailDto`
 *          PELADO (sin {data})
 *  MTAPI-3 createTemplate: POST /messaging/templates con CreateTemplateInput →
 *          `TemplateDetailDto` PELADO
 *  MTAPI-4 submitTemplate: POST /messaging/templates/:sid/submit con
 *          {name, category} → {contentSid, submitted} PELADO
 *  MTAPI-5 deleteTemplate: DELETE /messaging/templates/:sid → 204 No Content
 *          (sin body → resuelve void)
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type {
  CreateTemplateInput,
  SubmitTemplateInput,
  SubmitTemplateOutput,
  TemplateDetailDto,
} from '@/types/messagingTemplates';

vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  submitTemplate,
  deleteTemplate,
} from '@/api/messagingTemplates.api';

const TEMPLATE: TemplateDetailDto = {
  contentSid: 'HX123',
  friendlyName: 'Recordatorio de pago',
  language: 'es',
  variables: ['1', '2'],
  approvalStatus: 'approved',
  category: 'UTILITY',
  sendable: true,
  body: 'Hola {{1}}, tu saldo de ${{2}} vence pronto.',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MTAPI-1: listTemplates', () => {
  it('GETs /messaging/templates y unwrappea {data} al array pelado', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { data: [TEMPLATE] } });

    const result = await listTemplates();

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/templates');
    expect(result).toEqual([TEMPLATE]);
  });
});

describe('MTAPI-2: getTemplate', () => {
  it('GETs /messaging/templates/:sid y devuelve el detalle PELADO (sin envelope)', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: TEMPLATE });

    const result = await getTemplate('HX123');

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/templates/HX123');
    expect(result).toEqual(TEMPLATE);
    // Honestidad del contrato: NO viene envuelto en {data}.
    expect('data' in (result as object)).toBe(false);
  });
});

describe('MTAPI-3: createTemplate', () => {
  it('POSTea /messaging/templates con el input y devuelve el detalle PELADO', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: TEMPLATE });

    const input: CreateTemplateInput = {
      friendlyName: 'Recordatorio de pago',
      language: 'es',
      category: 'UTILITY',
      body: 'Hola {{1}}, tu saldo de ${{2}} vence pronto.',
      variables: ['1', '2'],
    };

    const result = await createTemplate(input);

    expect(axiosClient.post).toHaveBeenCalledWith('/messaging/templates', input);
    expect(result).toEqual(TEMPLATE);
  });
});

describe('MTAPI-4: submitTemplate', () => {
  it('POSTea /messaging/templates/:sid/submit con {name, category} y devuelve {contentSid, submitted} PELADO', async () => {
    const output: SubmitTemplateOutput = { contentSid: 'HX123', submitted: true };
    vi.mocked(axiosClient.post).mockResolvedValue({ data: output });

    const input: SubmitTemplateInput = { name: 'recordatorio_pago', category: 'UTILITY' };
    const result = await submitTemplate('HX123', input);

    expect(axiosClient.post).toHaveBeenCalledWith('/messaging/templates/HX123/submit', input);
    expect(result).toEqual(output);
  });
});

describe('MTAPI-5: deleteTemplate', () => {
  it('DELETEs /messaging/templates/:sid y resuelve void (204 No Content)', async () => {
    vi.mocked(axiosClient.delete).mockResolvedValue({ status: 204, data: undefined });

    const result = await deleteTemplate('HX123');

    expect(axiosClient.delete).toHaveBeenCalledWith('/messaging/templates/HX123');
    expect(result).toBeUndefined();
  });
});
