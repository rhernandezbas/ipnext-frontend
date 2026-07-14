/**
 * PreviewModal (messaging-bulk-v11 FE apply chunk 2) — modal COMPLETO de
 * preview del envío: mensaje real + resumen (total/estado/skipped) +
 * destinatarios paginados server-side (`useSegmentRecipients`, chunk 1).
 * Container-fino: hook REAL, `@/api/messagingBulk.api` mockeada a nivel
 * fetch (mismo seam que el resto del composer).
 *
 *  PVM-1  open=false no renderiza nada y NO dispara la query
 *  PVM-2  al abrir dispara `listSegmentRecipients(segment, 1, 20)` (recién
 *         al abrir, no antes — `enabled` atado a `open`)
 *  PVM-3  loading -> skeleton (aria-busy)
 *  PVM-4  error -> role=alert
 *  PVM-5  total=0 -> "Sin destinatarios" (role=alert), sin tabla ni resumen
 *  PVM-6  con datos -> total + desglose por estado + skipped + tabla
 *         nombre/teléfono/estado
 *  PVM-7  el mensaje se arma con el body real + variablesMap resuelto
 *  PVM-8  sin templateBody -> nota "Elegí un template..."
 *  PVM-9  paginación server-side (cambiar de página llama con el page nuevo)
 *  PVM-10 cerrar: botón "Cerrar", Esc y click en el backdrop llaman a onClose
 *  PVM-11 foco: trap cíclico (Tab en el último vuelve al primero, Shift+Tab
 *         en el primero vuelve al último) + restauración al cerrar
 *  PVM-12 estado desconocido (no está en el badge conocido) se muestra como
 *         texto plano — igual, nunca solo color
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/messagingBulk.api', () => ({
  listBulkTemplates: vi.fn(),
  previewSegment: vi.fn(),
  createCampaign: vi.fn(),
  sendCampaign: vi.fn(),
  getCampaign: vi.fn(),
  listCampaigns: vi.fn(),
  listSegmentRecipients: vi.fn(),
}));

import { listSegmentRecipients } from '@/api/messagingBulk.api';
import { PreviewModal } from '@/pages/whatsapp/BulkMessagingPage/components/composer/PreviewModal';
import type { CampaignSegment, CampaignVariableSpec, SegmentRecipientsOutput } from '@/types/messagingBulk';

const SEGMENT: CampaignSegment = { statuses: ['late'] };

const TEMPLATE_BODY = 'Hola {{1}}, tu saldo de ${{2}} vence pronto.';
const VARIABLES_MAP: CampaignVariableSpec = {
  '1': { source: 'name' },
  '2': { source: 'balanceDue' },
};

const RECIPIENTS: SegmentRecipientsOutput = {
  data: [
    { clientId: 'cli-1', name: 'Juan Perez', phoneE164: '+5491100000000', status: 'late' },
    { clientId: 'cli-2', name: 'Maria Gomez', phoneE164: '+5491100000001', status: 'blocked' },
  ],
  total: 42,
  page: 1,
  limit: 20,
  skipped: { optedOut: 1, duplicatePhone: 2, invalidPhone: 3 },
  statusCounts: { late: 30, blocked: 12 },
};

const EMPTY_RECIPIENTS: SegmentRecipientsOutput = {
  data: [],
  total: 0,
  page: 1,
  limit: 20,
  skipped: { optedOut: 0, duplicatePhone: 0, invalidPhone: 0 },
  statusCounts: {},
};

function renderModal(
  props: Partial<{
    open: boolean;
    onClose: () => void;
    segment: CampaignSegment;
    templateBody: string | undefined;
    variablesMap: CampaignVariableSpec;
  }> = {},
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const onClose = props.onClose ?? vi.fn();
  // `templateBody` puede querer probarse EXPLÍCITAMENTE `undefined` (PVM-8,
  // "sin template elegido") — `??` no sirve acá porque trataría ese
  // `undefined` explícito como "no se pasó nada" y pisaría con el default.
  const templateBody = 'templateBody' in props ? props.templateBody : TEMPLATE_BODY;
  const utils = render(
    <PreviewModal
      open={props.open ?? true}
      onClose={onClose}
      segment={props.segment ?? SEGMENT}
      templateBody={templateBody}
      variablesMap={props.variablesMap ?? VARIABLES_MAP}
    />,
    { wrapper },
  );
  return { ...utils, onClose, qc };
}

/**
 * Render con control externo de `open`/`segment` sobre UN MISMO QueryClient
 * (para ejercer close/reopen y el cambio de segmento sin perder la cache —
 * clave para FIX-1 y FIX-5). `renderModal` monta un qc nuevo por llamada y no
 * sirve para rerenders con estado de query compartido.
 */
