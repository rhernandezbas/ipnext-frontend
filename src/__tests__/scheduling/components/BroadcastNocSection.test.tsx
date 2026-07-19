/**
 * N3-FE (task-broadcast-fe) — sección "Enviar al NOC por WhatsApp" en el detalle
 * de una tarea de RED.
 *
 * Contrato BE (ya en prod): POST /scheduling/:id/broadcast-noc (gate
 * scheduling:write, body vacío) → { sent, link } o errores tipados:
 *   404 TASK_NOT_FOUND
 *   422 TASK_NOT_BROADCASTABLE   (solo kind='network' se difunde)
 *   503 NOC_BROADCAST_NOT_CONFIGURED
 *   502 EVOLUTION_API_ERROR
 *   422 NOC_BROADCAST_LINK_BASE_MISSING
 *
 * Reglas de visibilidad (RED primero):
 *   - permiso `scheduling.write` OBLIGATORIO
 *   - SOLO tareas de red (kind === 'network'); en tareas de cliente NO se muestra
 * Comportamiento:
 *   - click → confirm suave → POST
 *   - éxito → toast "✅ Enviada al canal del NOC"
 *   - error → mensaje legible por código
 *   - botón deshabilitado mientras el POST está en vuelo (no doble-envío)
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockMutation } from '@/__tests__/_utils/reactQueryMocks';

// El único hook del componente — mockeado para no disparar ningún fetch real
// (PROHIBIDO llamar APIs vivas).
vi.mock('@/hooks/useScheduling', () => ({
  useBroadcastTaskToNoc: vi.fn(),
}));

import { useBroadcastTaskToNoc } from '@/hooks/useScheduling';
import { useCan } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { BroadcastNocSection } from '@/pages/scheduling/SchedulingTaskDetailPage/components/BroadcastNocSection';

/** Error axios-like con el envelope del BE ({ error, code }). */
function axiosErr(code: string, status: number) {
  return { response: { status, data: { error: code, code } } };
}

function renderSection(
  overrides?: Partial<Parameters<typeof BroadcastNocSection>[0]>,
) {
  const onResult = vi.fn();
  const props = {
    taskId: 'task-1',
    taskKind: 'network' as 'customer' | 'network',
    networkSiteName: 'Nodo Centro' as string | null,
    onResult,
    ...overrides,
  };
  const utils = render(<BroadcastNocSection {...props} />);
  return { ...utils, onResult };
}

