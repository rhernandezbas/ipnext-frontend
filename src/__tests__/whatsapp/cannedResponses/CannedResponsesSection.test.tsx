/**
 * CannedResponsesSection — gestión (ABM) de respuestas rápidas / macros (Ola 4),
 * sección de la página de Configuración de WhatsApp. Container: hooks REALES
 * (`useCannedResponses`), `@/api/cannedResponses.api` mockeada a nivel fetch
 * (mismo seam que `WhatsappTemplatesPage.test`).
 *
 *  CRS-1 loading → skeleton del DataTable
 *  CRS-2 error → role=alert + "Reintentar" (refetch)
 *  CRS-3 empty → CTA "Crear respuesta rápida"
 *  CRS-4 success → filas con shortcut + preview del content
 *  CRS-5 crear OK → createCannedResponse({shortcut,content}) + toast + cierra
 *  CRS-6 crear 409 SHORTCUT_TAKEN → serverError legible (role=alert), NO cierra
 *  CRS-7 crear 400 → validación client-side bloquea submit vacío
 *  CRS-8 editar → updateCannedResponse(id, {...}) con el form precargado + toast
 *  CRS-9 borrar → confirm (danger) → deleteCannedResponse(id) + toast
 */
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import type { ReactNode } from 'react';

vi.mock('@/api/cannedResponses.api', () => ({
  listCannedResponses: vi.fn(),
  createCannedResponse: vi.fn(),
  updateCannedResponse: vi.fn(),
  deleteCannedResponse: vi.fn(),
}));

import {
  listCannedResponses,
  createCannedResponse,
  updateCannedResponse,
  deleteCannedResponse,
} from '@/api/cannedResponses.api';
import { CannedResponsesSection } from '@/components/settings/cannedResponses/CannedResponsesSection';
import type { CannedResponse } from '@/types/cannedResponses';

const SALUDO: CannedResponse = {
  id: 'cr-1',
  shortcut: 'saludo',
  content: 'Hola, ¿en qué te puedo ayudar?',
  createdById: 'u1',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};
const DESPEDIDA: CannedResponse = {
  ...SALUDO,
  id: 'cr-2',
  shortcut: 'despedida',
  content: 'Gracias por comunicarte.',
};

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

function renderSection() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(<CannedResponsesSection />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CRS-1: loading', () => {
  it('muestra el skeleton del DataTable mientras carga', () => {
    vi.mocked(listCannedResponses).mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });
});

describe('CRS-2: error', () => {
  it('muestra role=alert y un botón Reintentar que vuelve a pedir la lista', async () => {
    vi.mocked(listCannedResponses).mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce([SALUDO]);
    const user = userEvent.setup();
    renderSection();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron cargar/i);
    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    await waitFor(() => expect(listCannedResponses).toHaveBeenCalledTimes(2));
  });
});

describe('CRS-3: empty', () => {
  it('muestra el CTA de crear cuando no hay respuestas rápidas', async () => {
    vi.mocked(listCannedResponses).mockResolvedValue([]);
    renderSection();

    expect(await screen.findByText(/todav[ií]a no hay respuestas r[aá]pidas/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /crear respuesta r[aá]pida/i }).length).toBeGreaterThan(0);
  });
});

describe('CRS-4: success', () => {
  it('renderiza filas con shortcut y preview del content', async () => {
    vi.mocked(listCannedResponses).mockResolvedValue([SALUDO, DESPEDIDA]);
    renderSection();

    expect(await screen.findByText('saludo')).toBeInTheDocument();
    expect(screen.getByText('despedida')).toBeInTheDocument();
    expect(screen.getByText(/en qué te puedo ayudar/i)).toBeInTheDocument();
  });
});

