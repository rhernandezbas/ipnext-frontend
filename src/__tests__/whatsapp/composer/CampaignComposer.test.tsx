/**
 * CampaignComposer — container-fino del tab "Nueva campaña" (F2 apply chunk
 * 2). Orquesta `useTemplates`/`usePreviewSegment`/`useCreateCampaign`
 * (hooks REALES, `@/api/messagingBulk.api` mockeada a nivel fetch — mismo
 * seam que `useBulkMessaging.test.ts`) + los 4 presentacionales del
 * composer. `useMyPermissions` se mockea directo (mismo patrón que
 * `WhatsappInboxPage.test.tsx`).
 *
 *  CC-1 sin permiso "messaging.templates" → NO fetchea templates, no se
 *       muestra el selector
 *  CC-2 elegir un template muestra sus variables (via TemplateSelector)
 *  CC-3 con variables sin mapear → "Crear campaña" deshabilitado
 *  CC-4 sin criterio de segmento → preview no se dispara, panel derecho
 *       muestra la nota, botón deshabilitado
 *  CC-5 tildar un estado dispara el preview automático tras el debounce (500ms)
 *  CC-6 preview count=0 → "Crear campaña" deshabilitado (EMPTY_SEGMENT guard)
 *  CC-7 todo completo → "Crear campaña" habilitado; click llama a
 *       createCampaign con el payload correcto, muestra el toast
 *       (role=alert) y llama a onCampaignCreated con el id
 *  CC-8 422 MISSING_TEMPLATE_VARIABLES → resalta la variable rechazada
 *  CC-9 botón "Ver preview" manual dispara sin esperar el debounce
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/api/messagingBulk.api', () => ({
  listBulkTemplates: vi.fn(),
  previewSegment: vi.fn(),
  createCampaign: vi.fn(),
  sendCampaign: vi.fn(),
  getCampaign: vi.fn(),
  listCampaigns: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions');

import { listBulkTemplates, previewSegment, createCampaign } from '@/api/messagingBulk.api';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { CampaignComposer } from '@/pages/whatsapp/BulkMessagingPage/components/composer/CampaignComposer';
import type { PreviewSegmentOutput, TemplateSummaryDto } from '@/types/messagingBulk';

const TEMPLATE: TemplateSummaryDto = {
  contentSid: 'HX123',
  friendlyName: 'Recordatorio de pago',
  language: 'es',
  variables: ['1', '2'],
  approvalStatus: 'approved',
  sendable: true,
};

const PREVIEW: PreviewSegmentOutput = {
  count: 42,
  sample: [{ clientId: 'cli-1', name: 'Juan Perez', phoneE164: '+5491100000000' }],
  skipped: { optedOut: 0, duplicatePhone: 0, invalidPhone: 0 },
};

const ZERO_PREVIEW: PreviewSegmentOutput = {
  count: 0,
  sample: [],
  skipped: { optedOut: 0, duplicatePhone: 0, invalidPhone: 0 },
};

function mockPerms(granted: boolean) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: granted ? ['messaging.templates'] : [],
    isLoading: false,
    isError: false,
    can: () => granted,
  } as UseMyPermissionsResult);
}

function renderComposer(onCampaignCreated = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { ...render(<CampaignComposer onCampaignCreated={onCampaignCreated} />, { wrapper }), onCampaignCreated, qc };
}

async function selectTemplateAndMapVariables() {
  const user = userEvent.setup({ delay: null });
  await user.selectOptions(screen.getByRole('combobox', { name: /template/i }), 'HX123');
  await user.selectOptions(screen.getByRole('combobox', { name: '{{1}}' }), 'name');
  await user.selectOptions(screen.getByRole('combobox', { name: '{{2}}' }), 'balanceDue');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms(true);
  vi.mocked(listBulkTemplates).mockResolvedValue([TEMPLATE]);
  vi.mocked(previewSegment).mockResolvedValue(PREVIEW);
  vi.mocked(createCampaign).mockResolvedValue({ campaignId: 'camp-1', total: 42, status: 'pending' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CC-1: gate de permiso messaging.templates', () => {
  it('sin el permiso, NO fetchea templates ni muestra el selector', async () => {
    mockPerms(false);
    renderComposer();

    await waitFor(() => expect(screen.getByRole('checkbox', { name: /atrasado/i })).toBeInTheDocument());
    expect(listBulkTemplates).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox', { name: /template/i })).not.toBeInTheDocument();
  });
});

describe('CC-2: elegir un template', () => {
  it('muestra sus variables en VariablesMapForm', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await user.selectOptions(screen.getByRole('combobox', { name: /template/i }), 'HX123');

    expect(screen.getByRole('combobox', { name: '{{1}}' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '{{2}}' })).toBeInTheDocument();
  });
});

describe('CC-3: variables sin mapear', () => {
  it('"Crear campaña" queda deshabilitado', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await user.selectOptions(screen.getByRole('combobox', { name: /template/i }), 'HX123');

    expect(screen.getByRole('button', { name: /crear campaña/i })).toBeDisabled();
  });
});

describe('CC-4: sin criterio de segmento', () => {
  it('el panel de preview muestra la nota y el botón "Ver preview" está deshabilitado', async () => {
    renderComposer();
    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());

    expect(screen.getByText(/elegí al menos un criterio/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver preview/i })).toBeDisabled();
    expect(previewSegment).not.toHaveBeenCalled();
  });
});

describe('CC-5: preview automático con debounce', () => {
  it('tildar un estado dispara previewSegment recién a los 500ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderComposer();
    await vi.waitFor(() => expect(screen.getByRole('checkbox', { name: /atrasado/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox', { name: /atrasado/i }));
    expect(previewSegment).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(previewSegment).toHaveBeenCalledWith({ statuses: ['late'] });
  });
});

describe('CC-6: preview con count=0', () => {
  it('deshabilita "Crear campaña" (guard EMPTY_SEGMENT)', async () => {
    vi.mocked(previewSegment).mockResolvedValue(ZERO_PREVIEW);
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('checkbox', { name: /atrasado/i })).toBeInTheDocument());
    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));
    await user.click(screen.getByRole('button', { name: /ver preview/i }));

    await waitFor(() => expect(screen.getByText(/0 destinatarios/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /crear campaña/i })).toBeDisabled();
  });
});

describe('CC-7: flujo completo de creación', () => {
  it('con todo completo, "Crear campaña" se habilita; al click crea la campaña, muestra el toast y navega', async () => {
    const user = userEvent.setup();
    const onCampaignCreated = vi.fn();
    renderComposer(onCampaignCreated);

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await selectTemplateAndMapVariables();
    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));
    await user.click(screen.getByRole('button', { name: /ver preview/i }));
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Recordatorio julio');

    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    await user.click(createButton);

    await waitFor(() => expect(createCampaign).toHaveBeenCalledWith({
      name: 'Recordatorio julio',
      templateRef: 'HX123',
      templateName: 'Recordatorio de pago',
      segment: { statuses: ['late'] },
      variablesMap: { '1': { source: 'name', value: undefined }, '2': { source: 'balanceDue', value: undefined } },
    }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/recordatorio julio/i);
    expect(onCampaignCreated).toHaveBeenCalledWith('camp-1');
  });
});

describe('CC-8: 422 MISSING_TEMPLATE_VARIABLES', () => {
  it('resalta la variable rechazada por el servidor', async () => {
    const axiosError = Object.assign(new Error('422'), {
      isAxiosError: true,
      response: {
        status: 422,
        data: { error: 'Faltan variables', code: 'MISSING_TEMPLATE_VARIABLES', missing: ['2'] },
      },
    });
    vi.mocked(createCampaign).mockRejectedValue(axiosError);
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await selectTemplateAndMapVariables();
    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));
    await user.click(screen.getByRole('button', { name: /ver preview/i }));
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Recordatorio julio');

    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    await user.click(createButton);

    await waitFor(() => expect(screen.getByText(/falta mapear/i)).toBeInTheDocument());
  });
});

describe('CC-9: botón "Ver preview" manual', () => {
  it('dispara previewSegment sin esperar el debounce', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('checkbox', { name: /atrasado/i })).toBeInTheDocument());
    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));
    await user.click(screen.getByRole('button', { name: /ver preview/i }));

    await waitFor(() => expect(previewSegment).toHaveBeenCalledWith({ statuses: ['late'] }));
  });
});

describe('CC-10: error de creación que NO es 422-MISSING (FIX-3b)', () => {
  it('surface un error de servidor (EMPTY_SEGMENT/etc.) con role=alert — el botón no queda "sin hacer nada"', async () => {
    const axiosError = Object.assign(new Error('400'), {
      isAxiosError: true,
      response: { status: 400, data: { error: 'segmento vacío', code: 'EMPTY_SEGMENT' } },
    });
    vi.mocked(createCampaign).mockRejectedValue(axiosError);
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await selectTemplateAndMapVariables();
    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));
    await user.click(screen.getByRole('button', { name: /ver preview/i }));
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Recordatorio julio');

    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    await user.click(createButton);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/segmento|no se pudo crear/i);
  });
});

describe('CC-11: preview stale invalida la creación (FIX-5)', () => {
  it('editar el segmento (aunque siga válido) invalida el preview previo → "Crear campaña" se re-bloquea', async () => {
    const user = userEvent.setup();
    renderComposer();

    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());
    await selectTemplateAndMapVariables();
    await user.click(screen.getByRole('checkbox', { name: /atrasado/i }));
    await user.click(screen.getByRole('button', { name: /ver preview/i }));
    await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/nombre de la campaña/i), 'Recordatorio julio');

    const createButton = screen.getByRole('button', { name: /crear campaña/i });
    await waitFor(() => expect(createButton).toBeEnabled());

    // El operador cambia el segmento: el count de 42 ya no corresponde al
    // segmento actual — no se puede crear con ese número viejo.
    await user.click(screen.getByRole('checkbox', { name: /bloqueado/i }));

    expect(createButton).toBeDisabled();
  });
});

describe('CC-12: hint del primer paso sin template (FIX-8a)', () => {
  it('sin template elegido, guía al operador a elegir uno', async () => {
    renderComposer();
    await waitFor(() => expect(screen.getByRole('combobox', { name: /template/i })).toBeInTheDocument());

    expect(screen.getByText(/elegí un template/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear campaña/i })).toBeDisabled();
  });
});