describe('BroadcastNocSection', () => {
  let mutateAsync: ReturnType<typeof vi.fn>;
  let confirmFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.mocked(useCan).mockReturnValue(true);
    mutateAsync = vi.fn().mockResolvedValue({ sent: true, link: 'https://app/x' });
    vi.mocked(useBroadcastTaskToNoc).mockReturnValue(
      mockMutation({ mutateAsync: mutateAsync as unknown as (...a: unknown[]) => unknown }),
    );
    confirmFn = vi.fn().mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn as unknown as ReturnType<typeof useConfirm>);
  });

  // ── Visibilidad ────────────────────────────────────────────────────────────
  it('tarea de red con scheduling.write → botón visible', () => {
    renderSection();
    expect(useCan).toHaveBeenCalledWith('scheduling.write');
    expect(
      screen.getByRole('button', { name: /enviar al noc/i }),
    ).toBeInTheDocument();
  });

  it('sin scheduling.write → NO se ve el botón', () => {
    vi.mocked(useCan).mockReturnValue(false);
    renderSection();
    expect(
      screen.queryByRole('button', { name: /enviar al noc/i }),
    ).not.toBeInTheDocument();
  });

  it('tarea de cliente (kind=customer) → NO se ve el botón', () => {
    renderSection({ taskKind: 'customer' });
    expect(
      screen.queryByRole('button', { name: /enviar al noc/i }),
    ).not.toBeInTheDocument();
  });

  // ── Badge de última difusión (trazabilidad) ──────────────────────────────────
  it('muestra el badge de última difusión con fecha y usuario cuando lastBroadcastAt está seteado', () => {
    renderSection({ lastBroadcastAt: '2026-06-01T15:30:00.000Z', lastBroadcastByName: 'Juan Pérez' });
    // formatDateTimeShort(...Z) → AR (UTC-3) = 01 jun 2026 - 12:30
    expect(
      screen.getByText(/última difusión: 01 jun 2026 - 12:30 · juan pérez/i),
    ).toBeInTheDocument();
  });

  it('cae a "—" cuando hay fecha de difusión pero sin nombre de usuario', () => {
    renderSection({ lastBroadcastAt: '2026-06-01T15:30:00.000Z', lastBroadcastByName: null });
    expect(
      screen.getByText(/última difusión: 01 jun 2026 - 12:30 · —/i),
    ).toBeInTheDocument();
  });

  it('NO muestra el badge de última difusión cuando lastBroadcastAt es null', () => {
    renderSection({ lastBroadcastAt: null, lastBroadcastByName: null });
    expect(screen.queryByText(/última difusión/i)).not.toBeInTheDocument();
  });

  // ── Confirm + POST ───────────────────────────────────────────────────────────
  it('click → confirm suave → POST', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole('button', { name: /enviar al noc/i }));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    // El confirm nombra el canal del NOC.
    const arg = confirmFn.mock.calls[0]![0] as { message: string };
    expect(String(arg.message)).toMatch(/canal del noc/i);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
  });

  it('confirm rechazado → NO postea', async () => {
    confirmFn.mockResolvedValue(false);
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole('button', { name: /enviar al noc/i }));

    await waitFor(() => expect(confirmFn).toHaveBeenCalled());
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  // ── Toast de éxito ───────────────────────────────────────────────────────────
  it('éxito → onResult("✅ Enviada al canal del NOC", "success")', async () => {
    const user = userEvent.setup();
    const { onResult } = renderSection();
    await user.click(screen.getByRole('button', { name: /enviar al noc/i }));

    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith(
        expect.stringMatching(/enviada al canal del noc/i),
        'success',
      ),
    );
  });

  // ── Errores por código ───────────────────────────────────────────────────────
  const errorCases: Array<[string, number, RegExp]> = [
    ['NOC_BROADCAST_NOT_CONFIGURED', 503, /configurá la difusión noc primero/i],
    ['EVOLUTION_API_ERROR', 502, /evolution\/pi/i],
    ['NOC_BROADCAST_LINK_BASE_MISSING', 422, /url pública de la app/i],
    ['TASK_NOT_BROADCASTABLE', 422, /solo las tareas de red/i],
    ['TASK_NOT_FOUND', 404, /tarea no encontrada/i],
  ];

  it.each(errorCases)(
    'error %s (%i) → onResult con mensaje legible',
    async (code, status, expected) => {
      mutateAsync.mockRejectedValue(axiosErr(code, status));
      const user = userEvent.setup();
      const { onResult } = renderSection();
      await user.click(screen.getByRole('button', { name: /enviar al noc/i }));

      await waitFor(() =>
        expect(onResult).toHaveBeenCalledWith(
          expect.stringMatching(expected),
          'error',
        ),
      );
    },
  );

  it('código desconocido → mensaje de fallback', async () => {
    mutateAsync.mockRejectedValue(axiosErr('WAT', 500));
    const user = userEvent.setup();
    const { onResult } = renderSection();
    await user.click(screen.getByRole('button', { name: /enviar al noc/i }));

    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith(expect.any(String), 'error'),
    );
    const msg = (onResult.mock.calls[0]![0] as string).toLowerCase();
    expect(msg).toMatch(/no se pudo enviar al noc/i);
  });

  // ── Anti doble-envío ─────────────────────────────────────────────────────────
  it('deshabilitado mientras el POST está en vuelo (isPending)', () => {
    vi.mocked(useBroadcastTaskToNoc).mockReturnValue(
      mockMutation({
        mutateAsync: mutateAsync as unknown as (...a: unknown[]) => unknown,
        isPending: true,
      }),
    );
    renderSection();
    expect(screen.getByRole('button', { name: /enviar al noc/i })).toBeDisabled();
  });
});
