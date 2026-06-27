import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(),
  useSetFeatureFlag: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { IClassOsActionsBody } from '@/pages/scheduling/settings/IClassOsActionsBody';

const idleMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  reset: vi.fn(),
};


function mockBothFlags(closeEnabled: boolean, assignEnabled: boolean) {
  vi.mocked(useFeatureFlag).mockImplementation((k: string) => {
    const enabled = k === 'iclass-close-action' ? closeEnabled : k === 'iclass-assign-action' ? assignEnabled : false;
    return {
      data: { key: k, enabled },
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: vi.fn(),
    } as never;
  });
}

function mockPerms(can: (p: string | string[]) => boolean) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null, roles: [], permissions: [], isLoading: false, isError: false, can,
  } as never);
}

describe('IClassOsActionsBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSetFeatureFlag).mockReturnValue(idleMutation as never);
    mockBothFlags(false, false);
    mockPerms(() => true);
  });

  it('renderiza los dos toggles de acciones', () => {
    renderBody();
    expect(screen.getByRole('checkbox', { name: /cierre de os/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /asignación de cuadrilla/i })).toBeInTheDocument();
  });

  it('toggle cierre ON cuando iclass-close-action está activo', () => {
    mockBothFlags(true, false);
    renderBody();
    const closeToggle = screen.getByRole('checkbox', { name: /cierre de os/i });
    expect(closeToggle).toBeChecked();
  });

  it('toggle asignación ON cuando iclass-assign-action está activo', () => {
    mockBothFlags(false, true);
    renderBody();
    const assignToggle = screen.getByRole('checkbox', { name: /asignación de cuadrilla/i });
    expect(assignToggle).toBeChecked();
  });

  it('clicar toggle de cierre llama setFlag con la clave correcta e invierte el estado', () => {
    mockBothFlags(false, false);
    const mutate = vi.fn();
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, mutate } as never);

    renderBody();
    fireEvent.click(screen.getByRole('checkbox', { name: /cierre de os/i }));

    expect(mutate).toHaveBeenCalledWith({ key: 'iclass-close-action', enabled: true });
  });

  it('clicar toggle de asignación llama setFlag con la clave correcta e invierte el estado', () => {
    mockBothFlags(true, true);
    const mutate = vi.fn();
    vi.mocked(useSetFeatureFlag).mockReturnValue({ ...idleMutation, mutate } as never);

    renderBody();
    fireEvent.click(screen.getByRole('checkbox', { name: /asignación de cuadrilla/i }));

    expect(mutate).toHaveBeenCalledWith({ key: 'iclass-assign-action', enabled: false });
  });

  it('advertencia de ESCRITURA a IClass está visible', () => {
    renderBody();
    expect(screen.getByText(/escrituras a iclass/i)).toBeInTheDocument();
  });

  it('sin permiso admin.flags los toggles quedan deshabilitados', () => {
    mockPerms(p => {
      const perms = Array.isArray(p) ? p : [p];
      return !perms.includes('admin.flags');
    });
    renderBody();
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => expect(cb).toBeDisabled());
  });
});

function renderBody() {
  return render(<IClassOsActionsBody />);
}
