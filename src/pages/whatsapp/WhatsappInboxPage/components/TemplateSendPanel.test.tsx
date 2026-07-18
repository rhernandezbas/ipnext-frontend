/**
 * TemplateSendPanel (inbox-template-send, design D11) — modal por portal:
 * picker de templates aprobados + variables + preview + confirm/envío,
 * disparado desde el CTA "Enviar template" del composer (ventana expirada).
 *
 *  PICK-1 catálogo: 4 ramas (loading/error/empty/success), SOLO sendable
 *  VAR-1  variables con FUENTES (patrón `VariablesMapForm` del bulk): un Select
 *         propio por variable ("Elegí una fuente…" / "Nombre del cliente" /
 *         "Monto de deuda" / "Valor fijo") + input de texto SOLO al elegir
 *         Valor fijo; preview vivo, variable sin resolver señalizada pendiente;
 *         template sin variables → confirm directo
 *  FUENTES resolución CLIENT-SIDE con los datos del contexto del cliente
 *         (`useInboxClientContext`, MISMA query key/cache que
 *         `ClientContextPanel` — jamás un fetch propio): valor resuelto
 *         readonly al lado del Select, burbuja interpolada YA RESUELTA,
 *         payload con strings resueltos (shape actual intacto); sin cliente
 *         (unknown/ambiguous) → opciones de datos deshabilitadas + hint
 *  SEND-1 gate de confirm, envío feliz (POST + append vía el hook + cierre +
 *         foco de vuelta), doble click no duplica, remount limpio por conv
 *  ERR-1  errores mapeados inline (role=alert), panel queda abierto
 *  A11Y-1 dialog/aria-modal/aria-labelledby, foco inicial, Esc, backdrop,
 *         restauración de foco
 *
 * `useSendableTemplates`/`useSendWhatsappTemplate`/`useInboxClientContext`
 * (`@/hooks/useWhatsapp`) se mockean a nivel HOOK (ya testeados unitariamente
 * en sus propias suites) — acá se verifica el WIRING/UI.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useWhatsapp');

import * as useWhatsappModule from '@/hooks/useWhatsapp';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';
import { TemplateSendPanel } from './TemplateSendPanel';
import type { TemplateSummaryDto } from '@/types/messagingBulk';
import type { WhatsappClientContext, WhatsappInboxClientContext, WhatsappMessage } from '@/types/whatsapp';

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

// ─── Contexto del cliente (FUENTES) — mismos shapes que ClientContextPanel ───

const DEBT_DUE = 25759.69;
/** MISMO formateo que `formatMoney` (panel de contexto / FinancialSection) —
 * calculado acá con el mismo Intl para no acoplarse a un literal con NBSP. */
const EXPECTED_DEBT = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(DEBT_DUE);

const LIGHT_MATCHED: WhatsappClientContext = {
  status: 'matched',
  clients: [{ id: '42', name: 'HERNANDEZ RONALD', status: 'active' }],
};

const LIGHT_UNKNOWN: WhatsappClientContext = { status: 'unknown', clients: [] };

const LIGHT_AMBIGUOUS: WhatsappClientContext = {
  status: 'ambiguous',
  clients: [
    { id: '1', name: 'HERNANDEZ RONALD', status: 'active' },
    { id: '2', name: 'HERNANDEZ R.', status: 'active' },
  ],
};

const RICH_CONTEXT: WhatsappInboxClientContext = {
  status: 'matched',
  client: {
    id: '42',
    name: 'HERNANDEZ RONALD',
    email: null,
    phone: null,
    status: 'active',
    fichaClientId: '42',
    balance: { due: DEBT_DUE, currency: 'ARS', isDebtor: true, stale: false, lastRefreshedAt: null },
    lastInvoice: null,
    nextDueDate: null,
    contracts: [],
    openTicketsCount: 0,
    recentTickets: [],
    recentTasks: [],
    recentLogs: [],
  },
};