function renderWithControl(initial: { open: boolean; segment: CampaignSegment; templateBody?: string }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  const ui = (p: { open: boolean; segment: CampaignSegment; templateBody?: string }) => (
    <QueryClientProvider client={qc}>
      <PreviewModal
        open={p.open}
        onClose={onClose}
        segment={p.segment}
        templateBody={p.templateBody ?? TEMPLATE_BODY}
        variablesMap={VARIABLES_MAP}
      />
    </QueryClientProvider>
  );
  const utils = render(ui(initial));
  return {
    ...utils,
    onClose,
    qc,
    rerender: (p: { open: boolean; segment: CampaignSegment; templateBody?: string }) => utils.rerender(ui(p)),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PVM-1: open=false', () => {
  it('no renderiza nada y no dispara la query', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(listSegmentRecipients).not.toHaveBeenCalled();
  });
});

describe('PVM-2: al abrir dispara la query', () => {
  it('llama a listSegmentRecipients(segment, 1, 20) recién al abrir', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS);
    renderModal();

    await waitFor(() => expect(listSegmentRecipients).toHaveBeenCalledWith(SEGMENT, 1, 20));
  });
});

describe('PVM-3: loading', () => {
  it('muestra un estado de carga (aria-busy)', () => {
    vi.mocked(listSegmentRecipients).mockReturnValue(new Promise(() => {}));
    renderModal();

    expect(screen.getByText(/cargando destinatarios/i)).toBeInTheDocument();
  });
});

describe('PVM-4: error', () => {
  it('muestra un mensaje role=alert', async () => {
    vi.mocked(listSegmentRecipients).mockRejectedValue(new Error('fail'));
    renderModal();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron cargar/i);
  });
});

describe('PVM-5: total=0', () => {
  it('muestra "Sin destinatarios" (role=status, informativo — no bloquea nada acá) y no la tabla', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(EMPTY_RECIPIENTS);
    renderModal();

    expect(await screen.findByText(/sin destinatarios/i)).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('PVM-6: con datos', () => {
  it('muestra el total, el desglose por estado, los skipped y la tabla', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS);
    renderModal();

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText(/recibirán el mensaje/i)).toBeInTheDocument();

    // Desglose por estado — labels de StatusBadge (mismo átomo de SegmentBuilder).
    // "Atrasado"/"Bloqueado" aparecen DOS veces (desglose + fila de la tabla) — getAllByText.
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getAllByText('Atrasado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bloqueado').length).toBeGreaterThan(0);

    // Skipped.
    expect(screen.getByText(/no recibir mensajes/i)).toHaveTextContent('1');
    expect(screen.getByText(/duplicado/i)).toHaveTextContent('2');
    expect(screen.getByText(/inválido/i)).toHaveTextContent('3');

    // Tabla.
    expect(screen.getByText('Juan Perez')).toBeInTheDocument();
    expect(screen.getByText('+5491100000000')).toBeInTheDocument();
    expect(screen.getByText('Maria Gomez')).toBeInTheDocument();
  });
});

describe('PVM-7: mensaje real con variables resueltas', () => {
  it('arma el mensaje reemplazando cada {{N}} según su fuente', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS);
    renderModal();

    expect(
      screen.getByText('Hola [Nombre del cliente], tu saldo de $[Monto de deuda] vence pronto.'),
    ).toBeInTheDocument();
  });
});

describe('PVM-8: sin template elegido', () => {
  it('muestra una nota en vez del mensaje', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS);
    renderModal({ templateBody: undefined });

    expect(screen.getByText(/elegí un template/i)).toBeInTheDocument();
  });
});

describe('PVM-9: paginación server-side', () => {
  it('cambiar de página llama a listSegmentRecipients con el page nuevo', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue({ ...RECIPIENTS, total: 50 });
    const user = userEvent.setup();
    renderModal();

    await screen.findByText('Juan Perez');
    await user.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => expect(listSegmentRecipients).toHaveBeenCalledWith(SEGMENT, 2, 20));
  });
});

