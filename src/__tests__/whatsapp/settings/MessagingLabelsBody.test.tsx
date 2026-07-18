/**
 * MessagingLabelsBody — ABM del catálogo de etiquetas (Ola 5 — labels). Mocks a
 * nivel de hook (useMessagingLabels + mutations) + ConfirmContext. `Can` se
 * mockea para renderizar children (los permisos no se testean acá — la sección
 * ya va gateada por `messaging.manage` en `WhatsappSettingsPage`).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useWhatsapp');
vi.mock('@/context/ConfirmContext');
vi.mock('@/components/auth/Can', () => ({
  Can: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import * as useWhatsappModule from '@/hooks/useWhatsapp';
import * as ConfirmContextModule from '@/context/ConfirmContext';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';
import { MessagingLabelsBody } from '@/pages/whatsapp/settings/MessagingLabelsBody';
import type { WhatsappLabel } from '@/types/whatsapp';

const LABELS: WhatsappLabel[] = [
  { id: 'l1', name: 'Urgente', color: '#dc3545' },
  { id: 'l2', name: 'Ventas', color: '#28a745' },
];

function makeMutation() {
  return { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false } as unknown as ReturnType<
    typeof useWhatsappModule.useCreateMessagingLabel
  >;
}

function renderBody() {
  return render(
    <MemoryRouter>
      <MessagingLabelsBody />
    </MemoryRouter>,
  );
}

describe('MessagingLabelsBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWhatsappModule.useMessagingLabels).mockReturnValue(
      mockQuery<WhatsappLabel[]>({ data: LABELS, isLoading: false }),
    );
    vi.mocked(useWhatsappModule.useCreateMessagingLabel).mockReturnValue(makeMutation());
    vi.mocked(useWhatsappModule.useUpdateMessagingLabel).mockReturnValue(
      makeMutation() as unknown as ReturnType<typeof useWhatsappModule.useUpdateMessagingLabel>,
    );
    vi.mocked(useWhatsappModule.useDeleteMessagingLabel).mockReturnValue(
      makeMutation() as unknown as ReturnType<typeof useWhatsappModule.useDeleteMessagingLabel>,
    );
    vi.mocked(ConfirmContextModule.useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
  });

  it('renderiza la lista de etiquetas', () => {
    renderBody();
    expect(screen.getByText('Urgente')).toBeInTheDocument();
    expect(screen.getByText('Ventas')).toBeInTheDocument();
  });

  it('el chip de cada etiqueta pinta su color hex (dato)', () => {
    renderBody();
    expect(screen.getAllByTestId('label-chip')[0]).toHaveStyle({ backgroundColor: '#dc3545' });
  });

  it('estado vacío cuando no hay etiquetas', () => {
    vi.mocked(useWhatsappModule.useMessagingLabels).mockReturnValue(
      mockQuery<WhatsappLabel[]>({ data: [], isLoading: false }),
    );
    renderBody();
    expect(screen.getByText(/no hay etiquetas/i)).toBeInTheDocument();
  });

  it('estado de carga', () => {
    vi.mocked(useWhatsappModule.useMessagingLabels).mockReturnValue(
      mockQuery<WhatsappLabel[]>({ data: [], isLoading: true }),
    );
    renderBody();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('abre el modal de creación con "Nueva etiqueta"', () => {
    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /nueva etiqueta/i }));
    expect(screen.getByRole('heading', { name: /nueva etiqueta/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/urgente/i)).toBeInTheDocument();
  });

  it('crea con nombre + color default', async () => {
    const createMock = makeMutation();
    vi.mocked(useWhatsappModule.useCreateMessagingLabel).mockReturnValue(createMock);
    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /nueva etiqueta/i }));
    fireEvent.change(screen.getByPlaceholderText(/urgente/i), { target: { value: 'Reclamo' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar/i }));
    await waitFor(() => {
      expect(createMock.mutateAsync).toHaveBeenCalledWith({ name: 'Reclamo', color: '#6f42c1' });
    });
  });

  it('elegir un preset de color cambia el color enviado', async () => {
    const createMock = makeMutation();
    vi.mocked(useWhatsappModule.useCreateMessagingLabel).mockReturnValue(createMock);
    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /nueva etiqueta/i }));
    fireEvent.change(screen.getByPlaceholderText(/urgente/i), { target: { value: 'Reclamo' } });
    fireEvent.click(screen.getByRole('button', { name: /usar color #dc3545/i }));
    fireEvent.click(screen.getByRole('button', { name: /^guardar/i }));
    await waitFor(() => {
      expect(createMock.mutateAsync).toHaveBeenCalledWith({ name: 'Reclamo', color: '#dc3545' });
    });
  });

  it('el color picker nativo también setea el color', async () => {
    const createMock = makeMutation();
    vi.mocked(useWhatsappModule.useCreateMessagingLabel).mockReturnValue(createMock);
    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /nueva etiqueta/i }));
    fireEvent.change(screen.getByPlaceholderText(/urgente/i), { target: { value: 'Reclamo' } });
    fireEvent.change(screen.getByLabelText(/color de la etiqueta/i), { target: { value: '#123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar/i }));
    await waitFor(() => {
      expect(createMock.mutateAsync).toHaveBeenCalledWith({ name: 'Reclamo', color: '#123456' });
    });
  });

  it('el modal de edición prefilla nombre y color', () => {
    renderBody();
    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    expect(screen.getByDisplayValue('Urgente')).toBeInTheDocument();
    expect(screen.getByLabelText(/color de la etiqueta/i)).toHaveValue('#dc3545');
  });

  it('guarda la edición con el id + data', async () => {
    const updateMock = makeMutation() as unknown as ReturnType<typeof useWhatsappModule.useUpdateMessagingLabel>;
    vi.mocked(useWhatsappModule.useUpdateMessagingLabel).mockReturnValue(updateMock);
    renderBody();
    fireEvent.click(screen.getAllByRole('button', { name: /editar/i })[0]);
    fireEvent.change(screen.getByDisplayValue('Urgente'), { target: { value: 'Muy urgente' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar/i }));
    await waitFor(() => {
      expect(vi.mocked(updateMock.mutateAsync)).toHaveBeenCalledWith({
        id: 'l1',
        data: { name: 'Muy urgente', color: '#dc3545' },
      });
    });
  });

  it('elimina tras confirmar', async () => {
    const deleteMock = makeMutation() as unknown as ReturnType<typeof useWhatsappModule.useDeleteMessagingLabel>;
    vi.mocked(useWhatsappModule.useDeleteMessagingLabel).mockReturnValue(deleteMock);
    renderBody();
    fireEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);
    await waitFor(() => {
      expect(vi.mocked(deleteMock.mutateAsync)).toHaveBeenCalledWith('l1');
    });
  });

  it('NO elimina si el confirm se cancela', async () => {
    vi.mocked(ConfirmContextModule.useConfirm).mockReturnValue(vi.fn().mockResolvedValue(false));
    const deleteMock = makeMutation() as unknown as ReturnType<typeof useWhatsappModule.useDeleteMessagingLabel>;
    vi.mocked(useWhatsappModule.useDeleteMessagingLabel).mockReturnValue(deleteMock);
    renderBody();
    fireEvent.click(screen.getAllByRole('button', { name: /eliminar/i })[0]);
    await waitFor(() => {
      expect(vi.mocked(deleteMock.mutateAsync)).not.toHaveBeenCalled();
    });
  });

  it('muestra el conflicto 409 (nombre duplicado) legible en el modal', async () => {
    const createMock = {
      mutateAsync: vi.fn().mockRejectedValue({
        response: { status: 409, data: { code: 'CONVERSATION_LABEL_NAME_CONFLICT' } },
      }),
      isPending: false,
    } as unknown as ReturnType<typeof useWhatsappModule.useCreateMessagingLabel>;
    vi.mocked(useWhatsappModule.useCreateMessagingLabel).mockReturnValue(createMock);
    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /nueva etiqueta/i }));
    fireEvent.change(screen.getByPlaceholderText(/urgente/i), { target: { value: 'Urgente' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar/i }));
    await waitFor(() => {
      expect(screen.getByText(/ya existe una etiqueta/i)).toBeInTheDocument();
    });
  });

  it('muestra un error 400 legible (nombre/color inválidos)', async () => {
    const createMock = {
      mutateAsync: vi.fn().mockRejectedValue({ response: { status: 400, data: {} } }),
      isPending: false,
    } as unknown as ReturnType<typeof useWhatsappModule.useCreateMessagingLabel>;
    vi.mocked(useWhatsappModule.useCreateMessagingLabel).mockReturnValue(createMock);
    renderBody();
    fireEvent.click(screen.getByRole('button', { name: /nueva etiqueta/i }));
    fireEvent.change(screen.getByPlaceholderText(/urgente/i), { target: { value: '!' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar/i }));
    await waitFor(() => {
      expect(screen.getByText(/no son válidos/i)).toBeInTheDocument();
    });
  });
});
