import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useIClassTechnicianTeams', () => ({
  useIClassTechnicianTeams: vi.fn(),
  useSetTechnicianTeamMapping: vi.fn(),
}));
vi.mock('@/hooks/useIClassTeams', () => ({
  useIClassTeams: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import { useIClassTechnicianTeams, useSetTechnicianTeamMapping } from '@/hooks/useIClassTechnicianTeams';
import { useIClassTeams } from '@/hooks/useIClassTeams';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { IClassTechnicianMappingBody } from '@/pages/scheduling/settings/IClassTechnicianMappingBody';

// ── Fixtures ────────────────────────────────────────────────────────────────

const TEAMS = [
  { login: 'team-a', name: 'Cuadrilla A', active: true, selectable: true, thirdPartyCode: null, lastSyncedAt: null },
  { login: 'team-b', name: 'Cuadrilla B', active: true, selectable: true, thirdPartyCode: null, lastSyncedAt: null },
  { login: 'team-inactive', name: 'Cuadrilla X', active: false, selectable: true, thirdPartyCode: null, lastSyncedAt: null },
];

const MAPPINGS = [
  { userId: 'u1', userName: 'Ana García', userLogin: 'ana', iclassTeamLogin: 'team-a', teamName: 'Cuadrilla A', teamActive: true },
  { userId: 'u2', userName: 'Bob López', userLogin: 'bob', iclassTeamLogin: null, teamName: null, teamActive: true },
  { userId: 'u3', userName: 'Carlos Ruiz', userLogin: 'carlos', iclassTeamLogin: 'team-inactive', teamName: 'Cuadrilla X', teamActive: false },
];

const idle = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
  isError: false,
  reset: vi.fn(),
};

function mockMappings(data = MAPPINGS, loading = false) {
  vi.mocked(useIClassTechnicianTeams).mockReturnValue({
    data: loading ? undefined : data,
    isLoading: loading,
    isError: false,
  } as never);
}

function mockTeams(data = TEAMS, loading = false) {
  vi.mocked(useIClassTeams).mockReturnValue({
    data: loading ? undefined : data,
    isLoading: loading,
    isError: false,
  } as never);
}

function mockPerms(can: (p: string | string[]) => boolean) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null, roles: [], permissions: [], isLoading: false, isError: false, can,
  } as never);
}

