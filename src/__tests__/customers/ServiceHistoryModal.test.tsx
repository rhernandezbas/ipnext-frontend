import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ServiceHistoryModal } from '../../components/molecules/ServiceHistoryModal/ServiceHistoryModal';
import type { ServiceHistoryEntry } from '../../types/customer';

vi.mock('@/hooks/useContractServiceHistory');

import { useContractServiceHistory } from '@/hooks/useContractServiceHistory';

const mockUseHistory = vi.mocked(useContractServiceHistory);

const entries: ServiceHistoryEntry[] = [
  {
    id: '1',
    contractId: 'c1',
    serviceCatalogId: 's1',
    name: 'FIBER',
    label: 'Fibra Óptica',
    status: 'active',
    notes: 'Nota test',
    tvLogin: null,
    createdAt: '2024-01-15T00:00:00Z',
    deactivatedAt: null,
  },
  {
    id: '2',
    contractId: 'c1',
    serviceCatalogId: 's2',
    name: 'TV',
    label: null,
    status: 'inactive',
    notes: null,
    tvLogin: 'user123',
    createdAt: '2023-06-01T00:00:00Z',
    deactivatedAt: '2024-01-10T00:00:00Z',
  },
];

describe('ServiceHistoryModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders both rows with correct labels and status badges', () => {
    mockUseHistory.mockReturnValue({ data: entries, isLoading: false } as any);
    render(
      <ServiceHistoryModal open onClose={vi.fn()} contractId="c1" contractName="Contrato A" />
    );
    expect(screen.getByText('Fibra Óptica')).toBeInTheDocument();
    expect(screen.getByText('TV')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    // 'Baja' appears twice: once as column header, once as badge — both should be present
    expect(screen.getAllByText('Baja').length).toBeGreaterThanOrEqual(1);
    // badge for inactive row is rendered with label override 'Baja'
    const badges = screen.getAllByText('Baja');
    // at least one is a badge span (not the th column header)
    expect(badges.some(el => el.tagName.toLowerCase() === 'span')).toBe(true);
  });

  it('shows empty state when data is []', () => {
    mockUseHistory.mockReturnValue({ data: [], isLoading: false } as any);
    render(
      <ServiceHistoryModal open onClose={vi.fn()} contractId="c1" />
    );
    expect(screen.getByText('Sin historial de servicios para este contrato.')).toBeInTheDocument();
  });

  it('calls onClose on Esc key', () => {
    mockUseHistory.mockReturnValue({ data: entries, isLoading: false } as any);
    const onClose = vi.fn();
    render(<ServiceHistoryModal open onClose={onClose} contractId="c1" />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render dialog when open=false', () => {
    mockUseHistory.mockReturnValue({ data: entries, isLoading: false } as any);
    render(<ServiceHistoryModal open={false} onClose={vi.fn()} contractId="c1" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
