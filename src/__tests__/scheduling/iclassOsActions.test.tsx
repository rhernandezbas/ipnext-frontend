/**
 * Ola A — Cerrar OS en IClass
 *
 * Tests:
 * 1. CloseIClassOSModal — sends {resultCode, commentary, closeDate} correct
 * 2. CloseIClassOSModal — shows `reason` from 422 error
 * 3. CloseIClassOSModal — hidden without permission scheduling.iclass_close
 * 4. CloseIClassOSModal — hidden when flag iclass-close-action is OFF
 *
 * Ola B — Asignar cuadrilla
 * 5. IClassTeamSelector — sends {teamLogin} on select
 * 6. IClassTeamSelector — hidden without permission scheduling.iclass_assign
 * 7. IClassTeamSelector — hidden when flag iclass-assign-action is OFF
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ── Mock hooks ───────────────────────────────────────────────────────────────

vi.mock('@/hooks/useIClassOsActions', () => ({
  useCloseIClassOS: vi.fn(),
  useAssignIClassTeam: vi.fn(),
}));

vi.mock('@/hooks/useIClassTeams', () => ({
  useIClassTeams: vi.fn(),
  useSyncIClassTeams: vi.fn(),
}));

vi.mock('@/hooks/useIClassResultCodes', () => ({
  useIClassResultCodes: vi.fn(),
}));

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(),
}));

// useMyPermissions is globally mocked in setup.ts to grant '*' — individual
// tests that need denial override useCan or useMyPermissions.can().
import { useCan, useMyPermissions } from '@/hooks/useMyPermissions';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import { useIClassResultCodes } from '@/hooks/useIClassResultCodes';
import { useCloseIClassOS, useAssignIClassTeam } from '@/hooks/useIClassOsActions';
import { useIClassTeams, useSyncIClassTeams } from '@/hooks/useIClassTeams';

// ── Imports under test ───────────────────────────────────────────────────────
import { CloseIClassOSModal } from '@/components/molecules/CloseIClassOSModal/CloseIClassOSModal';
import { IClassTeamSelector } from '@/components/molecules/IClassTeamSelector/IClassTeamSelector';
import { IClassTeamsCatalogBody } from '@/pages/scheduling/settings/IClassTeamsCatalogBody';

// ── Shared helpers ───────────────────────────────────────────────────────────

const noopMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
  isError: false,
  error: null,
  reset: vi.fn(),
};

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function flagOn(key?: string) {
  vi.mocked(useFeatureFlag).mockImplementation((k) => ({
    data: { key: k, enabled: key === undefined || k === key },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as ReturnType<typeof useFeatureFlag>));
}

function flagOff() {
  vi.mocked(useFeatureFlag).mockReturnValue({
    data: { key: 'any', enabled: false },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as ReturnType<typeof useFeatureFlag>);
}

const mockResultCodes = [
  { id: 'rc1', soTypeId: null, code: 'ATENDIDO', type: 'Sucesso', mappedStageId: null, mappedStageName: null, lastSyncedAt: '' },
  { id: 'rc2', soTypeId: null, code: 'CANCELADO', type: 'Falha', mappedStageId: null, mappedStageName: null, lastSyncedAt: '' },
];

const mockTeams = [
  { login: 'equipo-a', name: 'Equipo Alpha', thirdPartyCode: 'EA01', active: true, selectable: true, lastSyncedAt: '2026-06-14T00:00:00Z' },
  { login: 'equipo-b', name: 'Equipo Beta', thirdPartyCode: null, active: false, selectable: false, lastSyncedAt: null },
];

// ── Suite A: CloseIClassOSModal ──────────────────────────────────────────────

describe('CloseIClassOSModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCan).mockImplementation(() => true);
    flagOn();
    vi.mocked(useIClassResultCodes).mockReturnValue({
      data: mockResultCodes,
      isLoading: false,
    } as ReturnType<typeof useIClassResultCodes>);
    vi.mocked(useCloseIClassOS).mockReturnValue(noopMutation as ReturnType<typeof useCloseIClassOS>);
  });

  it('sends {resultCode, commentary, closeDate} when submitted', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useCloseIClassOS).mockReturnValue({ ...noopMutation, mutateAsync } as ReturnType<typeof useCloseIClassOS>);

    render(
      <CloseIClassOSModal taskId="task-1" open onClose={vi.fn()} />,
      { wrapper }
    );

    // Select result code
    fireEvent.change(screen.getByRole('combobox', { name: /resultado/i }), {
      target: { value: 'ATENDIDO' },
    });

    // Fill commentary
    fireEvent.change(screen.getByRole('textbox', { name: /comentario/i }), {
      target: { value: 'Trabajo realizado correctamente' },
    });

    // Date field should default to today
    const dateInput = screen.getByLabelText(/fecha/i);
    expect((dateInput as HTMLInputElement).value).toBeTruthy();

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        taskId: 'task-1',
        resultCode: 'ATENDIDO',
        commentary: 'Trabajo realizado correctamente',
        // FIX 1: closeDate must be ISO-8601 datetime (T + Z), not bare YYYY-MM-DD
        closeDate: expect.stringMatching(/\dT\d.*Z/),
      });
    });
  });

  it('shows reason from 422 error response', async () => {
    const error = {
      response: {
        status: 422,
        data: { error: 'VALIDATION_ERROR', code: 'CLOSE_FAILED', reason: 'La OS ya fue cerrada externamente' },
      },
    };
    vi.mocked(useCloseIClassOS).mockReturnValue({
      ...noopMutation,
      isError: true,
      error,
    } as unknown as ReturnType<typeof useCloseIClassOS>);

    render(
      <CloseIClassOSModal taskId="task-1" open onClose={vi.fn()} />,
      { wrapper }
    );

    expect(screen.getByText(/La OS ya fue cerrada externamente/i)).toBeInTheDocument();
  });

  // FIX 3: Gate lives ONLY in parent (TaskHeader). Modal renders based solely on `open`.
  // The old "hidden without permission" test was a false positive (no button in modal).
  // Gate tests for TaskHeader are in TaskHeader.test.tsx (FIX 4).

  it('renders modal content when open=true regardless of permission (gate is in parent)', () => {
    // Even if useCan would deny (irrelevant now — modal doesn't call it), open=true shows modal
    render(
      <CloseIClassOSModal taskId="task-1" open onClose={vi.fn()} />,
      { wrapper }
    );

    expect(screen.getByRole('combobox', { name: /resultado/i })).toBeInTheDocument();
  });

  it('does not render modal content when open=false', () => {
    render(
      <CloseIClassOSModal taskId="task-1" open={false} onClose={vi.fn()} />,
      { wrapper }
    );

    expect(screen.queryByRole('combobox', { name: /resultado/i })).not.toBeInTheDocument();
  });
});

// ── Suite B1: IClassTeamSelector ─────────────────────────────────────────────

describe('IClassTeamSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCan).mockImplementation(() => true);
    flagOn();
    vi.mocked(useIClassTeams).mockReturnValue({
      data: mockTeams,
      isLoading: false,
    } as ReturnType<typeof useIClassTeams>);
    vi.mocked(useAssignIClassTeam).mockReturnValue(noopMutation as ReturnType<typeof useAssignIClassTeam>);
  });

  it('sends {teamLogin} when a team is selected and submitted', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useAssignIClassTeam).mockReturnValue({ ...noopMutation, mutateAsync } as ReturnType<typeof useAssignIClassTeam>);

    render(
      <IClassTeamSelector taskId="task-1" />,
      { wrapper }
    );

    // Only selectable teams should appear
    fireEvent.change(screen.getByRole('combobox', { name: /cuadrilla/i }), {
      target: { value: 'equipo-a' },
    });

    fireEvent.click(screen.getByRole('button', { name: /asignar/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        taskId: 'task-1',
        teamLogin: 'equipo-a',
      });
    });
  });

  it('does not render without scheduling.iclass_assign permission', () => {
    vi.mocked(useCan).mockImplementation((perm) => perm !== 'scheduling.iclass_assign');

    render(
      <IClassTeamSelector taskId="task-1" />,
      { wrapper }
    );

    expect(screen.queryByRole('combobox', { name: /cuadrilla/i })).not.toBeInTheDocument();
  });

  it('does not render when flag iclass-assign-action is OFF', () => {
    vi.mocked(useFeatureFlag).mockImplementation((key) => ({
      data: { key, enabled: key !== 'iclass-assign-action' },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useFeatureFlag>));

    render(
      <IClassTeamSelector taskId="task-1" />,
      { wrapper }
    );

    expect(screen.queryByRole('combobox', { name: /cuadrilla/i })).not.toBeInTheDocument();
  });
});

// ── Suite B2: IClassTeamsCatalogBody ─────────────────────────────────────────

describe('IClassTeamsCatalogBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCan).mockImplementation(() => true);
    vi.mocked(useIClassTeams).mockReturnValue({
      data: mockTeams,
      isLoading: false,
    } as ReturnType<typeof useIClassTeams>);
    vi.mocked(useSyncIClassTeams).mockReturnValue(noopMutation as ReturnType<typeof useSyncIClassTeams>);
  });

  it('renders team catalog with login/name/active columns', () => {
    render(<IClassTeamsCatalogBody />, { wrapper });

    expect(screen.getByText('equipo-a')).toBeInTheDocument();
    expect(screen.getByText('Equipo Alpha')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('shows Sincronizar button gated by iclass.manage and calls mutateAsync on click', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ synced: 2, created: 0, updated: 2 });
    vi.mocked(useSyncIClassTeams).mockReturnValue({ ...noopMutation, mutateAsync } as ReturnType<typeof useSyncIClassTeams>);

    render(<IClassTeamsCatalogBody />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: /sincronizar/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
  });

  it('shows success summary banner after sync', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ synced: 3, created: 1, updated: 2 });
    vi.mocked(useSyncIClassTeams).mockReturnValue({ ...noopMutation, mutateAsync } as ReturnType<typeof useSyncIClassTeams>);

    render(<IClassTeamsCatalogBody />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: /sincronizar/i }));

    await waitFor(() => {
      expect(screen.getByText(/3/)).toBeInTheDocument();
    });
  });

  it('disables sync button while pending', () => {
    vi.mocked(useSyncIClassTeams).mockReturnValue({ ...noopMutation, isPending: true } as ReturnType<typeof useSyncIClassTeams>);

    render(<IClassTeamsCatalogBody />, { wrapper });
    expect(screen.getByRole('button', { name: /sincronizando/i })).toBeDisabled();
  });

  it('hides sync button without iclass.manage permission', () => {
    // Can component uses useMyPermissions().can() — must deny at that level
    vi.mocked(useMyPermissions).mockReturnValue({
      permissions: [],
      roles: [],
      user: null,
      isLoading: false,
      isError: false,
      can: (perm: string | string[]) => {
        const perms = Array.isArray(perm) ? perm : [perm];
        return perms.every(p => p !== 'iclass.manage');
      },
    });
    vi.mocked(useCan).mockImplementation((perm) => perm !== 'iclass.manage');

    render(<IClassTeamsCatalogBody />, { wrapper });
    expect(screen.queryByRole('button', { name: /sincronizar/i })).not.toBeInTheDocument();
  });
});
