import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CrmMapPage from '@/pages/crm/CrmMapPage';

describe('CrmMapPage', () => {
  it('renders the page title', () => {
    render(<MemoryRouter><CrmMapPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /Mapa CRM/i })).toBeInTheDocument();
  });

  it('renders a map container', () => {
    render(<MemoryRouter><CrmMapPage /></MemoryRouter>);
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });

  it('renders lead markers', () => {
    render(<MemoryRouter><CrmMapPage /></MemoryRouter>);
    expect(screen.getAllByTestId('map-marker').length).toBeGreaterThanOrEqual(8);
  });
});