describe('CRS-5: crear OK', () => {
  it('crea con {shortcut,content}, muestra toast y cierra el modal', async () => {
    vi.mocked(listCannedResponses).mockResolvedValue([]);
    vi.mocked(createCannedResponse).mockResolvedValue({ ...SALUDO, id: 'cr-new' });
    const user = userEvent.setup();
    renderSection();

    await screen.findByText(/todav[ií]a no hay/i);
    await user.click(screen.getAllByRole('button', { name: /crear respuesta r[aá]pida/i })[0]);

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/atajo/i), 'saludo');
    await user.type(within(dialog).getByLabelText(/contenido/i), 'Hola, ¿en qué te puedo ayudar?');
    await user.click(within(dialog).getByRole('button', { name: /^crear$/i }));

    await waitFor(() =>
      expect(createCannedResponse).toHaveBeenCalledWith({
        shortcut: 'saludo',
        content: 'Hola, ¿en qué te puedo ayudar?',
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/creada/i);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('CRS-6: crear 409 SHORTCUT_TAKEN', () => {
  it('muestra el serverError legible y NO cierra el modal', async () => {
    vi.mocked(listCannedResponses).mockResolvedValue([]);
    vi.mocked(createCannedResponse).mockRejectedValue(
      makeAxiosError(409, { error: 'ya existe', code: 'SHORTCUT_TAKEN' }),
    );
    const user = userEvent.setup();
    renderSection();

    await screen.findByText(/todav[ií]a no hay/i);
    await user.click(screen.getAllByRole('button', { name: /crear respuesta r[aá]pida/i })[0]);

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/atajo/i), 'saludo');
    await user.type(within(dialog).getByLabelText(/contenido/i), 'Hola');
    await user.click(within(dialog).getByRole('button', { name: /^crear$/i }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/atajo ya está en uso/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('CRS-7: crear — validación client-side', () => {
  it('submit con campos vacíos no crea y marca el error inline', async () => {
    vi.mocked(listCannedResponses).mockResolvedValue([]);
    const user = userEvent.setup();
    renderSection();

    await screen.findByText(/todav[ií]a no hay/i);
    await user.click(screen.getAllByRole('button', { name: /crear respuesta r[aá]pida/i })[0]);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^crear$/i }));

    expect(createCannedResponse).not.toHaveBeenCalled();
    expect(within(dialog).getAllByRole('alert').length).toBeGreaterThan(0);
  });
});

describe('CRS-8: editar', () => {
  it('abre el form precargado y actualiza con updateCannedResponse(id, input) + toast', async () => {
    vi.mocked(listCannedResponses).mockResolvedValue([SALUDO]);
    vi.mocked(updateCannedResponse).mockResolvedValue({ ...SALUDO, content: 'Hola de nuevo' });
    const user = userEvent.setup();
    renderSection();

    await screen.findByText('saludo');
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(await screen.findByRole('menuitem', { name: /editar/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/atajo/i)).toHaveValue('saludo');
    const content = within(dialog).getByLabelText(/contenido/i);
    fireEvent.change(content, { target: { value: 'Hola de nuevo' } });
    await user.click(within(dialog).getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(updateCannedResponse).toHaveBeenCalledWith(
        'cr-1',
        expect.objectContaining({ shortcut: 'saludo', content: 'Hola de nuevo' }),
      ),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/actualizada/i);
  });
});

describe('CRS-9: borrar', () => {
  it('pide confirmación (danger) y borra al confirmar + toast', async () => {
    vi.mocked(listCannedResponses).mockResolvedValue([SALUDO]);
    vi.mocked(deleteCannedResponse).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderSection();

    await screen.findByText('saludo');
    await user.click(screen.getByRole('button', { name: 'Acciones' }));
    await user.click(await screen.findByRole('menuitem', { name: /borrar/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/saludo/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /borrar/i }));

    await waitFor(() => expect(deleteCannedResponse).toHaveBeenCalledWith('cr-1'));
    expect(await screen.findByRole('status')).toHaveTextContent(/eliminada/i);
  });
});
