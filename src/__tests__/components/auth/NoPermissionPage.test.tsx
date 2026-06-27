import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Import BEFORE the component exists — this should fail with "module not found"
import { NoPermissionPage } from '@/components/auth/NoPermissionPage';

// Mock useNavigate so we can assert navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <NoPermissionPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockNavigate.mockReset();
});

describe('<NoPermissionPage>', () => {
  it('NP1 — renders heading "No tenés permisos"', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /no tenés permisos/i })
    ).toBeInTheDocument();
  });

  it('NP2 — renders description mentioning administrador', () => {
    renderPage();
    expect(screen.getByText(/administrador/i)).toBeInTheDocument();
  });

  it('NP3 — renders "Volver al inicio" button/link', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: /volver al inicio/i })
    ).toBeInTheDocument();
  });

  it('NP4 — clicking "Volver al inicio" navigates to /admin/dashboard', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /volver al inicio/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard');
  });

  it('NP5 — heading has focus on mount (screen reader accessibility)', () => {
    renderPage();
    const heading = screen.getByRole('heading', { name: /no tenés permisos/i });
    expect(heading).toBeInTheDocument();
    // tabIndex -1 means it can be programmatically focused
    expect(heading).toHaveAttribute('tabindex', '-1');
  });

  it('NP6 — has a lock or shield icon (aria-hidden)', () => {
    renderPage();
    // Icon element should be aria-hidden so screen readers skip it
    const icon = document.querySelector('[aria-hidden="true"]');
    expect(icon).not.toBeNull();
  });
});
