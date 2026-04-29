import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SchedulingMapsPage from '@/pages/scheduling/SchedulingMapsPage';

describe('SchedulingMapsPage', () => {
  it('renders the page title', () => {
    render(<MemoryRouter><SchedulingMapsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Mapas de Scheduling/i })).toBeInTheDocument();
  });

  it('renders a map container', () => {
    render(<MemoryRouter><SchedulingMapsPage /></MemoryRouter>);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('renders zone markers', () => {
    render(<MemoryRouter><SchedulingMapsPage /></MemoryRouter>);
    expect(screen.getAllByTestId('map-circle').length).toBeGreaterThanOrEqual(3);
  });

  it('renders task markers', () => {
    render(<MemoryRouter><SchedulingMapsPage /></MemoryRouter>);
    expect(screen.getAllByTestId('map-marker').length).toBeGreaterThanOrEqual(5);
  });
});
