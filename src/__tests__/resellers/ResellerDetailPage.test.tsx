import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import ResellerDetailPage from '@/pages/resellers/ResellerDetailPage';

vi.mock('@/hooks/useResellers', () => ({
  useResellerDetail: vi.fn(),
}));

import { useResellerDetail } from '@/hooks/useResellers';

const mockReseller = {
  id: '1',
  name: 'ISP Norte',
  clientCount: 150,
  revenue: 45000,
  status: 'activo',
  contactEmail: 'norte@isp.com',
};

describe('ResellerDetailPage', () => {
  beforeEach(() => {
    vi.mocked(useResellerDetail).mockReturnValue({
      data: mockReseller,
      isLoading: false,
    } as ReturnType<typeof useResellerDetail>);
  });

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/admin/resellers/1']}>
        <Routes>
          <Route path="/admin/resellers/:id" element={<ResellerDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('renders heading "Detalle Reseller"', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /detalle reseller/i })).toBeInTheDocument();
  });

  it('renders reseller name', () => {
    renderPage();
    expect(screen.getByText('ISP Norte')).toBeInTheDocument();
  });

  it('renders total clientes stat', () => {
    renderPage();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('renders revenue stat', () => {
    renderPage();
    expect(screen.getByText(/45000|45\.000/)).toBeInTheDocument();
  });
});
