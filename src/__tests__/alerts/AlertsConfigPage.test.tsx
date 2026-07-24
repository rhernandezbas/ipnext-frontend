/**
 * AlertsConfigPage tests (change `noc-alerts-config`, Fase F FE). Molde:
 * NetworkingSettingsPage — cada sección gatea con `Can` por su permiso REAL,
 * y muestra un fallback de "sin permiso" cuando falta.
 *
 * Los componentes pesados (cards de flags, editor de umbrales, ActivityBody)
 * se mockean acá — ya tienen su propio test file dedicado.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/components/settings/NocAlertsHubEnabledCard', () => ({
  NocAlertsHubEnabledCard: () => <div data-testid="hub-card" />,
}));
vi.mock('@/components/settings/NocAlertsTelegramSendCard', () => ({
  NocAlertsTelegramSendCard: () => <div data-testid="telegram-card" />,
}));
vi.mock('@/components/settings/NocAlertThresholdsEditor', () => ({
  NocAlertThresholdsEditor: () => <div data-testid="thresholds-editor" />,
}));
vi.mock('@/pages/system/admin/ActivityBody', () => ({
  ActivityBody: ({ initialEntityType }: { initialEntityType?: string }) => (
    <div data-testid="activity-body" data-initial-entity-type={initialEntityType} />
  ),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(),
}));

import { useMyPermissions, useCan } from '@/hooks/useMyPermissions';
import AlertsConfigPage from '@/pages/alerts/AlertsConfigPage';

function setPermissions(permissions: string[]) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.some((perm) => permissions.includes(perm));
    },
  } as never);
  vi.mocked(useCan).mockImplementation((perm: string) => permissions.includes(perm));
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AlertsConfigPage />
    </MemoryRouter>,
  );
}

describe('AlertsConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 3 section headings', () => {
    setPermissions(['admin.flags', 'monitoring.manage', 'admin.view_activity_log']);
    renderPage();
    expect(screen.getByRole('heading', { name: /feature flags/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^umbrales$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /auditor[ií]a de alertas/i })).toBeInTheDocument();
  });

  it('shows the flag cards when the user has admin.flags', () => {
    setPermissions(['admin.flags']);
    renderPage();
    expect(screen.getByTestId('hub-card')).toBeInTheDocument();
    expect(screen.getByTestId('telegram-card')).toBeInTheDocument();
  });

  it('hides the flag cards without admin.flags', () => {
    setPermissions([]);
    renderPage();
    expect(screen.queryByTestId('hub-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('telegram-card')).not.toBeInTheDocument();
  });

  it('always renders the thresholds editor (it self-gates monitoring.manage)', () => {
    setPermissions([]);
    renderPage();
    expect(screen.getByTestId('thresholds-editor')).toBeInTheDocument();
  });

  it('shows the audit activity body preseeded with entityType=NocAlert when the user has admin.view_activity_log', () => {
    setPermissions(['admin.view_activity_log']);
    renderPage();
    const body = screen.getByTestId('activity-body');
    expect(body).toHaveAttribute('data-initial-entity-type', 'NocAlert');
  });

  it('hides the audit section without admin.view_activity_log', () => {
    setPermissions([]);
    renderPage();
    expect(screen.queryByTestId('activity-body')).not.toBeInTheDocument();
  });
});
