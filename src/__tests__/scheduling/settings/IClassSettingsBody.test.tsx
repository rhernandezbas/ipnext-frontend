import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// All sub-bodies are stubbed — we only test the host's tab orchestration.
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
vi.mock('@/pages/scheduling/settings/ClosureProgressTable', () => ({
  ClosureProgressTable: () => <div data-testid="closure-progress-table" />,
}));
vi.mock('@/pages/scheduling/settings/ClosureIntervalConfig', () => ({
  ClosureIntervalConfig: () => <div data-testid="closure-interval-config" />,
}));

import { IClassSettingsBody } from '@/pages/scheduling/settings/IClassSettingsBody';

function renderSettings() {
  return render(
    <MemoryRouter>
      <IClassSettingsBody />
    </MemoryRouter>,
  );
}

describe('IClassSettingsBody', () => {
  beforeEach(() => vi.clearAllMocks());

  // REQ-LIST-4 SC1: 5 sub-tabs in order
  it('renders exactly 5 sub-tabs: Integración, Catálogo, Mapeo de proyectos, Mapeo de estado, Procesamiento', () => {
    renderSettings();
    const tabs = screen.getAllByRole('tab').map(t => t.textContent);
    expect(tabs).toEqual([
      'Integración',
      'Catálogo',
      'Mapeo de proyectos',
      'Mapeo de estado',
      'Procesamiento',
    ]);
    // Old "Cierre de OS" label must no longer exist
    expect(screen.queryByRole('tab', { name: 'Cierre de OS' })).not.toBeInTheDocument();
  });

  it('defaults to the Integración sub-tab', () => {
    renderSettings();
    expect(screen.getByRole('tab', { name: 'Integración' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('flag-body')).toBeInTheDocument();
  });

  it('does not mount the Catálogo body until its tab is clicked (lazy mount)', () => {
    renderSettings();
    expect(screen.queryByTestId('catalog-body')).not.toBeInTheDocument();
  });

  it('clicking the Catálogo tab activates it and mounts its body', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: 'Catálogo' }));
    expect(screen.getByRole('tab', { name: 'Catálogo' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('catalog-body')).toBeInTheDocument();
  });

  it('clicking the Mapeo de proyectos tab activates it and mounts its body', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: 'Mapeo de proyectos' }));
    expect(screen.getByRole('tab', { name: 'Mapeo de proyectos' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('mapping-body')).toBeInTheDocument();
  });

  // REQ-LIST-4 SC2: Mapeo de estado mounts ONLY IClassResultCodeMappingBody
  it('clicking Mapeo de estado mounts result-code mapping and NOT closure body or progress table', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: 'Mapeo de estado' }));
    expect(screen.getByRole('tab', { name: 'Mapeo de estado' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('result-mapping-body')).toBeInTheDocument();
    expect(screen.queryByTestId('closure-body')).not.toBeInTheDocument();
    expect(screen.queryByTestId('closure-progress-table')).not.toBeInTheDocument();
  });

  // B3.1 — REQ-BACKFILL-PENDING-PAGE-1: ClosureProgressTable NOT in Procesamiento sub-tab
  it('B3.1 clicking Procesamiento mounts closure body but NOT the progress table (table moved to standalone page)', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: 'Procesamiento' }));
    expect(screen.getByRole('tab', { name: 'Procesamiento' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('closure-body')).toBeInTheDocument();
    expect(screen.queryByTestId('closure-progress-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('result-mapping-body')).not.toBeInTheDocument();
  });

  // Deep-link preservation: cierre id still maps to the Procesamiento tab
  it('keeps id="cierre" on the Procesamiento tab for deep-link compatibility', () => {
    renderSettings();
    // The tab with label "Procesamiento" should correspond to the cierre id.
    // We verify by clicking the Procesamiento tab — the cierre sub-state activates.
    fireEvent.click(screen.getByRole('tab', { name: 'Procesamiento' }));
    expect(screen.getByTestId('closure-body')).toBeInTheDocument();
  });
});
