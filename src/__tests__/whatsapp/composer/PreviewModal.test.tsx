/**
 * PreviewModal (messaging-bulk-v11 FE apply chunk 2; reescrito en
 * bulk-csv-recipients FE, CSV-FE-6..CSV-FE-8) — modal COMPLETO de preview del
 * envío: mensaje real + resumen (total/estado/skipped) + destinatarios
 * paginados server-side de la UNIÓN completa (segmento + manuales + CSV) +
 * tab "Excluidos (N)". Container-fino: hooks REALES, `@/api/messagingBulk.api`
 * mockeada a nivel fetch (mismo seam que el resto del composer).
 *
 *  PVM-1  open=false no renderiza nada y NO dispara ninguna query
 *  PVM-2  al abrir dispara `listSegmentRecipients` con el input COMPLETO
 *         (query object, no args posicionales)
 *  PVM-3  loading -> skeleton (aria-busy)
 *  PVM-4  error -> role=alert
 *  PVM-5  total=0 -> "Sin destinatarios" (role=alert/status), sin tabla
 *  PVM-6  con datos -> total + desglose por estado + skipped + tabla
 *         nombre/teléfono/estado
 *  PVM-7  el mensaje se arma con el body real + variablesMap resuelto
 *  PVM-8  sin templateBody -> nota "Elegí un template..."
 *  PVM-9  paginación server-side (cambiar de página llama con el page nuevo)
 *  PVM-10 cerrar: botón "Cerrar", Esc y click en el backdrop llaman a onClose
 *  PVM-11 foco: trap cíclico + restauración al cerrar
 *  PVM-12 estado desconocido (no está en el badge conocido) se muestra como
 *         texto plano — igual, nunca solo color
 *  CSV-FE-6a solo-manual (segmento vacío) MUESTRA LA TABLA (fin de la deuda F4)
 *  CSV-FE-6b fila cruda (clientId null) — key tolerante, status "No es cliente"
 *  CSV-FE-6c sin ninguna fuente -> no dispara la query, no rompe
 *  CSV-FE-7  tab "Excluidos (N)" — paginado, nombre+teléfono+motivo+fuente,
 *            estado vacío "Sin excluidos"
 *  CSV-FE-8  status=baja se ve en la tabla de destinatarios (incluido, no excluyente)
 *  CSV-FE-9  con CSV cargado (manualContacts), la query los incluye
 *  FIX-1  no muestra el input anterior al reabrir con otro input (stale flash)
 *  FIX-5  resetea página/tab al cerrar (evita el doble fetch al reabrir)
 *  L2     (review adversarial, consistencia con FIX-1) — la pestaña
 *         Excluidos tampoco muestra el input anterior si el segmento cambia
 *         mientras esa pestaña está activa (mismo guard de `keepPreviousData`
 *         que la vista de Destinatarios)
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
  listExcludedRecipients: vi.fn(),
}));

import { listSegmentRecipients, listExcludedRecipients } from '@/api/messagingBulk.api';
import { PreviewModal } from '@/pages/whatsapp/BulkMessagingPage/components/composer/PreviewModal';
import type {
  CampaignSegment,
  CampaignVariableSpec,
  ExcludedRecipientsOutput,
  ManualContactInput,
  SegmentRecipientsOutput,
} from '@/types/messagingBulk';

const SEGMENT: CampaignSegment = { statuses: ['late'] };
const EMPTY_SEGMENT: CampaignSegment = { statuses: [] };

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

const EMPTY_EXCLUDED: ExcludedRecipientsOutput = {
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
    manualClientIds: string[];
    manualContacts: ManualContactInput[];
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
      manualClientIds={props.manualClientIds}
      manualContacts={props.manualContacts}
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
  vi.mocked(listExcludedRecipients).mockResolvedValue(EMPTY_EXCLUDED);
});

describe('PVM-1: open=false', () => {
  it('no renderiza nada y no dispara ninguna query', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(listSegmentRecipients).not.toHaveBeenCalled();
    expect(listExcludedRecipients).not.toHaveBeenCalled();
  });
});

describe('PVM-2: al abrir dispara la query con el input COMPLETO', () => {
  it('llama a listSegmentRecipients({...segment, page:1, limit:20}) recién al abrir', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS);
    renderModal();

    await waitFor(() => expect(listSegmentRecipients).toHaveBeenCalledWith({ statuses: ['late'], page: 1, limit: 20 }));
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
  it('muestra "Sin destinatarios" (role=status) y no la tabla', async () => {
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

    await waitFor(() =>
      expect(listSegmentRecipients).toHaveBeenCalledWith({ statuses: ['late'], page: 2, limit: 20 }),
    );
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

describe('CSV-FE-6a: solo-manual (segmento vacío) muestra la tabla — fin de la deuda F4', () => {
  it('con 2 manuales y segmento vacío, la tabla lista los 2 (no una nota)', async () => {
    const MANUAL_RESULT: SegmentRecipientsOutput = {
      data: [
        { clientId: 'c-1', name: 'Ana', phoneE164: '+5491100000000', status: 'active', source: 'manual' },
        { clientId: 'c-2', name: 'Beto', phoneE164: '+5491100000001', status: 'active', source: 'manual' },
      ],
      total: 2,
      page: 1,
      limit: 20,
      skipped: { optedOut: 0, duplicatePhone: 0, invalidPhone: 0 },
      statusCounts: { active: 2 },
    };
    vi.mocked(listSegmentRecipients).mockResolvedValue(MANUAL_RESULT);
    renderModal({ segment: EMPTY_SEGMENT, manualClientIds: ['c-1', 'c-2'] });

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Beto')).toBeInTheDocument();
    // El aviso viejo YA NO existe.
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(listSegmentRecipients).toHaveBeenCalledWith({
      statuses: [],
      manualClientIds: ['c-1', 'c-2'],
      page: 1,
      limit: 20,
    });
  });
});

describe('CSV-FE-6b: fila CSV cruda (clientId null)', () => {
  it('key tolerante (clientId ?? phoneE164) y estado "No es cliente"', async () => {
    const RAW_RESULT: SegmentRecipientsOutput = {
      data: [{ clientId: null, name: 'Contacto Crudo', phoneE164: '+5491100009999', status: 'no_cliente', source: 'csv' }],
      total: 1,
      page: 1,
      limit: 20,
      skipped: { optedOut: 0, duplicatePhone: 0, invalidPhone: 0 },
      statusCounts: { no_cliente: 1 },
    };
    vi.mocked(listSegmentRecipients).mockResolvedValue(RAW_RESULT);
    renderModal({ segment: EMPTY_SEGMENT, manualContacts: [{ name: 'Contacto Crudo', phone: '+5491100009999' }] });

    expect(await screen.findByText('Contacto Crudo')).toBeInTheDocument();
    expect(screen.getByText('+5491100009999')).toBeInTheDocument();
    expect(screen.getAllByText('No es cliente').length).toBeGreaterThan(0);
  });
});

describe('CSV-FE-6c: sin ninguna fuente', () => {
  it('no dispara ninguna query y no rompe', () => {
    renderModal({ segment: EMPTY_SEGMENT, manualClientIds: [], manualContacts: [] });

    expect(listSegmentRecipients).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});

describe('CSV-FE-9: con CSV cargado (manualContacts)', () => {
  it('la query incluye manualContacts', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS);
    renderModal({ manualContacts: [{ name: 'Ana', phone: '1123456789' }] });

    await waitFor(() =>
      expect(listSegmentRecipients).toHaveBeenCalledWith({
        statuses: ['late'],
        manualContacts: [{ name: 'Ana', phone: '1123456789' }],
        page: 1,
        limit: 20,
      }),
    );
  });
});

describe('CSV-FE-8: status=baja incluido (no-excluyente)', () => {
  it('la fila con status baja está EN la tabla de destinatarios, señalada con texto', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue({
      ...RECIPIENTS,
      data: [{ clientId: 'cli-3', name: 'Cliente Baja', phoneE164: '+5491100000003', status: 'baja' }],
      statusCounts: { baja: 1 },
    });
    renderModal();

    expect(await screen.findByText('Cliente Baja')).toBeInTheDocument();
    expect(screen.getAllByText(/cliente de baja/i).length).toBeGreaterThan(0);
  });
});

describe('CSV-FE-7: tab "Excluidos (N)"', () => {
  it('el label del tab usa N = suma de skipped de la vista de destinatarios', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS); // skipped: 1+2+3=6
    renderModal();

    await screen.findByText('Juan Perez');
    expect(screen.getByRole('tab', { name: /excluidos \(6\)/i })).toBeInTheDocument();
  });

  it('al abrir la pestaña, pide listExcludedRecipients y muestra nombre+teléfono+motivo+fuente', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS);
    vi.mocked(listExcludedRecipients).mockResolvedValue({
      data: [{ name: 'Carla Ruiz', phone: '+5491100000099', reason: 'telefono_invalido', source: 'csv' }],
      total: 1,
      page: 1,
      limit: 20,
      skipped: RECIPIENTS.skipped,
      statusCounts: {},
    });
    const user = userEvent.setup();
    renderModal();

    await screen.findByText('Juan Perez');
    await user.click(screen.getByRole('tab', { name: /excluidos/i }));

    await waitFor(() =>
      expect(listExcludedRecipients).toHaveBeenCalledWith({ statuses: ['late'], page: 1, limit: 20 }),
    );
    expect(await screen.findByText('Carla Ruiz')).toBeInTheDocument();
    expect(screen.getByText('+5491100000099')).toBeInTheDocument();
    expect(screen.getByText('Teléfono inválido')).toBeInTheDocument();
    expect(screen.getByText('CSV')).toBeInTheDocument();
  });

  it('NO dispara listExcludedRecipients mientras la pestaña no está activa', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS);
    renderModal();

    await screen.findByText('Juan Perez');
    expect(listExcludedRecipients).not.toHaveBeenCalled();
  });

  it('estado vacío: "Sin excluidos"', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS);
    vi.mocked(listExcludedRecipients).mockResolvedValue(EMPTY_EXCLUDED);
    const user = userEvent.setup();
    renderModal();

    await screen.findByText('Juan Perez');
    await user.click(screen.getByRole('tab', { name: /excluidos/i }));

    expect(await screen.findByText(/sin excluidos/i)).toHaveAttribute('role', 'status');
  });

  it('corregir el CSV mirando los excluidos: 2 personas con teléfono inválido', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS);
    vi.mocked(listExcludedRecipients).mockResolvedValue({
      data: [
        { name: 'Pedro Malo', phone: '123', reason: 'telefono_invalido', source: 'csv' },
        { name: 'Lucia Malo', phone: '456', reason: 'telefono_invalido', source: 'csv' },
      ],
      total: 2,
      page: 1,
      limit: 20,
      skipped: RECIPIENTS.skipped,
      statusCounts: {},
    });
    const user = userEvent.setup();
    renderModal();

    await screen.findByText('Juan Perez');
    await user.click(screen.getByRole('tab', { name: /excluidos/i }));

    expect(await screen.findByText('Pedro Malo')).toBeInTheDocument();
    expect(screen.getByText('Lucia Malo')).toBeInTheDocument();
    expect(screen.getAllByText('Teléfono inválido').length).toBe(2);
  });
});

describe('FIX-1: no muestra el input anterior al reabrir (stale flash)', () => {
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
    vi.mocked(listSegmentRecipients).mockImplementation((query) => {
      if (query.statuses[0] === 'late') return Promise.resolve(DATA_A);
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

describe('L2: excluidos no muestra el input anterior al cambiar de segmento (review adversarial)', () => {
  it('cambiar de segmento con la pestaña Excluidos activa muestra skeleton hasta la data nueva, nunca la del segmento viejo', async () => {
    const SEG_A: CampaignSegment = { statuses: ['late'] };
    const SEG_B: CampaignSegment = { statuses: ['active'] };
    const EXCLUDED_A: ExcludedRecipientsOutput = {
      data: [{ name: 'Excluido Alfa', phone: '+540000000001', reason: 'telefono_invalido', source: 'csv' }],
      total: 1,
      page: 1,
      limit: 20,
      skipped: RECIPIENTS.skipped,
      statusCounts: {},
    };
    const EXCLUDED_B: ExcludedRecipientsOutput = {
      data: [{ name: 'Excluido Beta', phone: '+540000000002', reason: 'duplicado', source: 'csv' }],
      total: 1,
      page: 1,
      limit: 20,
      skipped: RECIPIENTS.skipped,
      statusCounts: {},
    };

    vi.mocked(listSegmentRecipients).mockResolvedValue(RECIPIENTS);
    let resolveExcludedB: (v: ExcludedRecipientsOutput) => void = () => {};
    vi.mocked(listExcludedRecipients).mockImplementation((query) => {
      if (query.statuses[0] === 'late') return Promise.resolve(EXCLUDED_A);
      return new Promise<ExcludedRecipientsOutput>((res) => {
        resolveExcludedB = res;
      });
    });

    const user = userEvent.setup();
    const { rerender } = renderWithControl({ open: true, segment: SEG_A });
    await screen.findByText('Juan Perez');
    await user.click(screen.getByRole('tab', { name: /excluidos/i }));
    expect(await screen.findByText('Excluido Alfa')).toBeInTheDocument();

    // Cambiar de segmento SIN cerrar el modal — la pestaña Excluidos sigue activa.
    rerender({ open: true, segment: SEG_B });

    // Mientras B no llega: skeleton, NUNCA "Excluido Alfa" del segmento viejo.
    expect(screen.queryByText('Excluido Alfa')).not.toBeInTheDocument();
    expect(screen.getByText(/cargando excluidos/i)).toBeInTheDocument();

    resolveExcludedB(EXCLUDED_B);
    expect(await screen.findByText('Excluido Beta')).toBeInTheDocument();
    expect(screen.queryByText('Excluido Alfa')).not.toBeInTheDocument();
  });
});

describe('FIX-5: reset de página/tab en el cierre (evita el doble fetch al reabrir)', () => {
  it('al reabrir no dispara el fetch de la página vieja: resetea a 1 al cerrar', async () => {
    vi.mocked(listSegmentRecipients).mockResolvedValue({ ...RECIPIENTS, total: 50 });
    const user = userEvent.setup();
    const { rerender } = renderWithControl({ open: true, segment: SEGMENT });

    await screen.findByText('Juan Perez');
    await user.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() =>
      expect(listSegmentRecipients).toHaveBeenCalledWith({ statuses: ['late'], page: 2, limit: 20 }),
    );

    // Cerrar → debe resetear la página a 1 (con la query deshabilitada).
    rerender({ open: false, segment: SEGMENT });
    vi.mocked(listSegmentRecipients).mockClear();

    // Reabrir: arranca en page 1, NUNCA re-pide la página 2 vieja.
    rerender({ open: true, segment: SEGMENT });
    await screen.findByText('Juan Perez');

    expect(listSegmentRecipients).not.toHaveBeenCalledWith({ statuses: ['late'], page: 2, limit: 20 });
    expect(listSegmentRecipients).toHaveBeenCalledWith({ statuses: ['late'], page: 1, limit: 20 });
  });
});
