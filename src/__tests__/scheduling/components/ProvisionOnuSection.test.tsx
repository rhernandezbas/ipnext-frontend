/**
 * smartolt-provision-fe (K2-FE) — gate de la sección "Aprovisionar ONU" en el
 * detalle de tarea.
 *
 * Reglas de visibilidad (RED primero, ver ProvisionOnuSection):
 *  - permiso network.manage OBLIGATORIO
 *  - solo tareas de categoría 'installation' CON contrato asociado
 *  - señal de tecnología del CONTRATO (catálogo ServiceTechnology):
 *      · familia fiber (Fiber/FTTH)      → mostrar
 *      · familia wireless/cable          → ocultar (señal limpia de NO-fibra)
 *      · null/undefined/desconocida      → mostrar (fallback documentado: el
 *        ingest K1 rutea fibra a un projectId pero la tarea no lleva señal
 *        propia — ante la duda el botón se muestra y el BE guarda el resto)
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockQuery, mockMutation } from '@/__tests__/_utils/reactQueryMocks';

// El modal (hijo) consume estos hooks — mockeados para que abrir el modal no
// dispare ningún fetch real (PROHIBIDO llamar APIs vivas).
vi.mock('@/hooks/useFiberProvision', () => ({
  useUnconfiguredOnus: vi.fn(),
  useProvisionOnu: vi.fn(),
}));

import { useUnconfiguredOnus, useProvisionOnu } from '@/hooks/useFiberProvision';
import { useCan } from '@/hooks/useMyPermissions';
import { ProvisionOnuSection } from '@/pages/scheduling/SchedulingTaskDetailPage/components/ProvisionOnuSection';

function renderSection(overrides?: Partial<Parameters<typeof ProvisionOnuSection>[0]>) {
  const props = {
    taskCategory: 'installation' as const,
    contractId: 'c-1',
    contractTechnology: 'FTTH' as string | null | undefined,
    ...overrides,
  };
  return render(<ProvisionOnuSection {...props} />);
}

describe('ProvisionOnuSection — gate', () => {
  beforeEach(() => {
    vi.mocked(useCan).mockReturnValue(true);
    vi.mocked(useUnconfiguredOnus).mockReturnValue(mockQuery({ data: [], isLoading: false }));
    vi.mocked(useProvisionOnu).mockReturnValue(mockMutation({}));
  });

  it('sin network.manage NO se ve la sección', () => {
    vi.mocked(useCan).mockReturnValue(false);
    renderSection();
    expect(useCan).toHaveBeenCalledWith('network.manage');
    expect(screen.queryByRole('button', { name: /aprovisionar onu/i })).not.toBeInTheDocument();
  });

  it('tarea que NO es instalación → oculta', () => {
    renderSection({ taskCategory: 'repair' });
    expect(screen.queryByRole('button', { name: /aprovisionar onu/i })).not.toBeInTheDocument();
  });

  it('tarea sin contrato asociado → oculta', () => {
    renderSection({ contractId: null });
    expect(screen.queryByRole('button', { name: /aprovisionar onu/i })).not.toBeInTheDocument();
  });

  it('contrato con tecnología wireless (señal limpia de NO-fibra) → oculta', () => {
    renderSection({ contractTechnology: 'Wireless' });
    expect(screen.queryByRole('button', { name: /aprovisionar onu/i })).not.toBeInTheDocument();
  });

  it('contrato con tecnología cable (HFC) → oculta', () => {
    renderSection({ contractTechnology: 'HFC' });
    expect(screen.queryByRole('button', { name: /aprovisionar onu/i })).not.toBeInTheDocument();
  });

  it('contrato FTTH → muestra la sección con su botón', () => {
    renderSection({ contractTechnology: 'FTTH' });
    expect(screen.getByRole('button', { name: /aprovisionar onu/i })).toBeInTheDocument();
  });

  it('sin señal de tecnología (null) → muestra (fallback documentado)', () => {
    renderSection({ contractTechnology: null });
    expect(screen.getByRole('button', { name: /aprovisionar onu/i })).toBeInTheDocument();
  });

  it('tecnología desconocida (undefined — contrato no resuelto) → muestra', () => {
    renderSection({ contractTechnology: undefined });
    expect(screen.getByRole('button', { name: /aprovisionar onu/i })).toBeInTheDocument();
  });

  it('el botón abre el modal (dialog accesible)', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole('button', { name: /aprovisionar onu/i }));
    expect(screen.getByRole('dialog', { name: /aprovisionar onu/i })).toBeInTheDocument();
  });

  // M1 (fix wave) — latch: una vez abierto el modal, un cambio de señal
  // (contrato que resuelve a wireless, contrato que se desasocia) NO puede
  // desmontar el modal a mitad de una ejecución. El gate re-aplica al cerrarlo.
  it('M1: con el modal abierto, un cambio de señal NO desmonta el modal (latch)', async () => {
    const user = userEvent.setup();
    const { rerender } = renderSection({ contractTechnology: 'FTTH' });
    await user.click(screen.getByRole('button', { name: /aprovisionar onu/i }));
    expect(screen.getByRole('dialog', { name: /aprovisionar onu/i })).toBeInTheDocument();

    // La señal cambia a wireless con el modal abierto → el modal sobrevive
    rerender(
      <ProvisionOnuSection
        taskCategory="installation"
        contractId="c-1"
        contractTechnology="Wireless"
      />,
    );
    expect(screen.getByRole('dialog', { name: /aprovisionar onu/i })).toBeInTheDocument();

    // Al cerrar el modal, el gate vuelve a mandar: la sección desaparece
    await user.click(screen.getByRole('button', { name: /^cancelar$/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aprovisionar onu/i })).not.toBeInTheDocument();
  });

  it('M1: el contrato que se desasocia con el modal abierto tampoco lo desmonta', async () => {
    const user = userEvent.setup();
    const { rerender } = renderSection({ contractTechnology: 'FTTH' });
    await user.click(screen.getByRole('button', { name: /aprovisionar onu/i }));
    rerender(
      <ProvisionOnuSection
        taskCategory="installation"
        contractId={null}
        contractTechnology="FTTH"
      />,
    );
    expect(screen.getByRole('dialog', { name: /aprovisionar onu/i })).toBeInTheDocument();
  });
});
