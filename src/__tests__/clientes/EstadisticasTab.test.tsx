import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { EstadisticasTab } from '@/pages/clientes/tabs/EstadisticasTab';

vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

describe('EstadisticasTab', () => {
  it('renders "Estadísticas de tráfico" heading', () => {
    render(<EstadisticasTab clientId="42" active={true} />);
    expect(screen.getByText('Estadísticas de tráfico')).toBeInTheDocument();
  });

  it('renders period selector buttons', () => {
    render(<EstadisticasTab clientId="42" active={true} />);
    expect(screen.getByRole('button', { name: '7 días' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 días' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90 días' })).toBeInTheDocument();
  });

  it('renders line chart', () => {
    render(<EstadisticasTab clientId="42" active={true} />);
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders "Velocidad actual" section', () => {
    render(<EstadisticasTab clientId="42" active={true} />);
    expect(screen.getByText('Velocidad actual')).toBeInTheDocument();
  });

  it('switches period on button click', async () => {
    const user = userEvent.setup();
    render(<EstadisticasTab clientId="42" active={true} />);
    const btn7 = screen.getByRole('button', { name: '7 días' });
    await user.click(btn7);
    expect(btn7).toHaveAttribute('aria-pressed', 'true');
  });
});
