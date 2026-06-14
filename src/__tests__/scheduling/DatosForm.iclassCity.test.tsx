/**
 * DEUDA #3 — DatosForm: campo localidad (iclassCityCode) editable post-create.
 *
 * STRICT TDD: estos tests deben FALLAR antes de que exista la implementación.
 *
 * Cobertura:
 *   - El campo "Localidad" aparece cuando kind='network' y networkType='fibra'
 *   - El campo se hidrata con el valor actual (iclassCityCode) de la tarea
 *   - Editar el campo e invocar submit llama a onSubmit con iclassCityCode
 *   - El campo NO aparece cuando kind='customer' (no es tarea de nodo fibra)
 *   - El campo NO aparece cuando kind='network' y networkType='red'
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { IClassNode } from '@/types/iclassNode';

// ── Mock useIClassNodes ───────────────────────────────────────────────────────
vi.mock('@/hooks/useIClassNodes', () => ({
  useIClassNodes: vi.fn(),
}));

// useClientContracts is required by DatosForm
vi.mock('@/hooks/useCustomers', () => ({
  useClientContracts: vi.fn(() => ({ data: [] })),
}));

import { useIClassNodes } from '@/hooks/useIClassNodes';
import { DatosForm, type DatosFormValues } from '@/pages/scheduling/SchedulingTaskDetailPage/components/DatosForm';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const mockNodes: IClassNode[] = [
  { id: 'n1', nodeId: 1, code: 'LOC-001', description: 'Localidad Norte', active: true, selectable: true, lastSyncedAt: null },
  { id: 'n2', nodeId: 2, code: 'LOC-002', description: 'Localidad Sur', active: true, selectable: true, lastSyncedAt: null },
  { id: 'n3', nodeId: 3, code: 'LOC-003', description: 'Localidad Inactiva', active: false, selectable: false, lastSyncedAt: null },
];

const baseInitial: DatosFormValues = {
  projectId: 'proj-1',
  assigneeId: null,
  partnerId: null,
  customerId: null,
  contractId: null,
  startDate: null,
  endDate: null,
  travelTimeTo: null,
  travelTimeFrom: null,
  address: null,
  coordinates: null,
};

function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderForm(props: Partial<Parameters<typeof DatosForm>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <QueryClientProvider client={makeQc()}>
      <DatosForm
        initial={baseInitial}
        onSubmit={onSubmit}
        isSaving={false}
        admins={[]}
        partners={[]}
        projects={[{ id: 'proj-1', title: 'Proyecto A', description: null, workflowId: null, createdAt: '', updatedAt: '' }]}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onSubmit };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DatosForm – iclassCityCode (Deuda #3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useIClassNodes).mockReturnValue({
      data: mockNodes,
      isLoading: false,
    } as ReturnType<typeof useIClassNodes>);
  });

  it('muestra el select de Localidad cuando kind=network y networkType=fibra', () => {
    renderForm({ kind: 'network', networkType: 'fibra' });
    expect(screen.getByLabelText(/localidad/i)).toBeInTheDocument();
  });

  it('NO muestra el select de Localidad cuando kind=customer', () => {
    renderForm({ kind: 'customer' });
    expect(screen.queryByLabelText(/localidad/i)).not.toBeInTheDocument();
  });

  it('NO muestra el select de Localidad cuando kind=network y networkType=red', () => {
    renderForm({ kind: 'network', networkType: 'red' });
    expect(screen.queryByLabelText(/localidad/i)).not.toBeInTheDocument();
  });

  it('NO muestra el select de Localidad cuando kind no está definido', () => {
    renderForm({});
    expect(screen.queryByLabelText(/localidad/i)).not.toBeInTheDocument();
  });

  it('el select de localidad contiene las opciones activas+seleccionables del catálogo', () => {
    renderForm({ kind: 'network', networkType: 'fibra' });
    const select = screen.getByLabelText(/localidad/i);
    // LOC-001 y LOC-002 son activos y seleccionables
    expect(select).toContainElement(screen.getByRole('option', { name: /LOC-001/i }));
    expect(select).toContainElement(screen.getByRole('option', { name: /LOC-002/i }));
    // LOC-003 es inactivo — no debe aparecer
    expect(screen.queryByRole('option', { name: /LOC-003/i })).not.toBeInTheDocument();
  });

  it('se hidrata con el iclassCityCode inicial de la tarea (valor pre-seleccionado)', async () => {
    const initial = { ...baseInitial, iclassCityCode: 'LOC-001' };
    renderForm({ kind: 'network', networkType: 'fibra', initial });

    await waitFor(() => {
      const select = screen.getByLabelText(/localidad/i) as HTMLSelectElement;
      expect(select.value).toBe('LOC-001');
    });
  });

  it('editar la localidad e invocar submit incluye iclassCityCode en el payload', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ kind: 'network', networkType: 'fibra' });

    const select = screen.getByLabelText(/localidad/i);
    await user.selectOptions(select, 'LOC-002');

    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const payload = onSubmit.mock.calls[0][0] as DatosFormValues;
      expect(payload.iclassCityCode).toBe('LOC-002');
    });
  });

  it('submit sin cambiar localidad preserva el iclassCityCode inicial', async () => {
    const user = userEvent.setup();
    const initial = { ...baseInitial, iclassCityCode: 'LOC-001' };
    const { onSubmit } = renderForm({ kind: 'network', networkType: 'fibra', initial });

    // Esperar hidratación
    await waitFor(() => {
      const s = screen.getByLabelText(/localidad/i) as HTMLSelectElement;
      expect(s.value).toBe('LOC-001');
    });

    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const payload = onSubmit.mock.calls[0][0] as DatosFormValues;
      expect(payload.iclassCityCode).toBe('LOC-001');
    });
  });

  // #3-F1: iclassCityCode que ya NO está en el catálogo filtrado (nodo desactivado post-creación).
  // El select debe mostrar el valor actual y NO borrarlo al guardar.
  it('#3-F1: iclassCityCode fuera del catálogo se muestra como opción fallback y NO se borra al guardar', async () => {
    const user = userEvent.setup();
    // 'ALTA-01' no está en mockNodes (catálogo sin ese code)
    const initial = { ...baseInitial, iclassCityCode: 'ALTA-01' };
    const { onSubmit } = renderForm({ kind: 'network', networkType: 'fibra', initial });

    // El select debe mostrar el valor actual aunque no esté en el catálogo activo
    await waitFor(() => {
      const s = screen.getByLabelText(/localidad/i) as HTMLSelectElement;
      expect(s.value).toBe('ALTA-01');
    });

    // La opción fallback debe estar en el DOM
    expect(screen.getByRole('option', { name: 'ALTA-01' })).toBeInTheDocument();

    // Al guardar sin tocar, el update mantiene iclassCityCode='ALTA-01' (NO null)
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const payload = onSubmit.mock.calls[0][0] as DatosFormValues;
      expect(payload.iclassCityCode).toBe('ALTA-01');
    });
  });

  // #3-W3: vaciado intencional — el usuario elige "Sin localidad" → update manda null.
  it('#3-W3: elegir "Sin localidad" manda iclassCityCode: null en el update', async () => {
    const user = userEvent.setup();
    const initial = { ...baseInitial, iclassCityCode: 'LOC-001' };
    const { onSubmit } = renderForm({ kind: 'network', networkType: 'fibra', initial });

    // Esperar hidratación
    await waitFor(() => {
      const s = screen.getByLabelText(/localidad/i) as HTMLSelectElement;
      expect(s.value).toBe('LOC-001');
    });

    // Elegir "Sin localidad" (value='')
    await user.selectOptions(screen.getByLabelText(/localidad/i), '');

    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
      const payload = onSubmit.mock.calls[0][0] as DatosFormValues;
      expect(payload.iclassCityCode).toBeNull();
    });
  });
});
