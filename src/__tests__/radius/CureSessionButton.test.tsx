/**
 * Tests — radius-session-autocure FE-1: botón "Curar sesión colgada" (REQ-FE-CURE-2,
 * S2.1-S2.5). Doble confirmación (nunca automática), 200/409/502 diferenciados,
 * refresco del tab de curas tras cualquier intento.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/context/ConfirmContext', () => ({
  useConfirm: vi.fn(),
}));
vi.mock('@/hooks/useRadiusSessionCures', () => ({
  useCureSession: vi.fn(),
}));

import { useConfirm } from '@/context/ConfirmContext';
import { useCureSession } from '@/hooks/useRadiusSessionCures';
import { CureSessionButton } from '@/pages/radius/CureSessionButton';

function makeMutationMock(mutateAsync = vi.fn()) {
  return { mutateAsync, isPending: false };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CureSessionButton', () => {
  it('renders the button with the expected label', () => {
    vi.mocked(useConfirm).mockReturnValue(vi.fn());
    vi.mocked(useCureSession).mockReturnValue(makeMutationMock() as never);
    render(<CureSessionButton username="cliente01" />);
    expect(screen.getByRole('button', { name: /curar sesión colgada/i })).toBeInTheDocument();
  });

  it('S2.1: confirm 1 + 200 cured → POST sin force + feedback de éxito', async () => {
    const confirmFn = vi.fn().mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    const mutateAsync = vi.fn().mockResolvedValue({
      outcome: 'cured',
      reason: null,
      events: [{ id: 'e1' }],
    });
    vi.mocked(useCureSession).mockReturnValue(makeMutationMock(mutateAsync) as never);

    render(<CureSessionButton username="cliente01" />);
    await userEvent.click(screen.getByRole('button', { name: /curar sesión colgada/i }));

    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({ username: 'cliente01', force: undefined });
    expect(await screen.findByText(/curada/i)).toBeInTheDocument();
  });

  it('el click SIN confirmar (cancel) NO llama al POST', async () => {
    const confirmFn = vi.fn().mockResolvedValue(false);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    const mutateAsync = vi.fn();
    vi.mocked(useCureSession).mockReturnValue(makeMutationMock(mutateAsync) as never);

    render(<CureSessionButton username="cliente01" />);
    await userEvent.click(screen.getByRole('button', { name: /curar sesión colgada/i }));

    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('S2.5: already_cured → feedback informativo, sin error', async () => {
    const confirmFn = vi.fn().mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    const mutateAsync = vi.fn().mockResolvedValue({ outcome: 'already_cured', reason: null, events: [] });
    vi.mocked(useCureSession).mockReturnValue(makeMutationMock(mutateAsync) as never);

    render(<CureSessionButton username="cliente01" />);
    await userEvent.click(screen.getByRole('button', { name: /curar sesión colgada/i }));

    const feedback = await screen.findByText(/ya estaba curada/i);
    expect(feedback.closest('[role]')).toHaveAttribute('role', 'status');
  });

  it('S2.2: 409 CURE_SKIPPED_ALIVE → NO cura automáticamente, el segundo confirm muestra la FRASE HUMANA (no el reason máquina del BE)', async () => {
    const confirmFn = vi.fn()
      .mockResolvedValueOnce(true)  // confirm 1
      .mockResolvedValueOnce(false); // confirm 2 (el operador NO fuerza)
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    // El BE SIEMPRE manda `message` no-nulo con el reason MÁQUINA — nunca una
    // frase pensada para el operador (review adversarial, MEDIUM).
    const err = { response: { status: 409, data: { code: 'CURE_SKIPPED_ALIVE', message: 'session_fresh_interim' } } };
    const mutateAsync = vi.fn().mockRejectedValue(err);
    vi.mocked(useCureSession).mockReturnValue(makeMutationMock(mutateAsync) as never);

    render(<CureSessionButton username="cliente01" />);
    await userEvent.click(screen.getByRole('button', { name: /curar sesión colgada/i }));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(2));
    const secondCallArg = confirmFn.mock.calls[1][0];
    const secondMessage = typeof secondCallArg === 'string' ? secondCallArg : secondCallArg.message;
    // El copy PRIMARIO es la frase humana (mapeada por CODE)...
    expect(secondMessage).toMatch(/la sesión parece estar viva/i);
    // ...NUNCA el token máquina crudo del BE — el token no aporta nada al operador.
    expect(secondMessage).not.toMatch(/session_fresh_interim/);
    // Sin el segundo confirm en true, NUNCA se manda force:true.
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).not.toHaveBeenCalledWith(expect.objectContaining({ force: true }));
  });

  it('S2.3: confirm 2 aceptado tras el 409 → reenvía con force:true → cured', async () => {
    const confirmFn = vi.fn()
      .mockResolvedValueOnce(true)  // confirm 1
      .mockResolvedValueOnce(true); // confirm 2 — el operador fuerza
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    const err = { response: { status: 409, data: { code: 'CURE_SKIPPED_ALIVE', message: 'session_fresh_interim' } } };
    const mutateAsync = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({ outcome: 'cured', reason: null, events: [{ id: 'e1' }] });
    vi.mocked(useCureSession).mockReturnValue(makeMutationMock(mutateAsync) as never);

    render(<CureSessionButton username="cliente01" />);
    await userEvent.click(screen.getByRole('button', { name: /curar sesión colgada/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
    expect(mutateAsync).toHaveBeenNthCalledWith(2, { username: 'cliente01', force: true });
    expect(await screen.findByText(/curada/i)).toBeInTheDocument();
  });

  it('S2.2 (ambiguous): 409 CURE_SKIPPED_AMBIGUOUS dispara el segundo confirm con la frase humana + la lista de NAS del BE como detalle (SÍ aporta)', async () => {
    const confirmFn = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    // Reason MÁQUINA real que manda el BE para el gate ambiguous.
    const err = { response: { status: 409, data: { code: 'CURE_SKIPPED_AMBIGUOUS', message: 'sessions_on_multiple_nas:10.0.0.1,10.0.0.2' } } };
    const mutateAsync = vi.fn().mockRejectedValue(err);
    vi.mocked(useCureSession).mockReturnValue(makeMutationMock(mutateAsync) as never);

    render(<CureSessionButton username="cliente01" />);
    await userEvent.click(screen.getByRole('button', { name: /curar sesión colgada/i }));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(2));
    const secondCallArg = confirmFn.mock.calls[1][0];
    const secondMessage = typeof secondCallArg === 'string' ? secondCallArg : secondCallArg.message;
    // Frase humana primero (por CODE)...
    expect(secondMessage).toMatch(/hay sesiones activas en varios nas/i);
    // ...con la lista de NAS como detalle técnico (acá SÍ aporta información real).
    expect(secondMessage).toMatch(/10\.0\.0\.1/);
    expect(secondMessage).toMatch(/10\.0\.0\.2/);
    // El prefijo crudo del reason máquina no se le muestra al operador tal cual.
    expect(secondMessage).not.toMatch(/sessions_on_multiple_nas:/);
  });

  it('502 ORCHESTRATOR_UNREACHABLE → error claro, SIN ofrecer un segundo confirm/force', async () => {
    const confirmFn = vi.fn().mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    const err = { response: { status: 502, data: { code: 'ORCHESTRATOR_UNREACHABLE', message: 'orchestrator caído' } } };
    const mutateAsync = vi.fn().mockRejectedValue(err);
    vi.mocked(useCureSession).mockReturnValue(makeMutationMock(mutateAsync) as never);

    render(<CureSessionButton username="cliente01" />);
    await userEvent.click(screen.getByRole('button', { name: /curar sesión colgada/i }));

    const feedback = await screen.findByText(/no se pudo contactar el radius/i);
    expect(feedback.closest('[role]')).toHaveAttribute('role', 'alert');
    // Solo el primer confirm — el 502 NO es un gate, no se ofrece forzar.
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('isPending → el botón queda disabled', () => {
    vi.mocked(useConfirm).mockReturnValue(vi.fn());
    vi.mocked(useCureSession).mockReturnValue({ mutateAsync: vi.fn(), isPending: true } as never);
    render(<CureSessionButton username="cliente01" />);
    expect(screen.getByRole('button', { name: /curando/i })).toBeDisabled();
  });

  it('a11y: la live-region de feedback está PRE-MONTADA desde el render inicial (nunca se crea recién junto con el contenido)', () => {
    // NVDA/JAWS necesitan que el nodo con aria-live ya exista en el DOM ANTES
    // de que cambie el texto — montarlo condicionalmente junto con el mensaje
    // no es confiable (review adversarial, LOW a11y).
    vi.mocked(useConfirm).mockReturnValue(vi.fn());
    vi.mocked(useCureSession).mockReturnValue(makeMutationMock() as never);
    render(<CureSessionButton username="cliente01" />);

    const region = screen.getByRole('status');
    expect(region).toBeInTheDocument();
    expect(region).toHaveTextContent('');
  });

  it('a11y: tras un 200 exitoso, el texto aparece en la MISMA live-region ya montada (no se remonta el nodo)', async () => {
    const confirmFn = vi.fn().mockResolvedValue(true);
    vi.mocked(useConfirm).mockReturnValue(confirmFn);
    const mutateAsync = vi.fn().mockResolvedValue({ outcome: 'cured', reason: null, events: [{ id: 'e1' }] });
    vi.mocked(useCureSession).mockReturnValue(makeMutationMock(mutateAsync) as never);

    render(<CureSessionButton username="cliente01" />);
    const regionBefore = screen.getByRole('status');
    expect(regionBefore).toHaveTextContent('');

    await userEvent.click(screen.getByRole('button', { name: /curar sesión colgada/i }));

    const regionAfter = await screen.findByRole('status');
    expect(regionAfter).toBe(regionBefore);
    expect(regionAfter).toHaveTextContent(/curada/i);
  });
});