/** Mock del contexto RICO — mismo molde que `ClientContextPanel.test.tsx:mockRich`. */
function mockClientContext(overrides: Partial<ReturnType<typeof useWhatsappModule.useInboxClientContext>> = {}) {
  vi.mocked(useWhatsappModule.useInboxClientContext).mockReturnValue({
    ...mockQuery<WhatsappInboxClientContext>({ data: undefined, isLoading: false, isError: false }),
    isRefreshingBalance: false,
    balanceRefreshFailed: false,
    ...overrides,
  } as ReturnType<typeof useWhatsappModule.useInboxClientContext>);
}

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
  mockClientContext();
});

function renderPanel(props: Partial<React.ComponentProps<typeof TemplateSendPanel>> = {}) {
  const onClose = vi.fn();
  const onSent = vi.fn();
  const utils = render(
    <TemplateSendPanel conversationId="conv-1" onClose={onClose} onSent={onSent} {...props} />,
  );
  return { ...utils, onClose, onSent };
}

type User = ReturnType<typeof userEvent.setup>;

async function pickApproved(user: User) {
  await user.click(screen.getByRole('combobox', { name: /template/i }));
  await user.click(screen.getByRole('option', { name: /recordatorio de pago/i }));
}

/** Elige una fuente en el Select propio de la variable `{{N}}`. */
async function pickSource(user: User, variable: string, optionName: RegExp) {
  await user.click(screen.getByRole('combobox', { name: `{{${variable}}}` }));
  await user.click(screen.getByRole('option', { name: optionName }));
}

/** Flujo de texto libre bajo FUENTES: "Valor fijo" en el Select de la variable
 * hace aparecer el input (label sr-only `Valor fijo para {{N}}`) y se tipea ahí
 * — reemplaza el input plano histórico. */
