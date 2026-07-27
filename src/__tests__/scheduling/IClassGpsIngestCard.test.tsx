/**
 * IClassGpsIngestCard tests — change `iclass-gps-audit`, lado FE.
 *
 * Card del flag `iclass-gps-ingest` (el scheduler ya está EN PROD, dark: hoy el
 * go-live sólo se puede hacer con un PATCH a mano). Patrón EXACTO de
 * PppoeAutoMoveCard / NocAlertsHubEnabledCard: mismo CSS module por composición,
 * mismos hooks, mismo gate `admin.flags`.
 *
 * Lo que esta card tiene de distinto y el test protege: el copy tiene que decir,
 * SIN dramatizar y SIN esconderlo, que prenderla hace que el sistema empiece a
 * guardar la ubicación de PERSONAS REALES cada 6 h con retención de 12 meses, y
 * que apagarla NO borra lo ya acumulado.
 *
 * Covers:
 *  1. Loading state
 *  2. Badge de estado ON/OFF desde el hook (+ aria-live)
 *  3. Título de la card
 *  4. Copy honesto: qué hace / por qué existe / qué implica prenderlo / qué NO borra
 *  5. Toggle ON → confirm (tone danger, menciona personas y 12 meses) → mutate
 *  6. Toggle ON cancelado → NO mutate
 *  7. Toggle OFF → confirm (tone danger, dice que no borra) → mutate
 *  8. Gate admin.flags
 *  9. Error states (flag fetch → "Estado desconocido" + retry / setFlag)
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(),
  useSetFeatureFlag: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(),
}));

import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { useMyPermissions, useCan } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { IClassGpsIngestCard } from '@/components/settings/IClassGpsIngestCard';

const FLAG_KEY = 'iclass-gps-ingest';

function setupHooks({
  flagEnabled = false,
  flagLoading = false,
  flagError = false,
  setFlagPending = false,
  setFlagError = false,
  permissions = ['admin.flags'],
  confirmResult = true,
}: {
  flagEnabled?: boolean;
  flagLoading?: boolean;
  flagError?: boolean;
  setFlagPending?: boolean;
  setFlagError?: boolean;
  permissions?: string[];
  confirmResult?: boolean;
} = {}) {
  const mutateFn = vi.fn();
  const confirmFn = vi.fn().mockResolvedValue(confirmResult);
  const refetchFn = vi.fn();

  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions,
    isLoading: false,
    isError: false,
    can: (p: string | string[], _mode?: string) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.some(perm => permissions.includes(perm));
    },
  } as never);

  vi.mocked(useCan).mockImplementation((perm: string) => permissions.includes(perm));

  vi.mocked(useFeatureFlag).mockReturnValue({
    // en error real de fetch la query NO tiene data (el 404 benigno no llega
    // acá: el hook lo mapea a { enabled: false } y nunca setea isError)
    data: flagLoading || flagError ? undefined : { key: FLAG_KEY, enabled: flagEnabled },
    isLoading: flagLoading,
    isError: flagError,
    refetch: refetchFn,
  } as unknown as ReturnType<typeof useFeatureFlag>);

  vi.mocked(useSetFeatureFlag).mockReturnValue({
    mutate: mutateFn,
    isPending: setFlagPending,
    isError: setFlagError,
  } as unknown as ReturnType<typeof useSetFeatureFlag>);

  // useConfirm viene mockeado global desde test/setup.ts; acá lo pisamos con
  // una fn controlable por test (clearAllMocks del beforeEach lo limpia).
  vi.mocked(useConfirm).mockReturnValue(confirmFn);

  return { mutateFn, confirmFn, refetchFn };
}

describe('IClassGpsIngestCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading ────────────────────────────────────────────────────────────────

  it('renders loading state while flag is loading', () => {
    setupHooks({ flagLoading: true });
    render(<IClassGpsIngestCard />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  // ── Flag status ────────────────────────────────────────────────────────────

  it('renders card title', () => {
    setupHooks();
    render(<IClassGpsIngestCard />);
    expect(
      screen.getByRole('heading', { name: /ingesta del rastro gps de cuadrillas/i }),
    ).toBeInTheDocument();
  });

  it('renders "Inactivo" badge when flag is OFF', () => {
    setupHooks({ flagEnabled: false });
    render(<IClassGpsIngestCard />);
    expect(screen.getByText(/^inactivo$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^activo$/i)).not.toBeInTheDocument();
  });

  it('renders "Activo" badge when flag is ON', () => {
    setupHooks({ flagEnabled: true });
    render(<IClassGpsIngestCard />);
    expect(screen.getByText(/^activo$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^inactivo$/i)).not.toBeInTheDocument();
  });

  it('announces the flag state politely (aria-live) so the flip is perceivable', () => {
    setupHooks({ flagEnabled: true });
    render(<IClassGpsIngestCard />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-live', 'polite');
    expect(badge).toHaveTextContent(/activo/i);
  });

  // ── Copy honesto ───────────────────────────────────────────────────────────
  // Quien prenda esto tiene que saber EXACTAMENTE qué está prendiendo: no es un
  // sync más, es ubicación de personas reales con retención propia.

  it('explains WHAT it does: ingests the GPS trail from IClass every 6 h', () => {
    setupHooks();
    render(<IClassGpsIngestCard />);
    // "trae desde IClass" es exclusivo del párrafo de descripción — la cadencia
    // aparece también en la nota de privacidad, así que hay que acotar.
    const [description] = screen.getAllByText(/trae desde iclass/i);
    expect(description).toHaveTextContent(/cada 6 horas/i);
    expect(description).toHaveTextContent(/rastro gps de las cuadrillas/i);
  });

  it('explains WHY it exists: IClass wipes the trail after ~30 days', () => {
    setupHooks();
    render(<IClassGpsIngestCard />);
    const [description] = screen.getAllByText(/trae desde iclass/i);
    expect(description).toHaveTextContent(/iclass borra el rastro a los ~30 días/i);
    expect(description).toHaveTextContent(/auditoría histórica/i);
  });

  it('states WHAT TURNING IT ON IMPLIES: real people + 12-month retention', () => {
    setupHooks();
    render(<IClassGpsIngestCard />);
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(/qué implica prenderlo/i);
    expect(note).toHaveTextContent(/ubicación de los técnicos/i);
    expect(note).toHaveTextContent(/personas reales/i);
    expect(note).toHaveTextContent(/12 meses/i);
  });

  it('states that turning it OFF stops the ingest but does NOT delete what was collected', () => {
    setupHooks();
    render(<IClassGpsIngestCard />);
    expect(screen.getByRole('note')).toHaveTextContent(/no borra lo ya acumulado/i);
  });

  // ── Toggle ON: confirmación obligatoria ────────────────────────────────────

  it('turning ON asks for confirmation with danger tone before mutating', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: true });
    render(<IClassGpsIngestCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith({ key: FLAG_KEY, enabled: true });
    });
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(confirmFn).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' }));
    expect(mutateFn).toHaveBeenCalledTimes(1);
  });

  it('the ON confirmation spells out that real people get located, and for 12 months', async () => {
    const { confirmFn } = setupHooks({ flagEnabled: false, confirmResult: true });
    render(<IClassGpsIngestCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/personas reales/i) }),
    );
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/12 meses/i) }),
    );
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/cada 6 horas/i) }),
    );
  });

  it('turning ON does NOT mutate when the confirmation is cancelled', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: false, confirmResult: false });
    render(<IClassGpsIngestCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateFn).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  // ── Toggle OFF: también confirma ───────────────────────────────────────────
  // Apagar no borra nada, pero mientras esté apagado el rastro que IClass
  // elimine a los ~30 días se pierde para siempre. No es inocuo.

  it('turning OFF asks for confirmation and says nothing already stored is deleted', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: true, confirmResult: true });
    render(<IClassGpsIngestCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mutateFn).toHaveBeenCalledWith({ key: FLAG_KEY, enabled: false });
    });
    expect(confirmFn).toHaveBeenCalledTimes(1);
    expect(confirmFn).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'danger',
        message: expect.stringMatching(/no se borra/i),
      }),
    );
  });

  it('turning OFF does NOT mutate when the confirmation is cancelled', async () => {
    const { mutateFn, confirmFn } = setupHooks({ flagEnabled: true, confirmResult: false });
    render(<IClassGpsIngestCard />);

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(confirmFn).toHaveBeenCalledTimes(1));
    expect(mutateFn).not.toHaveBeenCalled();
  });

  it('toggle is checked when flag is ON and unchecked when OFF', () => {
    setupHooks({ flagEnabled: true });
    const { unmount } = render(<IClassGpsIngestCard />);
    expect(screen.getByRole('checkbox')).toBeChecked();
    unmount();

    setupHooks({ flagEnabled: false });
    render(<IClassGpsIngestCard />);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('toggle is disabled while mutation is pending', () => {
    setupHooks({ flagEnabled: false, setFlagPending: true });
    render(<IClassGpsIngestCard />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  // ── Accessible name del switch (WCAG 2.5.3 label-in-name) ─────────────────

  it('switch accessible name matches the visible label when OFF (WCAG 2.5.3)', () => {
    setupHooks({ flagEnabled: false });
    render(<IClassGpsIngestCard />);
    expect(screen.getByRole('checkbox', { name: 'Activar ingesta' })).toBeInTheDocument();
  });

  it('switch accessible name matches the visible label when ON (WCAG 2.5.3)', () => {
    setupHooks({ flagEnabled: true });
    render(<IClassGpsIngestCard />);
    expect(screen.getByRole('checkbox', { name: 'Desactivar ingesta' })).toBeInTheDocument();
  });

  // ── Permission gate (mismo permiso que las cards vecinas) ─────────────────

  it('toggle is NOT rendered when user lacks admin.flags', () => {
    setupHooks({ permissions: [] });
    render(<IClassGpsIngestCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('toggle is NOT rendered with unrelated permissions (no admin.flags)', () => {
    setupHooks({ permissions: ['scheduling.read', 'location.read', 'location.audit'] });
    render(<IClassGpsIngestCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  // ── Error states ───────────────────────────────────────────────────────────

  it('renders error banner when setFlag fails', () => {
    setupHooks({ setFlagError: true });
    render(<IClassGpsIngestCard />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/no se pudo cambiar/i)).toBeInTheDocument();
  });

  it('does NOT render toggle when there is a flag-fetch error', () => {
    setupHooks({ flagError: true });
    render(<IClassGpsIngestCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  // ── Flag-fetch error → estado desconocido EXPLÍCITO ────────────────────────
  // Sin lectura confiable del flag la card NO puede decir "Inactivo" con
  // confianza: mentir el estado de una ingesta de ubicación de personas es
  // peor que declarar que no se sabe.

  it('flag-fetch error shows "Estado desconocido", never a confident "Inactivo"', () => {
    setupHooks({ flagError: true });
    render(<IClassGpsIngestCard />);
    expect(screen.getByText(/estado desconocido/i)).toBeInTheDocument();
    expect(screen.queryByText(/^inactivo$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^activo$/i)).not.toBeInTheDocument();
  });

  it('flag-fetch error shows an alert banner explaining the unknown state', () => {
    setupHooks({ flagError: true });
    render(<IClassGpsIngestCard />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/no se pudo leer el estado de la ingesta/i)).toBeInTheDocument();
  });

  it('flag-fetch error offers a retry button that refetches the flag', () => {
    const { refetchFn } = setupHooks({ flagError: true });
    render(<IClassGpsIngestCard />);

    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(refetchFn).toHaveBeenCalledTimes(1);
  });

  it('flag-fetch error does NOT render the switch even WITH admin.flags', () => {
    setupHooks({ flagError: true, permissions: ['admin.flags'] });
    render(<IClassGpsIngestCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
