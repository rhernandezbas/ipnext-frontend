/**
 * WhatsappTemplatesPage — ABM de templates WhatsApp (Change 3). Container:
 * hooks REALES (`useTemplatesAdmin`), `@/api/messagingTemplates.api` mockeada
 * a nivel fetch (mismo seam que `CampaignComposer.test`). `useMyPermissions`
 * viene del mock global permisivo (setup.ts, can:()=>true) → los `<Can
 * messaging.bulk>` renderizan las acciones de escritura.
 *
 *  WTP-1 loading → skeleton del DataTable
 *  WTP-2 error → role=alert + botón "Reintentar" (refetch)
 *  WTP-3 empty → CTA "Crear template"
 *  WTP-4 success → filas con nombre/idioma/categoría + badge de status Meta
 *        (label textual, no-solo-color) para los 4 estados
 *  WTP-5 crear: abre el form (role=dialog), category con Select PROPIO (combobox, no <select>)
 *  WTP-6 crear: validación — submit deshabilitado sin body/categoría
 *  WTP-7 crear OK → createTemplate con el payload (variables derivadas del body) + toast
 *  WTP-8 crear error → serverError visible (role=alert), el modal NO se cierra
 *  WTP-9 submit-for-approval: solo en 'unsubmitted' → submitTemplate(sid,{name,category}) + toast
 *  WTP-10 borrar: modal danger con impacto ("TAMBIÉN de WhatsApp/Meta") → deleteTemplate + toast
 *  WTP-11 borrar 409 TEMPLATE_IN_USE → muestra los campaignIds, NO cierra como éxito
 *  WTP-12 clonar: form pre-cargado con el body del origen (título "Clonar template")
 */
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import type { ReactNode } from 'react';

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
import WhatsappTemplatesPage from '@/pages/whatsapp/WhatsappTemplatesPage/WhatsappTemplatesPage';
import type { TemplateDetailDto } from '@/types/messagingTemplates';

const APPROVED: TemplateDetailDto = {
  contentSid: 'HX_approved',
  friendlyName: 'Recordatorio de pago',
  language: 'es',
  variables: ['1', '2'],
  approvalStatus: 'approved',
  category: 'UTILITY',
  sendable: true,
  body: 'Hola {{1}}, tu saldo de ${{2}} vence pronto.',
};

const UNSUBMITTED: TemplateDetailDto = {
  contentSid: 'HX_draft',
  friendlyName: 'Promo verano',
  language: 'es',
  variables: ['1'],
  approvalStatus: 'unsubmitted',
  category: 'MARKETING',
  sendable: false,
  body: 'Hola {{1}}, mirá esta promo.',
};

const PENDING: TemplateDetailDto = { ...APPROVED, contentSid: 'HX_pending', friendlyName: 'Aviso corte', approvalStatus: 'pending' };
const REJECTED: TemplateDetailDto = { ...APPROVED, contentSid: 'HX_rejected', friendlyName: 'Oferta rechazada', approvalStatus: 'rejected' };

function makeAxiosError(status: number, data: unknown): AxiosError {
  const error = new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST');
  error.response = {
    status,
    statusText: '',
    headers: {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture mínimo
    config: { headers: new AxiosHeaders() } as any,
    data,
  };
  return error;
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(<WhatsappTemplatesPage />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WTP-1: loading', () => {
  it('muestra el skeleton del DataTable mientras carga', () => {
    vi.mocked(listTemplates).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});

describe('WTP-2: error', () => {
  it('muestra role=alert y un botón Reintentar que vuelve a pedir la lista', async () => {
    vi.mocked(listTemplates).mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce([APPROVED]);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron cargar/i);
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(listTemplates).toHaveBeenCalledTimes(2));
  });
});

describe('WTP-3: empty', () => {
  it('muestra el CTA de crear cuando no hay templates', async () => {
    vi.mocked(listTemplates).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/todavía no hay templates/i)).toBeInTheDocument();
    // El CTA del empty + el del header → hay al menos un "Crear template".
    expect(screen.getAllByRole('button', { name: /crear template/i }).length).toBeGreaterThan(0);
  });
});

describe('WTP-4: success — lista con status Meta', () => {
  it('renderiza filas y el badge textual de los 4 estados (no-solo-color)', async () => {
    vi.mocked(listTemplates).mockResolvedValue([APPROVED, UNSUBMITTED, PENDING, REJECTED]);
    renderPage();

    expect(await screen.findByText('Recordatorio de pago')).toBeInTheDocument();
    expect(screen.getByText('Promo verano')).toBeInTheDocument();
    // Labels textuales del badge (indicador NUNCA solo-color).
    expect(screen.getByText('Aprobado')).toBeInTheDocument();
    expect(screen.getByText('Borrador')).toBeInTheDocument();
    expect(screen.getByText('En revisión')).toBeInTheDocument();
    expect(screen.getByText('Rechazado')).toBeInTheDocument();
  });
});