function renderBody() {
  return render(
    <MemoryRouter>
      <IClassTechnicianMappingBody />
    </MemoryRouter>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('IClassTechnicianMappingBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSetTechnicianTeamMapping).mockReturnValue(idle as never);
    mockMappings();
    mockTeams();
    mockPerms(() => true);
  });

  it('muestra loading mientras se carga la lista', () => {
    mockMappings(MAPPINGS, true);
    renderBody();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('renderiza una fila por técnico', () => {
    renderBody();
    expect(screen.getByText('Ana García')).toBeInTheDocument();
    expect(screen.getByText('Bob López')).toBeInTheDocument();
    expect(screen.getByText('Carlos Ruiz')).toBeInTheDocument();
  });

  it('el selector de cuadrilla muestra el mapeo actual', () => {
    renderBody();
    const anaSelect = screen.getByRole('combobox', { name: /cuadrilla de ana/i });
    expect((anaSelect as HTMLSelectElement).value).toBe('team-a');
  });

  it('el selector muestra "Sin cuadrilla" para técnico sin mapeo', () => {
    renderBody();
    const bobSelect = screen.getByRole('combobox', { name: /cuadrilla de bob/i });
    expect((bobSelect as HTMLSelectElement).value).toBe('');
  });

  it('el selector solo incluye cuadrillas active+selectable', () => {
    renderBody();
    const anaSelect = screen.getByRole('combobox', { name: /cuadrilla de ana/i });
    const options = Array.from((anaSelect as HTMLSelectElement).options).map(o => o.value);
    // team-a y team-b son active+selectable; team-inactive no debe aparecer
    expect(options).toContain('team-a');
    expect(options).toContain('team-b');
    expect(options).not.toContain('team-inactive');
  });

  it('cambiar selector dispara PATCH con el nuevo teamLogin', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useSetTechnicianTeamMapping).mockReturnValue({ ...idle, mutateAsync } as never);

    renderBody();
    const anaSelect = screen.getByRole('combobox', { name: /cuadrilla de ana/i });
    fireEvent.change(anaSelect, { target: { value: 'team-b' } });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ userId: 'u1', iclassTeamLogin: 'team-b' });
    });
  });

  it('seleccionar "Sin cuadrilla" (valor vacío) envía null en el PATCH', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useSetTechnicianTeamMapping).mockReturnValue({ ...idle, mutateAsync } as never);

    renderBody();
    const anaSelect = screen.getByRole('combobox', { name: /cuadrilla de ana/i });
    fireEvent.change(anaSelect, { target: { value: '' } });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ userId: 'u1', iclassTeamLogin: null });
    });
  });

  it('cuadrilla inactiva muestra badge rojo en la fila', () => {
    renderBody();
    expect(screen.getByText(/cuadrilla inactiva/i)).toBeInTheDocument();
  });

  it('sin permiso iclass.manage el selector queda read-only (disabled)', () => {
    mockPerms(p => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.every(x => x !== 'iclass.manage');
    });
    renderBody();
    const selects = screen.getAllByRole('combobox');
    selects.forEach(s => expect(s).toBeDisabled());
  });

  it('con permiso iclass.read sin iclass.manage los selects están disabled', () => {
    mockPerms(p => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.includes('iclass.read') && !perms.includes('iclass.manage');
    });
    renderBody();
    const selects = screen.getAllByRole('combobox');
    selects.forEach(s => expect(s).toBeDisabled());
  });

  // ── WARN-4: el componente refleja datos actualizados tras el re-fetch ──────
  // El hook useSetTechnicianTeamMapping invalida 'iclass-technician-teams' en onSuccess.
  // Este test verifica el ciclo completo desde el componente: después de que el PATCH
  // resuelve, el componente re-renderiza con los datos actualizados (como si el
  // re-fetch devolviera el teamName resuelto).
  it('tras el PATCH el componente muestra el teamName del nuevo mapeo al re-renderizar', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useSetTechnicianTeamMapping).mockReturnValue({ ...idle, mutateAsync } as never);

    const { rerender } = renderBody();

    // Bob no tiene cuadrilla inicialmente
    const bobSelect = screen.getByRole('combobox', { name: /cuadrilla de bob/i });
    expect((bobSelect as HTMLSelectElement).value).toBe('');

    // Simula que el usuario cambia el selector
    fireEvent.change(bobSelect, { target: { value: 'team-a' } });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ userId: 'u2', iclassTeamLogin: 'team-a' });
    });

    // Simula el re-fetch: ahora Bob tiene cuadrilla A (como devolvería el GET tras invalidar)
    const MAPPINGS_UPDATED = [
      { userId: 'u1', userName: 'Ana García', userLogin: 'ana', iclassTeamLogin: 'team-a', teamName: 'Cuadrilla A', teamActive: true },
      { userId: 'u2', userName: 'Bob López', userLogin: 'bob', iclassTeamLogin: 'team-a', teamName: 'Cuadrilla A', teamActive: true },
      { userId: 'u3', userName: 'Carlos Ruiz', userLogin: 'carlos', iclassTeamLogin: 'team-inactive', teamName: 'Cuadrilla X', teamActive: false },
    ];
    mockMappings(MAPPINGS_UPDATED);
    rerender(
      <MemoryRouter>
        <IClassTechnicianMappingBody />
      </MemoryRouter>,
    );

    // El selector de Bob ahora debe reflejar el valor actualizado
    const bobSelectUpdated = screen.getByRole('combobox', { name: /cuadrilla de bob/i });
    expect((bobSelectUpdated as HTMLSelectElement).value).toBe('team-a');
  });
});
