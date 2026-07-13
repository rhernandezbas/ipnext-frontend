/**
 * ChatMediaDownloadCard tests
 *
 * Clon de RadiusAuthIngestCard.test.tsx pero para el flag `chat-media-download`
 * (descarga de media entrante de WhatsApp a MinIO, F1.5 fase A). Hoy el flag
 * solo se prende por API — esta card lo expone en Ajustes con un toggle.
 *
 * Covers:
 *  1. Renders loading state
 *  2. Renders flag status — ON
 *  3. Renders flag status — OFF
 *  4. Toggle calls setFlag.mutate with correct args
 *  5. Gate: without admin.flags, toggle is not rendered
 *  6. Error state from setFlag.mutate
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlag: vi.fn(),
  useSetFeatureFlag: vi.fn(),
}));
vi.mock('@/hooks/useMyPermissions', () => ({
  useMyPermissions: vi.fn(),
  useCan: vi.fn(),
}));

import { useFeatureFlag, useSetFeatureFlag } from '@/hooks/useFeatureFlags';
import { useMyPermissions, useCan } from '@/hooks/useMyPermissions';
import { ChatMediaDownloadCard } from '@/components/settings/ChatMediaDownloadCard';

function setupHooks({
  flagEnabled = false,
  flagLoading = false,
  flagError = false,
  setFlagPending = false,
  setFlagError = false,
  permissions = ['admin.flags'],
}: {
  flagEnabled?: boolean;
  flagLoading?: boolean;
  flagError?: boolean;
  setFlagPending?: boolean;
  setFlagError?: boolean;
  permissions?: string[];
} = {}) {
  const mutateFn = vi.fn();

  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions,
    isLoading: false,
    isError: false,
    can: (p: string | string[], _mode?: string) => {
      const perms = Array.isArray(p) ? p : [p];
      return perms.some(perm => permissions.includes(perm));
    },
  } as never);

  vi.mocked(useCan).mockImplementation((perm: string) => permissions.includes(perm));

  vi.mocked(useFeatureFlag).mockReturnValue({
    data: flagLoading ? undefined : { key: 'chat-media-download', enabled: flagEnabled },
    isLoading: flagLoading,
    isError: flagError,
  } as ReturnType<typeof useFeatureFlag>);

  vi.mocked(useSetFeatureFlag).mockReturnValue({
    mutate: mutateFn,
    isPending: setFlagPending,
    isError: setFlagError,
  } as unknown as ReturnType<typeof useSetFeatureFlag>);

  return { mutateFn };
}

describe('ChatMediaDownloadCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading ────────────────────────────────────────────────────────────────

  it('renders loading state while flag is loading', () => {
    setupHooks({ flagLoading: true });
    render(<ChatMediaDownloadCard />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  // ── Flag status ────────────────────────────────────────────────────────────

  it('renders "Inactiva" badge when flag is OFF', () => {
    setupHooks({ flagEnabled: false });
    render(<ChatMediaDownloadCard />);
    expect(screen.getByText(/inactiva/i)).toBeInTheDocument();
    expect(screen.queryByText(/^activa$/i)).not.toBeInTheDocument();
  });

  it('renders "Activa" badge when flag is ON', () => {
    setupHooks({ flagEnabled: true });
    render(<ChatMediaDownloadCard />);
    expect(screen.getByText(/^activa$/i)).toBeInTheDocument();
    expect(screen.queryByText(/inactiva/i)).not.toBeInTheDocument();
  });

  it('renders card title', () => {
    setupHooks();
    render(<ChatMediaDownloadCard />);
    expect(screen.getByRole('heading', { name: /descarga de media de whatsapp/i })).toBeInTheDocument();
  });

  // ── Toggle interaction ─────────────────────────────────────────────────────

  it('toggle is rendered and checked when flag is ON (with admin.flags)', () => {
    setupHooks({ flagEnabled: true, permissions: ['admin.flags'] });
    render(<ChatMediaDownloadCard />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  it('toggle is rendered and unchecked when flag is OFF (with admin.flags)', () => {
    setupHooks({ flagEnabled: false, permissions: ['admin.flags'] });
    render(<ChatMediaDownloadCard />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('clicking the toggle calls mutate with enabled: true when flag is OFF', () => {
    const { mutateFn } = setupHooks({ flagEnabled: false, permissions: ['admin.flags'] });
    render(<ChatMediaDownloadCard />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(mutateFn).toHaveBeenCalledTimes(1);
    expect(mutateFn).toHaveBeenCalledWith({ key: 'chat-media-download', enabled: true });
  });

  it('clicking the toggle calls mutate with enabled: false when flag is ON', () => {
    const { mutateFn } = setupHooks({ flagEnabled: true, permissions: ['admin.flags'] });
    render(<ChatMediaDownloadCard />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(mutateFn).toHaveBeenCalledTimes(1);
    expect(mutateFn).toHaveBeenCalledWith({ key: 'chat-media-download', enabled: false });
  });

  it('toggle is disabled while mutation is pending', () => {
    setupHooks({ flagEnabled: false, permissions: ['admin.flags'], setFlagPending: true });
    render(<ChatMediaDownloadCard />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  // ── Permission gate ────────────────────────────────────────────────────────

  it('toggle is NOT rendered when user lacks admin.flags', () => {
    setupHooks({ permissions: [] });
    render(<ChatMediaDownloadCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('toggle is NOT rendered when user has unrelated permissions but not admin.flags', () => {
    setupHooks({ permissions: ['messaging.read', 'network.read'] });
    render(<ChatMediaDownloadCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  // ── Error states ───────────────────────────────────────────────────────────

  it('renders error banner when setFlag fails', () => {
    setupHooks({ permissions: ['admin.flags'], setFlagError: true });
    render(<ChatMediaDownloadCard />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/no se pudo cambiar/i)).toBeInTheDocument();
  });

  it('does NOT render toggle when there is a flag-fetch error', () => {
    setupHooks({ flagError: true });
    render(<ChatMediaDownloadCard />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
