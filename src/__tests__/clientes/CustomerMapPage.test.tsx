import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomerMapPage from '@/pages/clientes/CustomerMapPage';

describe('CustomerMapPage', () => {
  it('renders the page title', () => {
    render(<MemoryRouter><CustomerMapPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Mapa de clientes/i })).toBeInTheDocument();
  });

  it('renders a map container', () => {
    render(<MemoryRouter><CustomerMapPage /></MemoryRouter>);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('renders customer markers', () => {
    render(<MemoryRouter><CustomerMapPage /></MemoryRouter>);
    expect(screen.getAllByTestId('map-marker').length).toBeGreaterThanOrEqual(10);
  });
});
