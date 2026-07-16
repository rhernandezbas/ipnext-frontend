/**
 * Composer — CTA "Enviar template" (inbox-template-send, design D11/CTA-1) —
 * la rama EXACTA del aviso de ventana expirada (`Composer.tsx`, antes sólo
 * `WINDOW_EXPIRED_NOTICE`) gana un botón que abre `TemplateSendPanel`.
 * Archivo NUEVO colocado (mismo criterio que `Composer.contract.test.tsx` —
 * un archivo por concern, sin tocar el `Composer.test.tsx` existente F1/F1.5
 * para no colisionar con esa suite ya grande).
 *
 *  CTA-1 el botón "Enviar template" aparece SOLO en la rama exacta
 *        (canReply:false, !isDetailLoading, !isDetailError, modo reply) y en
 *        NINGUNA otra (loading/error-de-verificación/canReply:true/nota)
 *  CTA-2 click abre el panel (`role=dialog`); Esc/Cancelar lo cierran
 *  CTA-3 tras un envío feliz: el panel cierra, el textarea SIGUE disabled y
 *        el aviso de ventana expirada SIGUE visible (D2 — el template NO abre
 *        la ventana), un announcement role=status anuncia "Template enviado"
 *
 * `useSendWhatsappMessage`/`useSendableTemplates`/`useSendWhatsappTemplate`
 * (`@/hooks/useWhatsapp`) se mockean a nivel hook — ya testeados
 * unitariamente en sus propias suites; acá sólo se verifica el WIRING/UI de
 * `Composer` + `TemplateSendPanel` montados juntos.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useWhatsapp');
vi.mock('@/hooks/useMyPermissions');

import * as useWhatsappModule from '@/hooks/useWhatsapp';
import * as useMyPermissionsModule from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';
import { Composer } from './Composer';
import type { TemplateSummaryDto } from '@/types/messagingBulk';
import type { WhatsappMessage } from '@/types/whatsapp';

const APPROVED: TemplateSummaryDto = {
  contentSid: 'HX123',
  friendlyName: 'Recordatorio de pago',
  language: 'es',
  variables: [],
  approvalStatus: 'approved',
  sendable: true,
  body: 'Bienvenido a IPNEXT.',
};

const SENT: WhatsappMessage = {
  id: 'msg-tpl-1',
  direction: 'outbound',
  content: 'Bienvenido a IPNEXT.',
  senderName: 'Agente',
  sentAt: '2026-07-16T12:00:00.000Z',
};

function mockPerms(granted: boolean) {
  vi.mocked(useMyPermissionsModule.useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: granted ? ['messaging.send'] : [],
    isLoading: false,
    isError: false,
    can: () => granted,
  } as UseMyPermissionsResult);
}

function setupWhatsappMocks() {
  vi.mocked(useWhatsappModule.useSendWhatsappMessage).mockReturnValue({
    send: vi.fn(),
    retry: vi.fn(),
    discard: vi.fn(),
    isError: false,
    error: null,
  });
  vi.mocked(useWhatsappModule.useSendableTemplates).mockReturnValue(
    mockQuery<TemplateSummaryDto[]>({ data: [APPROVED], isLoading: false }),
  );
  vi.mocked(useWhatsappModule.useSendWhatsappTemplate).mockReturnValue({
    sendTemplate: vi.fn(
      (
        _input: { templateRef: string; variables: Record<string, string>; idempotencyKey: string },
        opts?: { onSuccess?: (message: WhatsappMessage) => void },
      ) => {
        opts?.onSuccess?.(SENT);
      },
    ),
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms(true);
  setupWhatsappMocks();
});

function renderComposer(props: Partial<React.ComponentProps<typeof Composer>> = {}) {
  return render(
    <Composer conversationId="conv-1" canReply={false} isDetailLoading={false} isDetailError={false} {...props} />,
  );
}

describe('CTA-1: el botón "Enviar template" aparece SOLO en la rama exacta de ventana expirada', () => {
  it('canReply:false + !isDetailLoading + !isDetailError + modo reply → aviso Y botón visibles', () => {
    renderComposer();
    expect(screen.getByText('Ventana de 24h expirada — se necesita un template')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar template/i })).toBeInTheDocument();
  });

  it('isDetailLoading:true → SIN botón', () => {
    renderComposer({ isDetailLoading: true });
    expect(screen.queryByRole('button', { name: /enviar template/i })).not.toBeInTheDocument();
  });

  it('isDetailError:true && !canReply → SIN botón (banner de error de verificación, no de template)', () => {
    renderComposer({ isDetailError: true });
    expect(screen.queryByRole('button', { name: /enviar template/i })).not.toBeInTheDocument();
  });

  it('canReply:true (ventana abierta) → SIN botón', () => {
    renderComposer({ canReply: true });
    expect(screen.queryByRole('button', { name: /enviar template/i })).not.toBeInTheDocument();
  });

  it('modo nota → SIN botón (aunque canReply:false)', async () => {
    const user = userEvent.setup();
    renderComposer();
    await user.click(screen.getByRole('radio', { name: /nota interna/i }));
    expect(screen.queryByRole('button', { name: /enviar template/i })).not.toBeInTheDocument();
  });

  it('sin el permiso messaging.send → SIN botón (mismo guard que el envío, `Can`)', () => {
    mockPerms(false);
    renderComposer();
    expect(screen.queryByRole('button', { name: /enviar template/i })).not.toBeInTheDocument();
  });
});

describe('CTA-2: click abre el panel; Esc/Cancelar lo cierran', () => {
  it('click en "Enviar template" abre TemplateSendPanel (role=dialog)', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(screen.getByRole('button', { name: /enviar template/i }));

    expect(screen.getByRole('dialog', { name: /enviar template/i })).toBeInTheDocument();
  });

  it('"Cancelar" dentro del panel lo cierra sin tocar el estado del composer', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(screen.getByRole('button', { name: /enviar template/i }));
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // El aviso de ventana expirada + el CTA siguen ahí (nada roto).
    expect(screen.getByRole('button', { name: /enviar template/i })).toBeInTheDocument();
  });
});

describe('CTA-3: envío feliz — panel cierra, composer SIGUE bloqueado (D2), announcement', () => {
  it('tras confirmar el envío, el panel cierra, el textarea sigue disabled, el aviso de ventana expirada sigue visible, y un role=status anuncia "Template enviado"', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(screen.getByRole('button', { name: /enviar template/i }));
    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /recordatorio de pago/i }));
    await user.click(screen.getByRole('button', { name: /confirmar y enviar/i }));

    // El panel se cerró (onSuccess del mock invoca onSent sincrónicamente).
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // D2 (LOCKED): el template NO abre la ventana — el composer de texto
    // libre sigue exactamente igual de bloqueado que antes de enviar.
    expect(screen.getByRole('textbox', { name: /mensaje/i })).toBeDisabled();
    expect(screen.getByText('Ventana de 24h expirada — se necesita un template')).toBeInTheDocument();

    // Announcement accesible del resultado (design SEND-1) — persistente en
    // el DOM (sr-only), no depende de que el panel siga montado.
    expect(screen.getByText('Template enviado')).toBeInTheDocument();
  });

  it('el CTA sigue disponible después de cerrar (se puede volver a abrir el panel para otro envío)', async () => {
    const user = userEvent.setup();
    renderComposer();

    await user.click(screen.getByRole('button', { name: /enviar template/i }));
    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /recordatorio de pago/i }));
    await user.click(screen.getByRole('button', { name: /confirmar y enviar/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar template/i })).toBeInTheDocument();
  });
});
