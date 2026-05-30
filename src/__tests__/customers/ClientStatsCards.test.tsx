import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ClientStatsCards } from '@/pages/customers/ClientStatsCards';
import * as useClientsModule from '@/hooks/useCustomers';

vi.mock('@/hooks/useCustomers');

describe('ClientStatsCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useClientsModule.useClientStats).mockReturnValue({
      data: { total: 100, active: 60, inactive: 10, late: 15, blocked: 8, baja: 7 },
      isLoading: false,
    } as ReturnType<typeof useClientsModule.useClientStats>);
  });

  it('renders a Bajas card with its count', () => {
    render(<ClientStatsCards activeStatus="" onStatusClick={vi.fn()} />);
    expect(screen.getByText('Bajas')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('uses GR-aligned labels (Deudor / Incobrable)', () => {
    render(<ClientStatsCards activeStatus="" onStatusClick={vi.fn()} />);
    expect(screen.getByText('Deudor')).toBeInTheDocument();
    expect(screen.getByText('Incobrable')).toBeInTheDocument();
  });

  it('clicking the Bajas card toggles the filter to "baja"', async () => {
    const onStatusClick = vi.fn();
    const user = userEvent.setup();
    render(<ClientStatsCards activeStatus="" onStatusClick={onStatusClick} />);
    await user.click(screen.getByRole('button', { name: /Bajas/ }));
    expect(onStatusClick).toHaveBeenCalledWith('baja');
  });
});
