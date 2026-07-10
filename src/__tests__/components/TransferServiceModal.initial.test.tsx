/**
 * TransferServiceModal — extensión 1-click (actions-worklist F2).
 *
 * Props NUEVAS y opcionales: `initialTarget` + `initialTargetContractId`.
 * Si vienen AMBAS → el modal arranca directo en el paso de confirmación
 * (destino precargado). El flujo normal (sin las props) queda intacto —
 * lo cubre TransferServiceModal.test.tsx.
 *
 *  TSMI-1 ambas props → arranca en confirm con de-quién-a-quién precargado
 *  TSMI-2 Transferir desde el confirm precargado → payload correcto
 *  TSMI-3 Volver → paso 1 con destino/contrato preseleccionados (editable)
 *  TSMI-4 solo initialTarget (sin contrato) → arranca en form, target precargado
 *  TSMI-5 initialTarget con name null → fallback visible, no crashea
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockMutation, mockQuery } from '@/__tests__/_utils/reactQueryMocks';

vi.mock('@/hooks/useCustomers', () => ({
  useClientList: vi.fn(),
  useClientContracts: vi.fn(),
}));
vi.mock('@/hooks/useGigared', () => ({
  useTransferTv: vi.fn(),
}));
vi.mock('@/hooks/usePppoe', () => ({
  useTransferPppoe: vi.fn(),
}));
vi.mock('@/hooks/useServiceInventory', () => ({
  useTransferEquipment: vi.fn(),
}));

import { useClientList, useClientContracts } from '@/hooks/useCustomers';
import { useTransferTv } from '@/hooks/useGigared';
import { useTransferPppoe } from '@/hooks/usePppoe';
import { useTransferEquipment } from '@/hooks/useServiceInventory';
import { TransferServiceModal } from '@/components/molecules/TransferServiceModal/TransferServiceModal';

const targetContracts = [
  { id: 'ct-t1', plan: 'Plan 50M', name: null, status: 'active', address: 'Calle Falsa 123', services: [] },
  { id: 'ct-t2', plan: 'Plan 100M', name: 'Casa', status: 'active', address: null, services: [] },
];

const onClose = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MutateFn = ReturnType<typeof vi.fn<(...args: any[]) => any>>;
let tvMutateAsync: MutateFn;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useClientList).mockReturnValue(
    mockQuery({ data: { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 } }) as never,
  );
  vi.mocked(useClientContracts).mockReturnValue(
    mockQuery({ data: targetContracts, isLoading: false }) as never,
  );
  tvMutateAsync = vi.fn().mockResolvedValue({
    status: 200,
    data: { cic: '0000000009', severed: true, localSource: 'synced', localTarget: 'synced', targetCleared: true },
  });
  vi.mocked(useTransferTv).mockReturnValue(mockMutation({ mutateAsync: tvMutateAsync }) as never);
  vi.mocked(useTransferPppoe).mockReturnValue(mockMutation() as never);
  vi.mocked(useTransferEquipment).mockReturnValue(mockMutation() as never);
});

function renderPreloaded(overrides?: {
  initialTarget?: { id: string; name: string | null };
  initialTargetContractId?: string;
}) {
  return render(
    <TransferServiceModal
      variant={{ kind: 'tv' }}
      sourceClientId="cl-old"
      sourceClientName="Juan Viejo"
      sourceContractId="ct-old"
      initialTarget={
        'initialTarget' in (overrides ?? {})
          ? overrides!.initialTarget
          : { id: 'cl-new', name: 'María Nueva' }
      }
      initialTargetContractId={
        'initialTargetContractId' in (overrides ?? {})
          ? overrides!.initialTargetContractId
          : 'ct-t1'
      }
      onClose={onClose}
    />,
  );
}

describe('TSMI-1: arranque directo en confirm', () => {
  it('con ambas props muestra la confirmación de-quién-a-quién sin pasar por el form', () => {
    renderPreloaded();

    expect(
      screen.getByText((_, el) =>
        el?.tagName === 'P' && /transferir tv de juan viejo a maría nueva/i.test(el.textContent ?? ''),
      ),
    ).toBeInTheDocument();
    // El contrato destino resuelto por nombre/plan (viene del query de contratos).
    expect(screen.getByText(/plan 50m/i)).toBeInTheDocument();
    // No estamos en el paso 1.
    expect(screen.queryByLabelText(/cliente destino/i)).not.toBeInTheDocument();
  });
});

describe('TSMI-2: transferencia desde el confirm precargado', () => {
  it('dispara el POST con targetCustomerId/targetContractId/sourceContractId del caso', async () => {
    const user = userEvent.setup();
    renderPreloaded();

    await user.click(screen.getByRole('button', { name: /^transferir$/i }));

    await waitFor(() => {
      expect(tvMutateAsync).toHaveBeenCalledWith({
        targetCustomerId: 'cl-new',
        targetContractId: 'ct-t1',
        sourceContractId: 'ct-old',
      });
    });
    expect(await screen.findByText(/tv transferida/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('TSMI-3: Volver desde el confirm precargado', () => {
  it('vuelve al paso 1 con el destino preseleccionado y editable', async () => {
    const user = userEvent.setup();
    renderPreloaded();

    await user.click(screen.getByRole('button', { name: /volver/i }));

    // Paso 1 con el contrato preseleccionado.
    const select = screen.getByLabelText(/contrato destino/i) as HTMLSelectElement;
    expect(select.value).toBe('ct-t1');
    expect(screen.getByRole('button', { name: /continuar/i })).toBeEnabled();
  });
});

describe('TSMI-4: solo initialTarget → arranca en form', () => {
  it('sin initialTargetContractId no salta el paso 1 (falta elegir contrato)', () => {
    renderPreloaded({ initialTarget: { id: 'cl-new', name: 'María Nueva' }, initialTargetContractId: undefined });

    expect(screen.getByLabelText(/contrato destino/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled();
  });
});

describe('TSMI-5: initialTarget con name null', () => {
  it('usa un fallback visible y no crashea', () => {
    renderPreloaded({ initialTarget: { id: 'cl-new', name: null }, initialTargetContractId: 'ct-t1' });

    expect(
      screen.getByText((_, el) =>
        el?.tagName === 'P' && /transferir tv de juan viejo a/i.test(el.textContent ?? ''),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/sin nombre/i)).toBeInTheDocument();
  });
});
