/**
 * SegmentBuilder — gating granular por estado (bulk-granular-perms FE, tarea 2).
 * Cada checkbox de estado se DESHABILITA si el usuario no tiene el permiso
 * `messaging.bulk_<status>` (active/late/blocked/inactive/baja). Un estado sin
 * permiso no se puede tildar; si el `value` ya lo trae tildado, el builder lo
 * STRIPEA (defensa en profundidad — no debe viajar al preview/create).
 *
 *  SBP-1 sin permiso para un estado → su checkbox queda deshabilitado
 *  SBP-2 con permiso → el checkbox queda habilitado
 *  SBP-3 un estado tildado en `value` sin permiso → onChange lo saca
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useMyPermissions');

import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { SegmentBuilder } from '@/pages/whatsapp/BulkMessagingPage/components/composer/SegmentBuilder';
import type { CampaignSegment } from '@/types/messagingBulk';

const EMPTY: CampaignSegment = { statuses: [] };

/** Mockea permisos a partir de la lista concedida (molde de los composer tests). */
function mockPerms(granted: string[]) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: granted,
    isLoading: false,
    isError: false,
    can: (permission: string | string[]) => {
      if (granted.includes('*')) return true;
      const perms = Array.isArray(permission) ? permission : [permission];
      return perms.some((p) => granted.includes(p));
    },
  } as UseMyPermissionsResult);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SBP-1: estado sin permiso → checkbox deshabilitado', () => {
  it('sin messaging.bulk_blocked, el checkbox "Bloqueado" queda deshabilitado', () => {
    // Concede todos menos "blocked".
    mockPerms(['messaging.bulk_active', 'messaging.bulk_late', 'messaging.bulk_inactive', 'messaging.bulk_baja']);
    render(<SegmentBuilder value={EMPTY} onChange={vi.fn()} />);

    expect(screen.getByRole('checkbox', { name: /bloqueado/i })).toBeDisabled();
    // Los que SÍ tiene permiso siguen habilitados.
    expect(screen.getByRole('checkbox', { name: /atrasado/i })).toBeEnabled();
  });
});

describe('SBP-2: con permiso → checkbox habilitado', () => {
  it('con todos los permisos, ningún checkbox de estado queda deshabilitado', () => {
    mockPerms(['*']);
    render(<SegmentBuilder value={EMPTY} onChange={vi.fn()} />);

    for (const name of [/^activo$/i, /atrasado/i, /bloqueado/i, /^inactivo$/i, /bajas/i]) {
      expect(screen.getByRole('checkbox', { name })).toBeEnabled();
    }
  });
});

describe('SBP-3: estado tildado sin permiso → se stripea', () => {
  it('un `value` con un estado sin permiso dispara onChange que lo saca del array', () => {
    // Sin permiso para "blocked", pero el value lo trae tildado.
    mockPerms(['messaging.bulk_late']);
    const onChange = vi.fn();
    render(<SegmentBuilder value={{ statuses: ['late', 'blocked'] }} onChange={onChange} />);

    expect(onChange).toHaveBeenCalledWith({ statuses: ['late'] });
  });
});
