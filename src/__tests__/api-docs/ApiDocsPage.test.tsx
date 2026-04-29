import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import ApiDocsPage from '@/pages/api-docs/ApiDocsPage';

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeQC()}>
      <MemoryRouter>
        <ApiDocsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ApiDocsPage', () => {
  it('renders "Documentación API" heading', () => {
    renderPage();
    expect(screen.getByText('Documentación API')).toBeInTheDocument();
  });

  it('shows endpoint groups in sidebar', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Clientes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tickets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finanzas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Red' })).toBeInTheDocument();
  });

  it('clicking a group shows endpoints for that group', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Tickets' }));

    expect(screen.getAllByText('/api/tickets').length).toBeGreaterThan(0);
    expect(screen.getByText('Listar tickets')).toBeInTheDocument();
  });

  it('endpoint shows method badge (GET/POST etc.)', () => {
    renderPage();
    // Default group is Clientes which has GET methods
    const methodBadges = screen.getAllByText('GET');
    expect(methodBadges.length).toBeGreaterThan(0);
  });

  it('shows path and description', () => {
    renderPage();
    expect(screen.getAllByText('/api/clients').length).toBeGreaterThan(0);
    expect(screen.getByText('Listar todos los clientes')).toBeInTheDocument();
  });
});
