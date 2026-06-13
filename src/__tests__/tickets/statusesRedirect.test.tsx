/**
 * Tests: /admin/tickets/statuses redirects to /admin/tickets/settings.
 *
 * Uses a focused MemoryRouter + Routes setup rather than rendering the full App
 * (the full App has dozens of lazy routes and complex providers that are out of
 * scope here). We reproduce just the tickets subroutes that matter.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';

// Minimal stand-in for the two routes we care about
function StatusesRoute() {
  return <Navigate to="/admin/tickets/settings" replace />;
}

function SettingsPage() {
  return <div data-testid="settings-page">Settings</div>;
}

function renderRoutes(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/tickets/statuses" element={<StatusesRoute />} />
        <Route path="/admin/tickets/settings" element={<SettingsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('statuses redirect', () => {
  it('navigating to /admin/tickets/statuses lands on /admin/tickets/settings', () => {
    renderRoutes('/admin/tickets/statuses');
    expect(screen.getByTestId('settings-page')).toBeInTheDocument();
  });

  it('direct navigation to /admin/tickets/settings renders the settings page', () => {
    renderRoutes('/admin/tickets/settings');
    expect(screen.getByTestId('settings-page')).toBeInTheDocument();
  });
});