async function fillLiteral(user: User, variable: string, text: string) {
  await pickSource(user, variable, /valor fijo/i);
  await user.type(screen.getByLabelText(`Valor fijo para {{${variable}}}`), text);
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

describe('VAR-1: variables con fuentes + preview vivo', () => {
  it('renderiza un Select de fuente por variable con label {{N}} visible; el input de texto SOLO aparece al elegir "Valor fijo"', async () => {
    const user = userEvent.setup();
    renderPanel();
    await pickApproved(user);

    expect(screen.getByRole('combobox', { name: '{{1}}' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '{{2}}' })).toBeInTheDocument();
    // Sin fuente elegida todavía: NO hay input de texto libre.
    expect(screen.queryByLabelText('Valor fijo para {{1}}')).not.toBeInTheDocument();

    await pickSource(user, '1', /valor fijo/i);
    expect(screen.getByLabelText('Valor fijo para {{1}}')).toBeInTheDocument();
  });

  it('preview vivo: {{1}} con valor fijo tipeado y {{2}} sin resolver muestra el resto resuelto + {{2}} señalizado pendiente', async () => {
    const user = userEvent.setup();
    renderPanel();
    await pickApproved(user);

    await fillLiteral(user, '1', 'Juan');

    expect(screen.getByText(/hola juan/i)).toBeInTheDocument();
    // La variable 2 sigue sin resolver: debe quedar señalizada (marcada como
    // pendiente), nunca como un `{{2}}` crudo sin indicación.
    const pending = screen.getByTestId('template-preview-pending-2');
    expect(pending).toBeInTheDocument();
  });

  it('template SIN variables muestra el body tal cual y NO renderiza controles de variables', async () => {
    const user = userEvent.setup();
    mockTemplates([APPROVED_NO_VARS]);
    renderPanel();

    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /bienvenida/i }));

    expect(screen.getByText(/bienvenido a ipnext/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /\{\{/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /\{\{/ })).not.toBeInTheDocument();
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
    await pickApproved(user);
    await fillLiteral(user, '1', 'Juan');
    // {{2}} sigue sin fuente ni valor.
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

    await pickApproved(user);
    await fillLiteral(user, '1', 'Juan');
    await fillLiteral(user, '2', '$5.000');

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
    await pickApproved(user);
    await fillLiteral(user, '1', 'Juan');
    await fillLiteral(user, '2', '$5.000');

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

    await pickApproved(user);
    await fillLiteral(user, '1', 'Juan');
    expect(screen.getByLabelText('Valor fijo para {{1}}')).toHaveValue('Juan');

    rerender(<TemplateSendPanel key="conv-b" conversationId="conv-b" onClose={vi.fn()} onSent={vi.fn()} />);

    // Select vuelve al placeholder — sin template elegido, sin controles de variable.
    expect(screen.queryByRole('combobox', { name: '{{1}}' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Valor fijo para {{1}}')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar y enviar/i })).toBeDisabled();
  });
});

describe('EDGE de contrato (review adversarial, arreglado): cambiar de template regenera idempotencyKey', () => {
  it('elegir A y confirmar, después elegir B (template DISTINTO) → nueva key; reintentar B sin cambiar de template → misma key que el intento anterior de B', async () => {
    const user = userEvent.setup();
    const sendTemplate = vi.fn(
      (_input: { templateRef: string; variables: Record<string, string>; idempotencyKey: string }) => {
        // No invoca onSuccess: simula un timeout/ambigüedad tras el accept de
        // Twilio — el panel sigue abierto, el operador puede seguir operando.
      },
    );
    mockSendTemplate({ sendTemplate });
    mockTemplates([APPROVED, APPROVED_NO_VARS]);
    renderPanel();

    // Elige A (con variables) y confirma.
    await pickApproved(user);
    await fillLiteral(user, '1', 'Juan');
    await fillLiteral(user, '2', '$5.000');
    await user.click(screen.getByRole('button', { name: /confirmar y enviar/i }));
    const keyA = sendTemplate.mock.calls[0][0].idempotencyKey;

    // Cambia a B (sin variables) — intención NUEVA, la key debe cambiar.
    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /bienvenida/i }));
    await user.click(screen.getByRole('button', { name: /confirmar y enviar/i }));
    const keyB1 = sendTemplate.mock.calls[1][0].idempotencyKey;
    expect(keyB1).not.toBe(keyA);

    // Reintenta B SIN volver a elegir template — misma intención, misma key
    // (protección anti doble-cargo del retry).
    await user.click(screen.getByRole('button', { name: /confirmar y enviar/i }));
    const keyB2 = sendTemplate.mock.calls[2][0].idempotencyKey;
    expect(keyB2).toBe(keyB1);
  });
});

describe('Invariante anti-doble-cargo (camino de la plata, agregado por el review): protege el idempotencyKey contra refactors futuros', () => {
  it('confirm → error → confirm de nuevo (MISMO template, sin re-seleccionar) usa el idempotencyKey IDÉNTICO en ambas llamadas', async () => {
    const user = userEvent.setup();
    const sendTemplate = vi.fn();
    mockSendTemplate({ sendTemplate, isError: true, error: errWithCode('TEMPLATE_PROVIDER_UNAVAILABLE') });
    mockTemplates([APPROVED_NO_VARS]);
    renderPanel();

    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /bienvenida/i }));
    await user.click(screen.getByRole('button', { name: /confirmar y enviar/i }));
    await user.click(screen.getByRole('button', { name: /confirmar y enviar/i }));

    expect(sendTemplate).toHaveBeenCalledTimes(2);
    const key1 = sendTemplate.mock.calls[0][0].idempotencyKey;
    const key2 = sendTemplate.mock.calls[1][0].idempotencyKey;
    expect(key2).toBe(key1);
  });

  it('cerrar y reabrir el panel (unmount/mount — molde real de Composer al togglear el CTA) acuña una idempotencyKey NUEVA y distinta', async () => {
    const user = userEvent.setup();
    const sendTemplate = vi.fn();
    mockSendTemplate({ sendTemplate });
    mockTemplates([APPROVED_NO_VARS]);

    const { unmount } = render(
      <TemplateSendPanel conversationId="conv-1" onClose={vi.fn()} onSent={vi.fn()} />,
    );
    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /bienvenida/i }));
    await user.click(screen.getByRole('button', { name: /confirmar y enviar/i }));
    unmount();

    render(<TemplateSendPanel conversationId="conv-1" onClose={vi.fn()} onSent={vi.fn()} />);
    await user.click(screen.getByRole('combobox', { name: /template/i }));
    await user.click(screen.getByRole('option', { name: /bienvenida/i }));
    await user.click(screen.getByRole('button', { name: /confirmar y enviar/i }));

    expect(sendTemplate).toHaveBeenCalledTimes(2);
    const [key1, key2] = sendTemplate.mock.calls.map((call) => call[0].idempotencyKey);
    expect(key2).not.toBe(key1);
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

    await pickApproved(user);
    await fillLiteral(user, '1', 'Juan');
    await fillLiteral(user, '2', '$5.000');
    expect(screen.getByRole('button', { name: /confirmar y enviar/i })).toBeEnabled();
  });
});

