/**
 * ContractStatsCards — TDD tests
 * CS-1: renders "Contratos totales" card with total count
 * CS-2: renders one card per key in byStatus dynamically
 * CS-3: clicking a card calls onStatusClick with the key
 * CS-4: active card has aria-pressed=true
 * CS-5: shows "…" while loading
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ContractStatsCards } from '@/pages/contracts/ContractStatsCards';
import * as useContractsModule from '@/hooks/useContracts';
import { mockQuery } from '@/__tests__/_utils/reactQueryMocks';

vi.mock('@/hooks/useContracts');

const mockStats = {
  total: 320,
  byStatus: {
    Vigente: 200,
    Baja: 80,
    Suspendido: 40,
  },
};

describe('ContractStatsCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useContractsModule.useContractStats).mockReturnValue(mockQuery({
      data: mockStats,
      isLoading: false,
    }));
  });

  // CS-1
  it('renders "Contratos totales" card with total count', () => {
    render(<ContractStatsCards activeStatus="" onStatusClick={vi.fn()} />);
    expect(screen.getByText(/contratos totales/i)).toBeInTheDocument();
    expect(screen.getByText('320')).toBeInTheDocument();
  });

  // CS-2: dynamic cards from byStatus
  it('renders one card per key in byStatus', () => {
    render(<ContractStatsCards activeStatus="" onStatusClick={vi.fn()} />);
    expect(screen.getByText('Vigente')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('Baja')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('Suspendido')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  // CS-2b: number of buttons = 1 (total) + keys in byStatus
  it('renders total + byStatus.length cards', () => {
    render(<ContractStatsCards activeStatus="" onStatusClick={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1 + Object.keys(mockStats.byStatus).length);
  });

  // CS-3: clicking a status card calls onStatusClick with the status key
  it('clicking a status card calls onStatusClick with that status', async () => {
    const onStatusClick = vi.fn();
    const user = userEvent.setup();
    render(<ContractStatsCards activeStatus="" onStatusClick={onStatusClick} />);
    await user.click(screen.getByRole('button', { name: /Vigente/i }));
    expect(onStatusClick).toHaveBeenCalledWith('Vigente');
  });

  // CS-3b: clicking total card calls onStatusClick with ''
  it('clicking the total card calls onStatusClick with ""', async () => {
    const onStatusClick = vi.fn();
    const user = userEvent.setup();
    render(<ContractStatsCards activeStatus="" onStatusClick={onStatusClick} />);
    await user.click(screen.getByRole('button', { name: /contratos totales/i }));
    expect(onStatusClick).toHaveBeenCalledWith('');
  });

  // CS-4: active card has aria-pressed=true
  it('active card has aria-pressed=true', () => {
    render(<ContractStatsCards activeStatus="Vigente" onStatusClick={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /Vigente/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('inactive cards have aria-pressed=false', () => {
    render(<ContractStatsCards activeStatus="Vigente" onStatusClick={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /Baja/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  // CS-5: shows loading placeholder
  it('shows "…" while loading', () => {
    vi.mocked(useContractsModule.useContractStats).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useContractsModule.useContractStats>);
    render(<ContractStatsCards activeStatus="" onStatusClick={vi.fn()} />);
    // At least the total card renders with placeholder
    expect(screen.getAllByText('…').length).toBeGreaterThanOrEqual(1);
  });
});
