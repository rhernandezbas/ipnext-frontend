/**
 * fiber-serial-fe (K3-FE) — campo "Serial ONU" del detalle de tarea.
 *
 * El técnico carga el serial del sticker de la ONU en la tarea; el watcher del
 * BE (flag fiber-auto-provision-watcher) aprovisiona sola la ONU cuando aparece
 * en SmartOLT. El PUT /scheduling/:id acepta `onuSerial` (el BE normaliza a
 * UPPERCASE sin espacios; 8-24 alfanumérico tras normalizar; null = limpiar).
 *
 * Reglas (RED primero):
 *  - Visibilidad: MISMO gate de forma de tarea que ProvisionOnuSection
 *    (installation + contrato + señal de tecnología no wireless/cable) pero SIN
 *    network.manage — cargar el serial es el paso del TÉCNICO y debe verse
 *    aunque el aprovisionamiento manual esté apagado para ese usuario.
 *  - Edición: gate scheduling.write (el mismo permiso que edita el resto de los
 *    campos de la tarea — fotos, estado general, PUT del BE). Sin permiso el
 *    valor se muestra read-only.
 *  - Guardar manda el texto CRUDO (se puede pegar "hwtc 1111 2222") y muestra
 *    el valor normalizado que devuelve el BE.
 *  - Limpiar (null) pide confirm SUAVE (sin tone danger).
 *  - 400 VALIDATION_ERROR → error legible "8 a 24 caracteres alfanuméricos".
 *  - a11y: input con aria-describedby del hint (y del error cuando hay).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockMutation } from '@/__tests__/_utils/reactQueryMocks';

// PROHIBIDO llamar APIs vivas — el hook de guardado se mockea entero.
vi.mock('@/hooks/useScheduling', () => ({
  useUpdateTask: vi.fn(),
}));

import { useUpdateTask } from '@/hooks/useScheduling';
import { useCan } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { OnuSerialField } from '@/pages/scheduling/SchedulingTaskDetailPage/components/OnuSerialField';

function renderField(overrides?: Partial<Parameters<typeof OnuSerialField>[0]>) {
  const props = {
    taskId: 'task-1',
    taskCategory: 'installation' as const,
    contractId: 'c-1',
    contractTechnology: 'FTTH' as string | null | undefined,
    onuSerial: null as string | null,
    ...overrides,
  };
  return render(<OnuSerialField {...props} />);
}

describe('OnuSerialField (K3-FE)', () => {
  // Sin anotación explícita: `ReturnType<typeof vi.fn>` resuelve al overload
  // unión (Procedure | Constructable) de vitest 4 y rompe la asignabilidad
  // contra ConfirmFn/AnyFn. La inferencia del initializer da Mock<Procedure>.
  let mutateAsync = vi.fn();
  let confirmFn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCan).mockReturnValue(true);
    mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useUpdateTask).mockReturnValue(mockMutation({ mutateAsync }));
    confirmFn = vi.fn().mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
  });

  // ── Visibilidad (gate de forma de tarea, SIN network.manage) ───────────────

  it('instalación FTTH con contrato → input con label, hint y botón Guardar', () => {
    renderField();
    expect(screen.getByLabelText(/serial onu/i)).toBeInTheDocument();
    expect(
      screen.getByText(/escaneá o tipeá el serial del sticker de la onu/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/la aprovisiona sola al conectarse/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar serial/i })).toBeInTheDocument();
  });

  it('el hint está linkeado al input vía aria-describedby', () => {
    renderField();
    const input = screen.getByLabelText(/serial onu/i);
    const hint = screen.getByText(/escaneá o tipeá el serial del sticker/i);
    expect(hint.id).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toContain(hint.id);
  });

  it('tarea que NO es instalación → oculto', () => {
    renderField({ taskCategory: 'repair' });
    expect(screen.queryByLabelText(/serial onu/i)).not.toBeInTheDocument();
  });

  it('tarea sin contrato asociado → oculto', () => {
    renderField({ contractId: null });
    expect(screen.queryByLabelText(/serial onu/i)).not.toBeInTheDocument();
  });

  it('contrato wireless (señal limpia de NO-fibra) → oculto', () => {
    renderField({ contractTechnology: 'Wireless' });
    expect(screen.queryByLabelText(/serial onu/i)).not.toBeInTheDocument();
  });

  it('contrato cable (HFC) → oculto', () => {
    renderField({ contractTechnology: 'HFC' });
    expect(screen.queryByLabelText(/serial onu/i)).not.toBeInTheDocument();
  });

  it('sin señal de tecnología (null) → visible (mismo fallback que ProvisionOnuSection)', () => {
    renderField({ contractTechnology: null });
    expect(screen.getByLabelText(/serial onu/i)).toBeInTheDocument();
  });

  it('tecnología desconocida (undefined — contrato no resuelto) → visible', () => {
    renderField({ contractTechnology: undefined });
    expect(screen.getByLabelText(/serial onu/i)).toBeInTheDocument();
  });

  // ── Gate de edición: scheduling.write ──────────────────────────────────────

  it('sin scheduling.write: sin input ni botones, el serial se muestra read-only', () => {
    vi.mocked(useCan).mockImplementation((perm: string) => perm !== 'scheduling.write');
    renderField({ onuSerial: 'HWTC11112222' });
    expect(useCan).toHaveBeenCalledWith('scheduling.write');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('HWTC11112222')).toBeInTheDocument();
  });

  it('sin scheduling.write y sin serial → "Sin serial cargado"', () => {
    vi.mocked(useCan).mockImplementation((perm: string) => perm !== 'scheduling.write');
    renderField({ onuSerial: null });
    expect(screen.getByText(/sin serial cargado/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  // ── Guardar ────────────────────────────────────────────────────────────────

  it('guardar manda el texto crudo (pegable con espacios) y muestra el normalizado devuelto', async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue({ onuSerial: 'HWTC11112222' });
    renderField();

    await user.type(screen.getByLabelText(/serial onu/i), 'hwtc 1111 2222');
    await user.click(screen.getByRole('button', { name: /guardar serial/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        id: 'task-1',
        data: { onuSerial: 'hwtc 1111 2222' },
      });
    });
    // El input refleja el valor normalizado que devolvió el BE.
    expect(screen.getByLabelText(/serial onu/i)).toHaveValue('HWTC11112222');
  });

  it('guardar deshabilitado con el input vacío', () => {
    renderField();
    expect(screen.getByRole('button', { name: /guardar serial/i })).toBeDisabled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('input y botones disabled mientras guarda (isPending)', () => {
    vi.mocked(useUpdateTask).mockReturnValue(mockMutation({ mutateAsync, isPending: true }));
    renderField({ onuSerial: 'ABC12345' });
    expect(screen.getByLabelText(/serial onu/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /limpiar/i })).toBeDisabled();
  });

  // ── Errores ────────────────────────────────────────────────────────────────

  it('400 VALIDATION_ERROR → error legible "8 a 24 caracteres alfanuméricos" linkeado al input', async () => {
    const user = userEvent.setup();
    mutateAsync.mockRejectedValue({
      response: { status: 400, data: { code: 'VALIDATION_ERROR', message: 'Invalid onuSerial' } },
    });
    renderField();

    await user.type(screen.getByLabelText(/serial onu/i), 'abc');
    await user.click(screen.getByRole('button', { name: /guardar serial/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/8 a 24 caracteres alfanuméricos/i);
    const input = screen.getByLabelText(/serial onu/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(alert.id).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toContain(alert.id);
  });

  it('error no-400 → fallback legible sin código pelado', async () => {
    const user = userEvent.setup();
    mutateAsync.mockRejectedValue({ response: { status: 500, data: {} } });
    renderField();

    await user.type(screen.getByLabelText(/serial onu/i), 'HWTC11112222');
    await user.click(screen.getByRole('button', { name: /guardar serial/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/no se pudo guardar el serial/i);
  });

  // ── Limpiar (null) con confirm suave ───────────────────────────────────────

  it('limpiar pide confirm SUAVE (sin tone danger) y manda onuSerial: null', async () => {
    const user = userEvent.setup();
    renderField({ onuSerial: 'HWTC11112222' });

    await user.click(screen.getByRole('button', { name: /limpiar/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ id: 'task-1', data: { onuSerial: null } });
    });
    expect(confirmFn).toHaveBeenCalledTimes(1);
    const opts = confirmFn.mock.calls[0]![0] as { tone?: string; title?: string };
    expect(opts.title).toMatch(/limpiar/i);
    // Confirm suave: NO danger.
    expect(opts.tone).not.toBe('danger');
  });

  it('limpiar cancelado → NO muta', async () => {
    const user = userEvent.setup();
    confirmFn.mockResolvedValue(false);
    renderField({ onuSerial: 'HWTC11112222' });

    await user.click(screen.getByRole('button', { name: /limpiar/i }));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('sin serial guardado NO hay botón Limpiar', () => {
    renderField({ onuSerial: null });
    expect(screen.queryByRole('button', { name: /limpiar/i })).not.toBeInTheDocument();
  });
});