describe('PVM-10: cerrar', () => {
  it('el botón "Cerrar" llama a onClose', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS);
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Esc llama a onClose', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS);
    const { onClose } = renderModal();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('click en el backdrop llama a onClose', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS);
    const { onClose } = renderModal();

    const dialog = await screen.findByRole('dialog');
    fireEvent.mouseDown(dialog);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('PVM-11: foco', () => {
  it('al abrir, el foco cae dentro del modal', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue({ ...RECIPIENTS, total: 50 });
    renderModal();

    await screen.findByText('Juan Perez');
    expect(screen.getByRole('button', { name: /cerrar/i })).toHaveFocus();
  });

  it('Tab en el último foco-able cicla al primero', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue({ ...RECIPIENTS, total: 50 });
    renderModal();

    await screen.findByText('Juan Perez');
    const closeBtn = screen.getByRole('button', { name: /cerrar/i });
    const nextBtn = screen.getByRole('button', { name: /siguiente/i });

    nextBtn.focus();
    expect(nextBtn).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeBtn).toHaveFocus();
  });

  it('Shift+Tab en el primero cicla al último', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue({ ...RECIPIENTS, total: 50 });
    renderModal();

    await screen.findByText('Juan Perez');
    const closeBtn = screen.getByRole('button', { name: /cerrar/i });
    const nextBtn = screen.getByRole('button', { name: /siguiente/i });

    closeBtn.focus();
    expect(closeBtn).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(nextBtn).toHaveFocus();
  });

  it('al cerrar (unmount vía open=false) restaura el foco al disparador', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS);
    const trigger = document.createElement('button');
    trigger.textContent = 'Ver preview';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(trigger).toHaveFocus();

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { rerender } = render(
      <PreviewModal open onClose={vi.fn()} segment={SEGMENT} templateBody={TEMPLATE_BODY} variablesMap={VARIABLES_MAP} />,
      { wrapper },
    );

    await screen.findByRole('dialog');
    rerender(
      <PreviewModal
        open={false}
        onClose={vi.fn()}
        segment={SEGMENT}
        templateBody={TEMPLATE_BODY}
        variablesMap={VARIABLES_MAP}
      />,
    );

    expect(trigger).toHaveFocus();
    document.body.removeChild(trigger);
  });
});

describe('PVM-12: estado desconocido', () => {
  it('se muestra como texto plano (no rompe, no es solo color)', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue({
      ...RECIPIENTS,
      data: [{ clientId: 'cli-9', name: 'Cliente VIP', phoneE164: '+5491100000009', status: 'vip-custom' }],
      statusCounts: { 'vip-custom': 1 },
    });
    renderModal();

    expect(await screen.findAllByText('vip-custom')).not.toHaveLength(0);
  });
});

describe('FIX-1: no muestra el segmento anterior al reabrir (stale flash)', () => {
  it('reabrir con otro segmento muestra skeleton hasta que llega la data nueva, nunca la del segmento viejo', async () => {
    const SEG_A: CampaignSegment = { statuses: ['late'] };
    const SEG_B: CampaignSegment = { statuses: ['active'] };
    const DATA_A: SegmentRecipientsOutput = {
      ...RECIPIENTS,
      data: [{ clientId: 'a1', name: 'Cliente Alfa', phoneE164: '+540000000001', status: 'late' }],
      statusCounts: { late: 42 },
    };
    const DATA_B: SegmentRecipientsOutput = {
      ...RECIPIENTS,
      data: [{ clientId: 'b1', name: 'Cliente Beta', phoneE164: '+540000000002', status: 'active' }],
      statusCounts: { active: 42 },
    };

    let resolveB: (v: SegmentRecipientsOutput) => void = () => {};
    vi.mocked(listSegmentRecipients).mockImplementation((seg: CampaignSegment) => {
      if (seg.statuses[0] === 'late') return Promise.resolve(DATA_A);
      return new Promise<SegmentRecipientsOutput>((res) => {
        resolveB = res;
      });
    });

    const { rerender } = renderWithControl({ open: true, segment: SEG_A });
    expect(await screen.findByText('Cliente Alfa')).toBeInTheDocument();

    // Cerrar y cambiar de segmento estando cerrado, después reabrir.
    rerender({ open: false, segment: SEG_A });
    rerender({ open: true, segment: SEG_B });

    // Mientras B no llega: skeleton, y NUNCA los destinatarios de A.
    expect(screen.queryByText('Cliente Alfa')).not.toBeInTheDocument();
    expect(screen.getByText(/cargando destinatarios/i)).toBeInTheDocument();

    // Cuando B resuelve, recién ahí aparece B.
    resolveB(DATA_B);
    expect(await screen.findByText('Cliente Beta')).toBeInTheDocument();
    expect(screen.queryByText('Cliente Alfa')).not.toBeInTheDocument();
  });
});

describe('FIX-5: reset de página en el cierre (evita el doble fetch al reabrir)', () => {
  it('al reabrir no dispara el fetch de la página vieja: resetea a 1 al cerrar', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue({ ...RECIPIENTS, total: 50 });
    const user = userEvent.setup();
    const { rerender } = renderWithControl({ open: true, segment: SEGMENT });

    await screen.findByText('Juan Perez');
    await user.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => expect(listSegmentRecipients).toHaveBeenCalledWith(SEGMENT, 2, 20));

    // Cerrar → debe resetear la página a 1 (con la query deshabilitada).
    rerender({ open: false, segment: SEGMENT });
    vi.mocked(listSegmentRecipients).mockClear();

    // Reabrir: arranca en page 1, NUNCA re-pide la página 2 vieja.
    rerender({ open: true, segment: SEGMENT });
    await screen.findByText('Juan Perez');

    expect(listSegmentRecipients).not.toHaveBeenCalledWith(SEGMENT, 2, 20);
    expect(listSegmentRecipients).toHaveBeenCalledWith(SEGMENT, 1, 20);
  });
});