describe('WTP-5/6: crear — form + Select propio + validación (validate-on-click)', () => {
  it('category es Select PROPIO (no <select>); submit con campos vacíos no crea y marca el combobox inválido', async () => {
    vi.mocked(listTemplates).mockResolvedValue([APPROVED]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Recordatorio de pago');
    await user.click(screen.getByRole('button', { name: /crear template/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Nuevo template')).toBeInTheDocument();

    // Select PROPIO: combobox accesible, NO un <select> nativo.
    const combobox = within(dialog).getByRole('combobox', { name: /categoría/i });
    expect(combobox).toBeInTheDocument();
    expect(dialog.querySelector('select')).toBeNull();

    // Validación validate-on-click (a11y: botón NO disabled-dead-end): submit
    // con todo vacío NO crea, marca el combobox inválido y anuncia el error.
    await user.click(within(dialog).getByRole('button', { name: 'Crear template' }));
    expect(createTemplate).not.toHaveBeenCalled();
    expect(combobox).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).getByText('Elegí una categoría.')).toBeInTheDocument();
  });
});

describe('WTP-7: crear OK', () => {
  it('llama a createTemplate con el payload (variables derivadas) y muestra un toast', async () => {
    vi.mocked(listTemplates).mockResolvedValue([APPROVED]);
    vi.mocked(createTemplate).mockResolvedValue({ ...APPROVED, contentSid: 'HX_new', approvalStatus: 'unsubmitted' });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Recordatorio de pago');
    await user.click(screen.getByRole('button', { name: /crear template/i }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText('Nombre visible'), 'Aviso');
    // fireEvent.change: userEvent.type interpreta `{{` como escape (produciría `{`).
    fireEvent.change(within(dialog).getByLabelText('Cuerpo del mensaje'), {
      target: { value: 'Hola {{1}} y {{2}}' },
    });
    await user.click(within(dialog).getByRole('combobox', { name: /categoría/i }));
    await user.click(await screen.findByRole('option', { name: /utilidad/i }));
    await user.click(within(dialog).getByRole('button', { name: 'Crear template' }));

    await waitFor(() =>
      expect(createTemplate).toHaveBeenCalledWith({
        friendlyName: 'Aviso',
        language: 'es',
        category: 'UTILITY',
        body: 'Hola {{1}} y {{2}}',
        variables: ['1', '2'],
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/template creado/i);
  });
});

describe('WTP-8: crear con error del proveedor', () => {
  it('muestra el serverError (role=alert) y NO cierra el modal', async () => {
    vi.mocked(listTemplates).mockResolvedValue([APPROVED]);
    vi.mocked(createTemplate).mockRejectedValue(makeAxiosError(422, { code: 'PROVIDER_REJECTED' }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Recordatorio de pago');
    await user.click(screen.getByRole('button', { name: /crear template/i }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText('Nombre visible'), 'Aviso');
    await user.type(within(dialog).getByLabelText('Cuerpo del mensaje'), 'Hola {{1}}');
    await user.click(within(dialog).getByRole('combobox', { name: /categoría/i }));
    await user.click(await screen.findByRole('option', { name: /utilidad/i }));
    await user.click(within(dialog).getByRole('button', { name: 'Crear template' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/whatsapp rechazó/i);
    // El modal sigue abierto.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('WTP-9: enviar a aprobación', () => {
  it('solo disponible en borradores → submitTemplate(sid,{name,category}) + toast', async () => {
    vi.mocked(listTemplates).mockResolvedValue([UNSUBMITTED]);
    vi.mocked(submitTemplate).mockResolvedValue({ contentSid: UNSUBMITTED.contentSid, submitted: true });
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Promo verano');
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(await screen.findByRole('menuitem', { name: /enviar a aprobación/i }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /enviar a aprobación/i }));

    await waitFor(() =>
      expect(submitTemplate).toHaveBeenCalledWith(
        UNSUBMITTED.contentSid,
        expect.objectContaining({ category: 'MARKETING' }),
      ),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/en revisión/i);
  });
});

describe('WTP-10: borrar (danger + impacto)', () => {
  it('muestra el impacto en Meta y borra al confirmar', async () => {
    vi.mocked(listTemplates).mockResolvedValue([APPROVED]);
    vi.mocked(deleteTemplate).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Recordatorio de pago');
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Borrar' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/también de whatsapp\/meta/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /borrar definitivamente/i }));

    await waitFor(() => expect(deleteTemplate).toHaveBeenCalledWith(APPROVED.contentSid));
    expect(await screen.findByRole('status')).toHaveTextContent(/borrado/i);
  });
});

describe('WTP-11: borrar 409 TEMPLATE_IN_USE', () => {
  it('muestra las campañas que bloquean y NO cierra como éxito', async () => {
    vi.mocked(listTemplates).mockResolvedValue([APPROVED]);
    vi.mocked(deleteTemplate).mockRejectedValue(
      makeAxiosError(409, {
        error: 'El template está en uso',
        code: 'TEMPLATE_IN_USE',
        campaignIds: ['camp-abc', 'camp-def'],
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Recordatorio de pago');
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Borrar' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /borrar definitivamente/i }));

    // Muestra las campañas que bloquean.
    expect(await within(dialog).findByText('camp-abc')).toBeInTheDocument();
    expect(within(dialog).getByText('camp-def')).toBeInTheDocument();
    // NO se cerró como éxito: sigue el diálogo, NO hay toast de borrado.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('WTP-12: clonar (editar aprobado)', () => {
  it('abre el form en modo clonar con el body del origen pre-cargado', async () => {
    vi.mocked(listTemplates).mockResolvedValue([APPROVED]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Recordatorio de pago');
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Clonar' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Clonar template')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Cuerpo del mensaje')).toHaveValue(APPROVED.body);
  });
});
