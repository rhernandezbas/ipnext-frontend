import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// All three sub-bodies are stubbed — we only test the host's tab orchestration.
vi.mock('@/pages/scheduling/settings/IClassFlagBody', () => ({
  IClassFlagBody: () => <div data-testid="flag-body" />,
}));
vi.mock('@/pages/scheduling/settings/IClassSoTypesCatalogBody', () => ({
  IClassSoTypesCatalogBody: () => <div data-testid="catalog-body" />,
}));
vi.mock('@/pages/scheduling/settings/IClassProjectMappingBody', () => ({
  IClassProjectMappingBody: () => <div data-testid="mapping-body" />,
}));

import { IClassSettingsBody } from '@/pages/scheduling/settings/IClassSettingsBody';

describe('IClassSettingsBody', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the three sub-tabs in order: Integración, Catálogo, Mapeo de proyectos', () => {
    render(<IClassSettingsBody />);
    const tabs = screen.getAllByRole('tab').map(t => t.textContent);
    expect(tabs).toEqual(['Integración', 'Catálogo', 'Mapeo de proyectos']);
  });

  it('defaults to the Integración sub-tab', () => {
    render(<IClassSettingsBody />);
    expect(screen.getByRole('tab', { name: 'Integración' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('flag-body')).toBeInTheDocument();
  });

  it('does not mount the Catálogo body until its tab is clicked (lazy mount)', () => {
    render(<IClassSettingsBody />);
    expect(screen.queryByTestId('catalog-body')).not.toBeInTheDocument();
  });

  it('clicking the Catálogo tab activates it and mounts its body', () => {
    render(<IClassSettingsBody />);
    fireEvent.click(screen.getByRole('tab', { name: 'Catálogo' }));
    expect(screen.getByRole('tab', { name: 'Catálogo' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('catalog-body')).toBeInTheDocument();
  });

  it('clicking the Mapeo de proyectos tab activates it and mounts its body', () => {
    render(<IClassSettingsBody />);
    fireEvent.click(screen.getByRole('tab', { name: 'Mapeo de proyectos' }));
    expect(screen.getByRole('tab', { name: 'Mapeo de proyectos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('mapping-body')).toBeInTheDocument();
  });
});
