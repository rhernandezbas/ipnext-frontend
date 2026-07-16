/**
 * whatsapp.api — WAPI-1 (inbox-template-send, design.md D11) — catálogo +
 * envío de template desde el composer del inbox. Contrato verificado contra
 * el BE real EN PROD (`GET /messaging/send-templates` gate `messaging:send`,
 * `POST /messaging/conversations/:id/send-template` gate `messaging:send`).
 *
 * Envelope ASIMÉTRICO (memoria `e2e-envelope-mock-mismatch`): el catálogo
 * viaja envuelto `{data:[...]}` (unwrap acá, mismo criterio que
 * `listWhatsappMessages`); el envío responde el DTO FLAT (201 nuevo / 200
 * deduped — MISMO body en ambos casos, `sendWhatsappTemplate` no necesita
 * ramificar por status).
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { WhatsappMessage } from '@/types/whatsapp';
import type { TemplateSummaryDto } from '@/types/messagingBulk';

vi.mock('@/api/axios-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import axiosClient from '@/api/axios-client';
import { listSendableTemplates, sendWhatsappTemplate } from '@/api/whatsapp.api';

const APPROVED: TemplateSummaryDto = {
  contentSid: 'HX123',
  friendlyName: 'Recordatorio de pago',
  language: 'es',
  variables: ['1', '2'],
  approvalStatus: 'approved',
  sendable: true,
  body: 'Hola {{1}}, tu saldo es {{2}}',
};

const SENT: WhatsappMessage = {
  id: 'msg-tpl-1',
  direction: 'outbound',
  content: 'Hola Juan, tu saldo es $5.000',
  senderName: 'Agente',
  sentAt: '2026-07-16T12:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WAPI-1: listSendableTemplates', () => {
  it('GETs /messaging/send-templates y desenvuelve {data}', async () => {
    vi.mocked(axiosClient.get).mockResolvedValue({ data: { data: [APPROVED] } });

    const result = await listSendableTemplates();

    expect(axiosClient.get).toHaveBeenCalledWith('/messaging/send-templates');
    expect(result).toEqual([APPROVED]);
  });
});

describe('WAPI-1: sendWhatsappTemplate', () => {
  it('POSTs /messaging/conversations/:id/send-template con {templateRef,variables,idempotencyKey} y devuelve el DTO flat', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: SENT });

    const result = await sendWhatsappTemplate('conv-1', {
      templateRef: 'HX123',
      variables: { '1': 'Juan', '2': '$5.000' },
      idempotencyKey: 'uuid-fixo-1',
    });

    expect(axiosClient.post).toHaveBeenCalledWith('/messaging/conversations/conv-1/send-template', {
      templateRef: 'HX123',
      variables: { '1': 'Juan', '2': '$5.000' },
      idempotencyKey: 'uuid-fixo-1',
    });
    expect(result).toEqual(SENT);
  });

  it('con un template sin variables, viaja variables:{} (contrato explícito)', async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: SENT });

    await sendWhatsappTemplate('conv-1', {
      templateRef: 'HX999',
      variables: {},
      idempotencyKey: 'uuid-fixo-2',
    });

    expect(axiosClient.post).toHaveBeenCalledWith('/messaging/conversations/conv-1/send-template', {
      templateRef: 'HX999',
      variables: {},
      idempotencyKey: 'uuid-fixo-2',
    });
  });

  it('devuelve el MISMO shape sea 200 (deduped) o 201 (nuevo) — el status no cambia el body', async () => {
    // axios resuelve igual en 200/201 (ambos 2xx) — el FE no ramifica por status (design D5/D11).
    vi.mocked(axiosClient.post).mockResolvedValue({ data: SENT, status: 200 });

    const result = await sendWhatsappTemplate('conv-1', {
      templateRef: 'HX123',
      variables: { '1': 'Juan', '2': '$5.000' },
      idempotencyKey: 'uuid-fixo-1',
    });

    expect(result).toEqual(SENT);
  });
});
