/**
 * TemplateSendPanel (inbox-template-send, design D11) — modal por portal:
 * picker de templates aprobados + variables + preview + confirm/envío,
 * disparado desde el CTA "Enviar template" del composer (ventana expirada).
 *
 *  PICK-1 catálogo: 4 ramas (loading/error/empty/success), SOLO sendable
 *  VAR-1  variables como inputs planos + preview vivo, variable vacía
 *         señalizada como pendiente; template sin variables → confirm directo
 *  SEND-1 gate de confirm, envío feliz (POST + append vía el hook + cierre +
 *         foco de vuelta), doble click no duplica, remount limpio por conv
 *  ERR-1  errores mapeados inline (role=alert), panel queda abierto
 *  A11Y-1 dialog/aria-modal/aria-labelledby, foco inicial, Esc, backdrop,
 *         restauración de foco
 *
 * `useSendableTemplates`/`useSendWhatsappTemplate` (`@/hooks/useWhatsapp`) se
 * mockean a nivel HOOK (ya testeados unitariamente en
 * `useWhatsapp.templateSend.test.ts`) — acá se verifica el WIRING/UI.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useWhatsapp');

import * as useWhatsappModule from '@/hooks/useWhatsapp';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';
import { TemplateSendPanel } from './TemplateSendPanel';
import type { TemplateSummaryDto } from '@/types/messagingBulk';
import type { WhatsappMessage } from '@/types/whatsapp';

const APPROVED: TemplateSummaryDto = {
  contentSid: 'HX123',
  friendlyName: 'Recordatorio de pago',
  language: 'es',
  variables: ['1', '2'],
  approvalStatus: 'approved',
  sendable: true,
  body: 'Hola {{1}}, tu saldo es {{2}}',
};

const APPROVED_NO_VARS: TemplateSummaryDto = {
  contentSid: 'HX777',
  friendlyName: 'Bienvenida',
  language: 'es',
  variables: [],
  approvalStatus: 'approved',
  sendable: true,
  body: 'Bienvenido a IPNEXT.',
};

const PENDING: TemplateSummaryDto = {
  contentSid: 'HX999',
  friendlyName: 'Template en revisión',
  language: 'es',
  variables: [],
  approvalStatus: 'pending',
  sendable: false,
  body: 'Texto pendiente de aprobación.',
};

const REJECTED: TemplateSummaryDto = {
  contentSid: 'HX111',
  friendlyName: 'Template rechazado',
  language: 'es',
  variables: [],
  approvalStatus: 'rejected',
  sendable: false,
  body: 'Texto rechazado.',
};

const SENT: WhatsappMessage = {
  id: 'msg-tpl-1',
  direction: 'outbound',
  content: 'Hola Juan, tu saldo es $5.000',
  senderName: 'Agente',
  sentAt: '2026-07-16T12:00:00.000Z',
};

function mockSendTemplate(overrides: Partial<ReturnType<typeof defaultSendTemplateReturn>> = {}) {
  const merged = { ...defaultSendTemplateReturn(), ...overrides };
  vi.mocked(useWhatsappModule.useSendWhatsappTemplate).mockReturnValue(merged);
  return merged;
}

function defaultSendTemplateReturn() {
  return {
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
    error: null as Error | null,
    reset: vi.fn(),
  };
}

function mockTemplates(templates: TemplateSummaryDto[], overrides: Parameters<typeof mockQuery<TemplateSummaryDto[]>>[0] = {}) {
  vi.mocked(useWhatsappModule.useSendableTemplates).mockReturnValue(
    mockQuery<TemplateSummaryDto[]>({ data: templates, isLoading: false, ...overrides }),
  );
}

function errWithCode(code: string) {
  return Object.assign(new Error(code), { response: { data: { code } } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTemplates([APPROVED]);
  mockSendTemplate();
});

function renderPanel(props: Partial<React.ComponentProps<typeof TemplateSendPanel>> = {}) {
  const onClose = vi.fn();
  const onSent = vi.fn();
  const utils = render(
    <TemplateSendPanel conversationId="conv-1" onClose={onClose} onSent={onSent} {...props} />,
  );
  return { ...utils, onClose, onSent };
}

describe('PICK-1: catálogo — 4 ramas', () => {
  it('loading → role=status, sin combobox', () => {
    mockTemplates([], { isLoading: true, data: undefined });
    renderPanel();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('error → role=alert + botón reintentar', () => {
    const refetch = vi.fn();
    mockTemplates([], { isError: true, isLoading: false, data: undefined, refetch });
    renderPanel();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('empty (sin templates) → nota "No hay templates aprobados."', () => {
    mockTemplates([]);
    renderPanel();
    expect(screen.getByText(/no hay templates aprobados/i)).toBeInTheDocument();
  });

  it('empty (SOLO pending/rejected, sin ningún approved) → misma nota de vacío', () => {
    mockTemplates([PENDING, REJECTED]);
    renderPanel();
    expect(screen.getByText(/no hay templates aprobados/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('success (con approved) → combobox listando SOLO sendable===true', async () => {
    const user = userEvent.setup();
    mockTemplates([APPROVED, PENDING, REJECTED]);
    renderPanel();

    const combobox = screen.getByRole('combobox', { name: /template/i });
    expect(combobox).toBeInTheDocument();
    await user.click(combobox);

    expect(screen.getByRole('option', { name: /recordatorio de pago/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /template en revisión/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /template rechazado/i })).not.toBeInTheDocument();
  });
});

describe('VAR-1: variables + preview vivo', () => {
  async function pickApproved(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /recordatorio de pago/i }));
  }

  it('renderiza un input por variable con label {{N}} visible', async () => {
    const user = userEvent.setup();
    renderPanel();
    await pickApproved(user);

    expect(screen.getByLabelText('{{1}}')).toBeInTheDocument();
    expect(screen.getByLabelText('{{2}}')).toBeInTheDocument();
  });

  it('preview vivo: tipear {{1}} y dejar {{2}} vacío muestra el resto resuelto + {{2}} señalizado pendiente', async () => {
    const user = userEvent.setup();
    renderPanel();
    await pickApproved(user);

    await user.type(screen.getByLabelText('{{1}}'), 'Juan');

    expect(screen.getByText(/hola juan/i)).toBeInTheDocument();
    // La variable 2 sigue sin tipear: debe quedar señalizada (marcada como
    // pendiente), nunca como un `{{2}}` crudo sin indicación.
    const pending = screen.getByTestId('template-preview-pending-2');
    expect(pending).toBeInTheDocument();
  });

  it('template SIN variables muestra el body tal cual y NO renderiza inputs de variables', async () => {
    const user = userEvent.setup();
    mockTemplates([APPROVED_NO_VARS]);
    renderPanel();

    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /bienvenida/i }));

    expect(screen.getByText(/bienvenido a ipnext/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /\{\{/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar y enviar/i })).toBeEnabled();
  });
});

describe('SEND-1: gate de confirm + envío', () => {
  it('confirm deshabilitado sin template elegido', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /confirmar y enviar/i })).toBeDisabled();
  });

  it('confirm deshabilitado con template elegido pero variables incompletas', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /recordatorio de pago/i }));
    await user.type(screen.getByLabelText('{{1}}'), 'Juan');
    // {{2}} sigue vacío.
    expect(screen.getByRole('button', { name: /confirmar y enviar/i })).toBeDisabled();
  });

  it('envío feliz: con todas las variables completas, confirm dispara sendTemplate con {templateRef,variables,idempotencyKey}, appendea (vía el hook) y cierra + onSent', async () => {
    const user = userEvent.setup();
    const sendTemplate = vi.fn(
      (
        _input: { templateRef: string; variables: Record<string, string>; idempotencyKey: string },
        opts?: { onSuccess?: (message: WhatsappMessage) => void },
      ) => {
        opts?.onSuccess?.(SENT);
      },
    );
    mockSendTemplate({ sendTemplate });
    const { onSent } = renderPanel();

    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /recordatorio de pago/i }));
    await user.type(screen.getByLabelText('{{1}}'), 'Juan');
    await user.type(screen.getByLabelText('{{2}}'), '$5.000');

    const confirmBtn = screen.getByRole('button', { name: /confirmar y enviar/i });
    expect(confirmBtn).toBeEnabled();
    await user.click(confirmBtn);

    expect(sendTemplate).toHaveBeenCalledTimes(1);
    const [input] = sendTemplate.mock.calls[0];
    expect(input.templateRef).toBe('HX123');
    expect(input.variables).toEqual({ '1': 'Juan', '2': '$5.000' });
    expect(typeof input.idempotencyKey).toBe('string');
    expect(input.idempotencyKey.length).toBeGreaterThan(0);

    // onSuccess del mock invoca sincrónicamente el callback pasado — el panel
    // debe reaccionar cerrando (onSent) sin esperar ningún timer.
    expect(onSent).toHaveBeenCalledTimes(1);
  });

  it('con un template SIN variables, el body del envío es variables:{} (contrato explícito)', async () => {
    const user = userEvent.setup();
    const sendTemplate = vi.fn(
      (
        _input: { templateRef: string; variables: Record<string, string>; idempotencyKey: string },
        opts?: { onSuccess?: (message: WhatsappMessage) => void },
      ) => {
        opts?.onSuccess?.(SENT);
      },
    );
    mockSendTemplate({ sendTemplate });
    mockTemplates([APPROVED_NO_VARS]);
    renderPanel();

    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /bienvenida/i }));
    await user.click(screen.getByRole('button', { name: /confirmar y enviar/i }));

    const [input] = sendTemplate.mock.calls[0];
    expect(input.variables).toEqual({});
  });

  it('doble click no duplica: con isPending:true el botón confirm está disabled', async () => {
    const user = userEvent.setup();
    const { rerender, onClose, onSent } = renderPanel();

    // Flujo realista: el agente elige template + completa variables MIENTRAS
    // isPending todavía es false — recién el click de confirm dispara la
    // mutation (acá simulado re-mockeando el hook a isPending:true y
    // re-renderizando, sin desmontar — mismo componente, nuevo resultado del
    // hook, molde de cómo TanStack Query re-renderiza en la vida real).
    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /recordatorio de pago/i }));
    await user.type(screen.getByLabelText('{{1}}'), 'Juan');
    await user.type(screen.getByLabelText('{{2}}'), '$5.000');

    mockSendTemplate({ isPending: true });
    rerender(<TemplateSendPanel conversationId="conv-1" onClose={onClose} onSent={onSent} />);

    const confirmBtn = screen.getByRole('button', { name: /enviando/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('cambio de conversación (remount por key) no contamina: el nuevo panel arranca limpio', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <TemplateSendPanel key="conv-a" conversationId="conv-a" onClose={vi.fn()} onSent={vi.fn()} />,
    );

    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /recordatorio de pago/i }));
    await user.type(screen.getByLabelText('{{1}}'), 'Juan');
    expect(screen.getByLabelText('{{1}}')).toHaveValue('Juan');

    rerender(<TemplateSendPanel key="conv-b" conversationId="conv-b" onClose={vi.fn()} onSent={vi.fn()} />);

    // Select vuelve al placeholder — sin template elegido, sin inputs de variable.
    expect(screen.queryByLabelText('{{1}}')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar y enviar/i })).toBeDisabled();
  });
});

describe('ERR-1: errores del envío mapeados inline, panel abierto', () => {
  it('422 TEMPLATE_NOT_APPROVED → role=alert con el copy mapeado, catálogo sigue eligible', async () => {
    const user = userEvent.setup();
    mockTemplates([APPROVED, APPROVED_NO_VARS]);
    mockSendTemplate({ isError: true, error: errWithCode('TEMPLATE_NOT_APPROVED') });
    renderPanel();

    expect(screen.getByRole('alert')).toHaveTextContent(/no está aprobado/i);
    // El catálogo sigue permitiendo elegir OTRO template (no queda bloqueado).
    await user.click(screen.getByRole('combobox', { name: /template/i }));
    expect(screen.getByRole('option', { name: /bienvenida/i })).toBeInTheDocument();
  });

  it('503 TEMPLATE_PROVIDER_UNAVAILABLE → copy de reintento, confirm re-habilitado (isPending:false)', async () => {
    const user = userEvent.setup();
    mockSendTemplate({ isError: true, error: errWithCode('TEMPLATE_PROVIDER_UNAVAILABLE'), isPending: false });
    renderPanel();

    expect(screen.getByRole('alert')).toHaveTextContent(/reintentá en unos minutos/i);

    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /recordatorio de pago/i }));
    await user.type(screen.getByLabelText('{{1}}'), 'Juan');
    await user.type(screen.getByLabelText('{{2}}'), '$5.000');
    expect(screen.getByRole('button', { name: /confirmar y enviar/i })).toBeEnabled();
  });
});

describe('A11Y-1: modal completo', () => {
  it('role=dialog, aria-modal, aria-labelledby al título', () => {
    renderPanel();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const titleId = dialog.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    expect(document.getElementById(titleId!)).toHaveTextContent(/enviar template/i);
  });

  it('foco inicial cae DENTRO del diálogo al montar', () => {
    renderPanel();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('Esc cierra el panel', async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('click en el backdrop cierra el panel', async () => {
    const user = userEvent.setup();
    const { onClose, container } = renderPanel();
    const dialog = screen.getByRole('dialog');
    // El backdrop es el propio elemento role=dialog (mismo molde que
    // ConfirmModal/PreviewModal) — clickear el nodo raíz del portal.
    void container;
    await user.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('al desmontar, el foco vuelve al elemento que estaba enfocado antes de abrir (el CTA)', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Enviar template';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = renderPanel();
    expect(document.activeElement).not.toBe(trigger);

    unmount();
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });
});
