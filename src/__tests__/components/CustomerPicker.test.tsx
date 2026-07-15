/**
 * CustomerPicker compartido (components/molecules) — movido desde scheduling
 * en service-transfer W4. Misma cobertura + exclusión por excludeId.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const useClientList = vi.fn();
vi.mock('@/hooks/useCustomers', () => ({ useClientList: () => useClientList() }));

import { CustomerPicker } from '@/components/molecules/CustomerPicker/CustomerPicker';

const clients = [
  { id: 'c-1', name: 'Juan García', email: 'juan@test.com', phone: '+5491111111111', status: 'active', balance: 0, category: '', tariffPlan: null, login: null, ipRanges: null, accessDevices: 0, createdAt: '' },
  { id: 'c-2', name: 'María López', email: 'maria@test.com', phone: '+5492222222222', status: 'active', balance: 0, category: '', tariffPlan: null, login: null, ipRanges: null, accessDevices: 0, createdAt: '' },
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
    // manual-recipients-fe — onChange ahora lleva el objeto cliente como 3er arg
    // (aditivo); los callers de 2 args lo ignoran.
    expect(onChange).toHaveBeenCalledWith('c-1', 'Juan García', expect.objectContaining({ id: 'c-1' }));
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

  // service-transfer W4 — el modal de transferencia excluye al cliente ORIGEN.
  it('excludes the excludeId client from the results', async () => {
    render(<CustomerPicker value={null} valueName={null} onChange={onChange} excludeId="c-1" />);
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'a' } });

    await screen.findByText('María López');
    expect(screen.queryByText('Juan García')).not.toBeInTheDocument();
  });

  // manual-recipients-fe — onChange gana un 3er arg OPCIONAL con el objeto
  // cliente completo (para leer el teléfono en el chip del multi-select). Los
  // callers viejos de 2 args lo ignoran; acá verificamos que llega.
  it('passes the full client object as an optional 3rd onChange arg', async () => {
    render(<CustomerPicker value={null} valueName={null} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'Juan' } });

    fireEvent.click(await screen.findByText('Juan García'));
    expect(onChange).toHaveBeenCalledWith(
      'c-1',
      'Juan García',
      expect.objectContaining({ id: 'c-1', name: 'Juan García', phone: '+5491111111111' }),
    );
  });

  // manual-recipients-fe — excludeIds (array) excluye MÚLTIPLES clientes (los
  // ya agregados a la lista manual), aditivo junto al excludeId single.
  it('excludes all excludeIds clients from the results', async () => {
    render(<CustomerPicker value={null} valueName={null} onChange={onChange} excludeIds={['c-1']} />);
    fireEvent.change(screen.getByPlaceholderText(/buscar cliente/i), { target: { value: 'a' } });

    await screen.findByText('María López');
    expect(screen.queryByText('Juan García')).not.toBeInTheDocument();
  });

  // service-transfer FIX 6 — a11y: un label externo se asocia al input via la prop id.
  it('associates an external label to the search input through the id prop', () => {
    render(
      <>
        <label htmlFor="picker-search">Cliente destino</label>
        <CustomerPicker id="picker-search" value={null} valueName={null} onChange={onChange} />
      </>,
    );
    expect(screen.getByLabelText('Cliente destino')).toBe(
      screen.getByPlaceholderText(/buscar cliente/i),
    );
  });
});