describe('Rediseño card (inbox-template-card): header con subtítulo + preview burbuja', () => {
  it('header: subtítulo de contexto visible ("ventana de 24h") + dialog aria-describedby apunta a él', () => {
    renderPanel();
    const dialog = screen.getByRole('dialog');
    const descId = dialog.getAttribute('aria-describedby');
    expect(descId).toBeTruthy();
    expect(document.getElementById(descId!)).toHaveTextContent(/ventana de 24\s?h/i);
  });

  it('sin template elegido: card placeholder de preview visible, SIN burbuja', () => {
    renderPanel();
    expect(screen.getByTestId('template-preview-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('template-preview-bubble')).not.toBeInTheDocument();
  });

  it('al elegir template: la burbuja renderiza el body interpolado y reemplaza al placeholder', async () => {
    const user = userEvent.setup();
    renderPanel();
    await pickApproved(user);

    const bubble = screen.getByTestId('template-preview-bubble');
    expect(bubble).toHaveTextContent(/hola/i);
    expect(screen.queryByTestId('template-preview-placeholder')).not.toBeInTheDocument();
  });

  it('la sección de preview tiene heading "Vista previa" (estructura de card, no un <p> pelado)', async () => {
    const user = userEvent.setup();
    renderPanel();
    await pickApproved(user);
    expect(screen.getByRole('heading', { name: /vista previa/i })).toBeInTheDocument();
  });

  it('interpolación EN VIVO dentro de la burbuja: resolver una variable actualiza el texto de la card', async () => {
    const user = userEvent.setup();
    renderPanel();
    await pickApproved(user);

    await fillLiteral(user, '1', 'Juan');

    const bubble = screen.getByTestId('template-preview-bubble');
    expect(bubble).toHaveTextContent(/hola juan/i);
    // {{2}} sigue pendiente — el marcador vive DENTRO de la burbuja.
    expect(bubble).toContainElement(screen.getByTestId('template-preview-pending-2'));
  });

  it('las 4 ramas del catálogo NO montan la card de preview (loading/error/empty sin canvas)', () => {
    mockTemplates([], { isLoading: true, data: undefined });
    renderPanel();
    expect(screen.queryByTestId('template-preview-placeholder')).not.toBeInTheDocument();
    expect(screen.queryByTestId('template-preview-bubble')).not.toBeInTheDocument();
  });
});

describe('FUENTES: opciones de datos del contexto + texto libre (patrón VariablesMapForm, resolución client-side)', () => {
  it('fuente "Nombre del cliente": valor resuelto visible al lado (readonly) + burbuja interpolada YA RESUELTA', async () => {
    const user = userEvent.setup();
    mockClientContext({ data: RICH_CONTEXT });
    renderPanel({ lightContext: LIGHT_MATCHED });
    await pickApproved(user);

    await pickSource(user, '1', /nombre del cliente/i);

    const resolved = screen.getByTestId('template-var-resolved-1');
    expect(resolved.textContent).toContain('HERNANDEZ RONALD');
    // La burbuja interpola el valor YA RESUELTO — el operador ve el mensaje
    // final EXACTO, no un placeholder "Nombre del cliente".
    const bubble = screen.getByTestId('template-preview-bubble');
    expect(bubble).toHaveTextContent(/hola hernandez ronald/i);
    expect(screen.queryByTestId('template-preview-pending-1')).not.toBeInTheDocument();
  });

  it('fuente "Monto de deuda": resuelve el monto formateado EXACTAMENTE como el panel de contexto (mismo Intl es-AR)', async () => {
    const user = userEvent.setup();
    mockClientContext({ data: RICH_CONTEXT });
    renderPanel({ lightContext: LIGHT_MATCHED });
    await pickApproved(user);

    await pickSource(user, '2', /monto de deuda/i);

    expect(screen.getByTestId('template-var-resolved-2').textContent).toContain(EXPECTED_DEBT);
    expect(screen.getByTestId('template-preview-bubble').textContent).toContain(EXPECTED_DEBT);
  });

  it('payload del envío: viajan los VALORES RESUELTOS como strings — el shape actual NO cambia', async () => {
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
    mockClientContext({ data: RICH_CONTEXT });
    renderPanel({ lightContext: LIGHT_MATCHED });
    await pickApproved(user);

    await pickSource(user, '1', /nombre del cliente/i);
    await pickSource(user, '2', /monto de deuda/i);
    await user.click(screen.getByRole('button', { name: /confirmar y enviar/i }));

    expect(sendTemplate).toHaveBeenCalledTimes(1);
    const [input] = sendTemplate.mock.calls[0];
    expect(input.variables).toEqual({ '1': 'HERNANDEZ RONALD', '2': EXPECTED_DEBT });
  });

  it('sin cliente asociado (unknown): opciones de datos DESHABILITADAS + hint; "Valor fijo" sigue utilizable', async () => {
    const user = userEvent.setup();
    renderPanel({ lightContext: LIGHT_UNKNOWN });
    await pickApproved(user);

    expect(screen.getByText(/sin cliente asociado — usá valor fijo/i)).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: '{{1}}' }));
    expect(screen.getByRole('option', { name: /nombre del cliente/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: /monto de deuda/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: /valor fijo/i })).not.toHaveAttribute('aria-disabled');

    // Clickear la opción deshabilitada NO elige nada (guard del Select propio).
    await user.click(screen.getByRole('option', { name: /nombre del cliente/i }));
    expect(screen.queryByTestId('template-var-resolved-1')).not.toBeInTheDocument();
  });

  it('ambiguous (sin candidato elegido en este panel): mismas opciones de datos deshabilitadas + hint', async () => {
    const user = userEvent.setup();
    renderPanel({ lightContext: LIGHT_AMBIGUOUS });
    await pickApproved(user);

    expect(screen.getByText(/sin cliente asociado — usá valor fijo/i)).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: '{{1}}' }));
    expect(screen.getByRole('option', { name: /nombre del cliente/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: /monto de deuda/i })).toHaveAttribute('aria-disabled', 'true');
  });

  it('cache compartida: matched → useInboxClientContext(conversationId, null) — la MISMA key que ClientContextPanel, jamás un fetch propio', () => {
    mockClientContext({ data: RICH_CONTEXT });
    renderPanel({ lightContext: LIGHT_MATCHED });
    expect(vi.mocked(useWhatsappModule.useInboxClientContext)).toHaveBeenCalledWith('conv-1', null);
  });

  it('cache: sin cliente (unknown) → el hook se llama con conversationId null (enabled:false — NO dispara un fetch que el panel de contexto nunca hizo)', () => {
    renderPanel({ lightContext: LIGHT_UNKNOWN });
    expect(vi.mocked(useWhatsappModule.useInboxClientContext)).toHaveBeenCalledWith(null, null);
    expect(vi.mocked(useWhatsappModule.useInboxClientContext)).not.toHaveBeenCalledWith('conv-1', null);
  });

  it('deuda NO disponible (due:null): "Monto de deuda" deshabilitada aunque haya cliente; "Nombre del cliente" sigue habilitada', async () => {
    const user = userEvent.setup();
    mockClientContext({
      data: {
        ...RICH_CONTEXT,
        client: {
          ...RICH_CONTEXT.client!,
          balance: { ...RICH_CONTEXT.client!.balance, due: null, isDebtor: false },
        },
      },
    });
    renderPanel({ lightContext: LIGHT_MATCHED });
    await pickApproved(user);

    await user.click(screen.getByRole('combobox', { name: '{{1}}' }));
    expect(screen.getByRole('option', { name: /monto de deuda/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('option', { name: /nombre del cliente/i })).not.toHaveAttribute('aria-disabled');
  });

  it('gate: {{1}} resuelta por fuente pero {{2}} en "Valor fijo" VACÍO → confirm disabled; tipear habilita', async () => {
    const user = userEvent.setup();
    mockClientContext({ data: RICH_CONTEXT });
    renderPanel({ lightContext: LIGHT_MATCHED });
    await pickApproved(user);

    await pickSource(user, '1', /nombre del cliente/i);
    await pickSource(user, '2', /valor fijo/i);
    expect(screen.getByRole('button', { name: /confirmar y enviar/i })).toBeDisabled();

    await user.type(screen.getByLabelText('Valor fijo para {{2}}'), EXPECTED_DEBT);
    expect(screen.getByRole('button', { name: /confirmar y enviar/i })).toBeEnabled();
  });

  it('a11y: el combobox de la variable queda descripto por el valor resuelto (aria-describedby, legible por SR)', async () => {
    const user = userEvent.setup();
    mockClientContext({ data: RICH_CONTEXT });
    renderPanel({ lightContext: LIGHT_MATCHED });
    await pickApproved(user);

    await pickSource(user, '1', /nombre del cliente/i);

    const combo = screen.getByRole('combobox', { name: '{{1}}' });
    const descId = combo.getAttribute('aria-describedby');
    expect(descId).toBeTruthy();
    const desc = document.getElementById(descId!);
    expect(desc).toHaveTextContent(/valor resuelto/i);
    expect(desc).toHaveTextContent('HERNANDEZ RONALD');
  });

  it('PIN idempotencia SAGRADA: cambiar la FUENTE de una variable NO regenera la key (mismo template = misma intención)', async () => {
    const user = userEvent.setup();
    const sendTemplate = vi.fn(
      (_input: { templateRef: string; variables: Record<string, string>; idempotencyKey: string }) => {
        // Sin onSuccess: el panel sigue abierto (timeout ambiguo) y el
        // operador cambia la fuente antes de reintentar.
      },
    );
    mockSendTemplate({ sendTemplate });
    mockClientContext({ data: RICH_CONTEXT });
    renderPanel({ lightContext: LIGHT_MATCHED });
    await pickApproved(user);

    await fillLiteral(user, '1', 'Juan');
    await fillLiteral(user, '2', '$5.000');
    await user.click(screen.getByRole('button', { name: /confirmar y enviar/i }));
    const key1 = sendTemplate.mock.calls[0][0].idempotencyKey;

    // Cambia la FUENTE de {{1}} (literal → dato del cliente) y reintenta.
    await pickSource(user, '1', /nombre del cliente/i);
    await user.click(screen.getByRole('button', { name: /confirmar y enviar/i }));
    const key2 = sendTemplate.mock.calls[1][0].idempotencyKey;

    expect(key2).toBe(key1);
    // Y el reintento viaja con el valor RE-resuelto de la fuente nueva.
    expect(sendTemplate.mock.calls[1][0].variables['1']).toBe('HERNANDEZ RONALD');
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
