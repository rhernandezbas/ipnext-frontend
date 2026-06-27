import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const useClientList = vi.fn();
vi.mock('@/hooks/useCustomers', () => ({ useClientList: () => useClientList() }));

import { CustomerPicker } from '@/pages/scheduling/SchedulingTasksPage/components/CustomerPicker';

const clients = [
  { id: 'c-1', name: 'Juan García', email: 'juan@test.com', phone: '', status: 'active', balance: 0, category: '', tariffPlan: null, login: null, ipRanges: null, accessDevices: 0, createdAt: '' },
  { id: 'c-2', name: 'María López', email: 'maria@test.com', phone: '', status: 'active', balance: 0, category: '', tariffPlan: null, login: null, ipRanges: null, accessDevices: 0, createdAt: '' },
];

describe('CustomerPicker', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useClientList.mockReturnValue({ data: { data: clients, total: 2, page: 1, pageSize: 20, totalPages: 1 }, isFetching: false });
  });

  it('shows matching customers after typing and selects one', async () => {
    render(<CustomerPicker value={null} valueName={null} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Juan' } });

    const option = await screen.findByText('Juan García');
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('c-1', 'Juan García');
  });

  it('renders the selected customer as a chip with a clear button', () => {
    render(<CustomerPicker value="c-2" valueName="María López" onChange={onChange} />);
    expect(screen.getByText('María López')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /quitar cliente/i }));
    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it('does not show a dropdown before typing', () => {
    render(<CustomerPicker value={null} valueName={null} onChange={onChange} />);
    expect(screen.queryByText('Juan García')).not.toBeInTheDocument();
  });
});
