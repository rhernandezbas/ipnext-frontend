import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NetworkMapPage from '@/pages/networking/NetworkMapPage';

describe('NetworkMapPage', () => {
  it('renders the page title', () => {
    render(<MemoryRouter><NetworkMapPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Mapa de red/i })).toBeInTheDocument();
  });

  it('renders a map container', () => {
    render(<MemoryRouter><NetworkMapPage /></MemoryRouter>);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('renders network device markers', () => {
    render(<MemoryRouter><NetworkMapPage /></MemoryRouter>);
    // ISP node + 3 routers + 2 OLTs = 6 markers
    expect(screen.getAllByTestId('map-marker').length).toBeGreaterThanOrEqual(6);
  });
});
