import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// All five sub-bodies are stubbed — we only test the host's tab orchestration.
vi.mock('@/pages/scheduling/settings/IClassFlagBody', () => ({
  IClassFlagBody: () => <div data-testid="flag-body" />,
}));
vi.mock('@/pages/scheduling/settings/IClassSoTypesCatalogBody', () => ({
  IClassSoTypesCatalogBody: () => <div data-testid="catalog-body" />,
}));
vi.mock('@/pages/scheduling/settings/IClassProjectMappingBody', () => ({
  IClassProjectMappingBody: () => <div data-testid="mapping-body" />,
}));
vi.mock('@/pages/scheduling/settings/IClassClosureFlagBody', () => ({
  IClassClosureFlagBody: () => <div data-testid="closure-body" />,
}));
vi.mock('@/pages/scheduling/settings/IClassResultCodeMappingBody', () => ({
  IClassResultCodeMappingBody: () => <div data-testid="result-mapping-body" />,
}));

import { IClassSettingsBody } from '@/pages/scheduling/settings/IClassSettingsBody';

describe('IClassSettingsBody', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the four sub-tabs in order: Integración, Catálogo, Mapeo de proyectos, Cierre de OS (Mapeo de resultados absorbido en Cierre)', () => {
    render(<IClassSettingsBody />);
    const tabs = screen.getAllByRole('tab').map(t => t.textContent);
    expect(tabs).toEqual([
      'Integración',
      'Catálogo',
      'Mapeo de proyectos',
      'Cierre de OS',
    ]);
    // ya no existe una sub-tab separada de "Mapeo de resultados"
    expect(screen.queryByRole('tab', { name: 'Mapeo de resultados' })).not.toBeInTheDocument();
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

  it('clicking the Cierre de OS tab mounts BOTH the closure body AND the result-code mapping (unified)', () => {
    render(<IClassSettingsBody />);
    fireEvent.click(screen.getByRole('tab', { name: 'Cierre de OS' }));
    expect(screen.getByRole('tab', { name: 'Cierre de OS' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('closure-body')).toBeInTheDocument();
    expect(screen.getByTestId('result-mapping-body')).toBeInTheDocument();
  });
});
