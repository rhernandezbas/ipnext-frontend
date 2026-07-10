/**
 * CaseChecklist — checklist de un caso de titularidad (actions-worklist F2).
 *
 *  CHK-1 check AUTO 'ok' → StatusBadge verde "OK"
 *  CHK-2 check AUTO 'pending' → StatusBadge "Pendiente"
 *  CHK-3 check AUTO null → "—" (no evaluable, ej. caso sin target)
 *  CHK-4 equipos: conteos origen/destino (target null → "—")
 *  CHK-5 checkbox manual (actions.manage) → onToggleEquipmentReviewed con el nuevo valor
 *  CHK-6 reviewed=true → muestra quién y cuándo
 *  CHK-7 sin actions.manage → NO hay checkbox (solo estado read-only)
 *  CHK-8 caso cerrado (done/dismissed) → check manual read-only aun con manage (M2)
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { UseMyPermissionsResult } from '@/hooks/useMyPermissions';
import { CaseChecklist } from '@/pages/customers/AccionesPage/components/CaseChecklist';
import type { OwnershipCaseChecks, OwnershipCaseStatus } from '@/types/actions';

function mockPerms(perms: string[]) {
  vi.mocked(useMyPermissions).mockReturnValue({
    user: null,
    roles: [],
    permissions: perms,
    isLoading: false,
    isError: false,
    can: (p: string | string[]) => {
      if (perms.includes('*')) return true;
      const list = Array.isArray(p) ? p : [p];
      return list.some((x) => perms.includes(x));
    },
  } as UseMyPermissionsResult);
}

const CHECKS: OwnershipCaseChecks = {
  tv: 'ok',
  pppoe: 'pending',
  equipment: {
    sourceActive: 2,
    targetActive: 1,
    reviewed: false,
    reviewedAt: null,
    reviewedByName: null,
  },
};

const onToggle = vi.fn();

function renderChecklist(overrides?: Partial<OwnershipCaseChecks>, caseStatus?: OwnershipCaseStatus) {
  return render(
    <CaseChecklist
      caseId="case-1"
      checks={{ ...CHECKS, ...overrides }}
      caseStatus={caseStatus}
      onToggleEquipmentReviewed={onToggle}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPerms(['*']);
});

describe('CHK-1/2/3: estados de los checks AUTO', () => {
  it('tv ok → badge OK; pppoe pending → badge Pendiente', () => {
    renderChecklist();
    const tvRow = screen.getByText(/tv transferida/i).closest('li')!;
    expect(tvRow).toHaveTextContent(/ok/i);
    const pppoeRow = screen.getByText(/pppoe migrado/i).closest('li')!;
    expect(pppoeRow).toHaveTextContent(/pendiente/i);
  });

  it('check null → "—" (no evaluable)', () => {
    renderChecklist({ tv: null, pppoe: null });
    const tvRow = screen.getByText(/tv transferida/i).closest('li')!;
    expect(tvRow).toHaveTextContent('—');
    expect(tvRow).not.toHaveTextContent(/ok/i);
    const pppoeRow = screen.getByText(/pppoe migrado/i).closest('li')!;
    expect(pppoeRow).toHaveTextContent('—');
  });

  it('el "—" lleva tooltip "No aplica o no evaluable"', () => {
    renderChecklist({ tv: null, pppoe: null });
    expect(screen.getAllByTitle('No aplica o no evaluable')).toHaveLength(2);
  });
});

describe('CHK-4: conteos de equipos', () => {
  it('muestra activos en origen y destino', () => {
    renderChecklist();
    expect(screen.getByText(/2 activos en origen/i)).toBeInTheDocument();
    expect(screen.getByText(/1 en destino/i)).toBeInTheDocument();
  });

  it('target null → "—" en destino (no evaluable)', () => {
    renderChecklist({ equipment: { ...CHECKS.equipment, targetActive: null } });
    expect(screen.getByText(/— en destino/i)).toBeInTheDocument();
  });
});

describe('CHK-5: checkbox manual', () => {
  it('marca → onToggleEquipmentReviewed(true)', async () => {
    const user = userEvent.setup();
    renderChecklist();
    const checkbox = screen.getByRole('checkbox', { name: /revisión física/i });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('desmarca → onToggleEquipmentReviewed(false)', async () => {
    const user = userEvent.setup();
    renderChecklist({
      equipment: { ...CHECKS.equipment, reviewed: true, reviewedByName: 'Carlos', reviewedAt: '2026-07-01T12:00:00Z' },
    });
    const checkbox = screen.getByRole('checkbox', { name: /revisión física/i });
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith(false);
  });
});

describe('CHK-6: rastro del check manual', () => {
  it('reviewed → muestra quién y cuándo', () => {
    renderChecklist({
      equipment: {
        ...CHECKS.equipment,
        reviewed: true,
        reviewedByName: 'Carlos Gómez',
        reviewedAt: '2026-07-01T12:00:00Z',
      },
    });
    expect(screen.getByText(/carlos gómez/i)).toBeInTheDocument();
    expect(screen.getByText(/01 jul 2026/i)).toBeInTheDocument();
  });
});

describe('CHK-7: sin actions.manage no hay checkbox', () => {
  it('read-only: el estado se ve pero no se puede tildear', () => {
    mockPerms(['actions.read']);
    renderChecklist();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    // El estado manual sigue visible como badge read-only.
    expect(screen.getByText(/sin revisar/i)).toBeInTheDocument();
  });
});

describe('CHK-8: caso cerrado → check manual read-only (M2)', () => {
  it('done → sin checkbox aun con manage; badge de estado visible', () => {
    renderChecklist(undefined, 'done');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/sin revisar/i)).toBeInTheDocument();
  });

  it('dismissed con reviewed=true → badge Revisado + rastro visible, sin input', () => {
    renderChecklist(
      {
        equipment: {
          ...CHECKS.equipment,
          reviewed: true,
          reviewedByName: 'Carlos Gómez',
          reviewedAt: '2026-07-01T12:00:00Z',
        },
      },
      'dismissed',
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText('Revisado')).toBeInTheDocument();
    expect(screen.getByText(/carlos gómez/i)).toBeInTheDocument();
  });

  it('pending y ambiguous siguen editables', () => {
    const r1 = renderChecklist(undefined, 'pending');
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    r1.unmount();
    renderChecklist(undefined, 'ambiguous');
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });
});
