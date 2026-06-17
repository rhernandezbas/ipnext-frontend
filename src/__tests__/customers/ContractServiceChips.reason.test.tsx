/**
 * #127 — ContractServiceChips: clicking "×" opens the ServiceRemovalReasonModal
 * instead of the generic ConfirmContext. The reason threads through to
 * remove.mutateAsync({ contractId, id, reason }).
 *
 * Tests:
 * 1. Clicking "×" opens a modal (role="dialog") with a textarea.
 * 2. Modal confirm button is disabled when textarea is empty.
 * 3. Confirming with a reason calls the remove mutation with { contractId, id, reason }.
 * 4. Cancelling the modal does NOT call the remove mutation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContractServiceChips } from '../../pages/customers/tabs/contracts/ContractServiceChips';
import type { ContractService } from '../../types/customer';

vi.mock('@/hooks/useMyPermissions');
vi.mock('@/context/ConfirmContext');
vi.mock('@/hooks/useContractServices');

import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useConfirm } from '@/context/ConfirmContext';
import { useUpdateContractService, useRemoveContractService } from '@/hooks/useContractServices';

const removeMutateAsync = vi.fn();

const services: ContractService[] = [
  {
    id: 'cs-1',
    serviceCatalogId: 'sc-1',
    name: 'INTERNET',
    label: 'Internet Fibra',
    status: 'active',
    notes: null,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

function setup() {
  vi.mocked(useMyPermissions).mockReturnValue({
    can: () => true,
    permissions: [],
  } as any);
  vi.mocked(useConfirm).mockReturnValue(vi.fn().mockResolvedValue(true));
  vi.mocked(useUpdateContractService).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as any);
  vi.mocked(useRemoveContractService).mockReturnValue({
    mutateAsync: removeMutateAsync,
    isPending: false,
  } as any);
}

describe('ContractServiceChips — #127 remove with reason', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('clicking "×" opens the reason modal with a textarea', async () => {
    const user = userEvent.setup();
    render(
      <ContractServiceChips contractId="ct-9" clientId="cust-1" services={services} />,
    );
    await user.click(screen.getByRole('button', { name: /quitar Internet Fibra/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('confirm button in modal is DISABLED when textarea is empty', async () => {
    const user = userEvent.setup();
    render(
      <ContractServiceChips contractId="ct-9" clientId="cust-1" services={services} />,
    );
    await user.click(screen.getByRole('button', { name: /quitar Internet Fibra/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /dar de baja/i })).toBeDisabled();
  });

  it('confirming with a reason calls remove.mutateAsync with { contractId, id, reason }', async () => {
    const user = userEvent.setup();
    removeMutateAsync.mockResolvedValue(undefined);
    render(
      <ContractServiceChips contractId="ct-9" clientId="cust-1" services={services} />,
    );
    await user.click(screen.getByRole('button', { name: /quitar Internet Fibra/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Cliente con deuda');
    await user.click(within(dialog).getByRole('button', { name: /dar de baja/i }));
    await waitFor(() =>
      expect(removeMutateAsync).toHaveBeenCalledWith({
        contractId: 'ct-9',
        id: 'cs-1',
        reason: 'Cliente con deuda',
      }),
    );
  });

  it('cancelling the reason modal does NOT call remove.mutateAsync', async () => {
    const user = userEvent.setup();
    render(
      <ContractServiceChips contractId="ct-9" clientId="cust-1" services={services} />,
    );
    await user.click(screen.getByRole('button', { name: /quitar Internet Fibra/i }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /cancelar/i }));
    expect(removeMutateAsync).not.toHaveBeenCalled();
  });
});
