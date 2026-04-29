import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TarifasHuaweiGroupsPage from '@/pages/empresa/tarifas/TarifasHuaweiGroupsPage';

describe('TarifasHuaweiGroupsPage', () => {
  it('renders the page title', () => {
    render(<MemoryRouter><TarifasHuaweiGroupsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /huawei groups/i })).toBeInTheDocument();
  });
});
