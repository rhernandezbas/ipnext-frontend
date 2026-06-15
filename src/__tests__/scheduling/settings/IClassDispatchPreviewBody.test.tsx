import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useIClassDispatchPreview', () => ({
  useIClassDispatchPreview: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({ useMyPermissions: vi.fn() }));

import { useIClassDispatchPreview } from '@/hooks/useIClassDispatchPreview';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { IClassDispatchPreviewBody } from '@/pages/scheduling/settings/IClassDispatchPreviewBody';

const ROWS = [
  {
    projectId: 'p1',
    projectTitle: 'Proyecto Fibra',
    soType: { code: 'INSTALL', description: 'Instalación' },
    nodeResolution: 'by-customer-city' as const,
    customerCodeSource: 'contractCode-or-customerCode' as const,
    phoneSource: 'customer-phone' as const,
    soCodeSource: 'task-sequence-number' as const,
    initialStatus: 'assigned-by-iclass' as const,
    hardcoded: { networkPhone: '0000000000' as const, networkCustomerCode: 'NETWORK' as const },
  },
  {
    projectId: 'p2',
    projectTitle: 'Proyecto RED',
    soType: null,
    nodeResolution: 'by-customer-city' as const,
    customerCodeSource: 'contractCode-or-customerCode' as const,
    phoneSource: 'customer-phone' as const,
    soCodeSource: 'task-sequence-number' as const,
    initialStatus: 'assigned-by-iclass' as const,
    hardcoded: { networkPhone: '0000000000' as const, networkCustomerCode: 'NETWORK' as const },
  },
];

function mockPreview(data = ROWS, loading = false) {
  vi.mocked(useIClassDispatchPreview).mockReturnValue({
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
      <IClassDispatchPreviewBody />
    </MemoryRouter>,
  );
}

describe('IClassDispatchPreviewBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreview();
    mockPerms(() => true);
  });

  it('muestra loading mientras se carga', () => {
    mockPreview(ROWS, true);
    renderBody();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  // ── FIX-1: gating iclass.read — confiable y no-falsificable ─────────────
  describe('Permission gating — iclass.read', () => {
    it('no renderiza contenido cuando el usuario no tiene iclass.read', () => {
      mockPerms(() => false);
      renderBody();
      expect(screen.queryByText('Proyecto Fibra')).not.toBeInTheDocument();
      expect(screen.queryByText('Proyecto RED')).not.toBeInTheDocument();
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
    });

    it('renderiza contenido cuando el usuario tiene iclass.read', () => {
      mockPerms(p => {
        const perms = Array.isArray(p) ? p : [p];
        return perms.includes('iclass.read');
      });
      renderBody();
      expect(screen.getByText('Proyecto Fibra')).toBeInTheDocument();
      expect(screen.getByText('Proyecto RED')).toBeInTheDocument();
    });
  });

  it('renderiza una fila por proyecto', () => {
    renderBody();
    expect(screen.getByText('Proyecto Fibra')).toBeInTheDocument();
    expect(screen.getByText('Proyecto RED')).toBeInTheDocument();
  });

  it('muestra el tipo de OS cuando está mapeado', () => {
    renderBody();
    expect(screen.getByText('INSTALL')).toBeInTheDocument();
    expect(screen.getByText('Instalación')).toBeInTheDocument();
  });

  it('muestra "Sin mapeo" para proyecto sin soType', () => {
    renderBody();
    expect(screen.getByText(/sin mapeo/i)).toBeInTheDocument();
  });

  it('muestra "Lo asigna IClass" como estado inicial de todos los proyectos', () => {
    renderBody();
    const cells = screen.getAllByText(/lo asigna iclass/i);
    expect(cells).toHaveLength(ROWS.length);
  });

  it('incluye link a sub-tab Estados de IClass', () => {
    renderBody();
    const link = screen.getByRole('link', { name: /estados de iclass/i });
    expect(link).toBeInTheDocument();
  });

  it('muestra la fuente del código de cliente', () => {
    renderBody();
    expect(screen.getAllByText(/contractCode|customerCode/i).length).toBeGreaterThan(0);
  });

  it('tabla es read-only (sin inputs ni botones de acción)', () => {
    renderBody();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
