/**
 * inboxViews — catálogo de vistas del inbox estilo Chatwoot (inbox-views Ola 1)
 * + helpers PUROS del sub-menú (formato de contadores / aria-labels).
 *
 * El PIN de presets por vista es el contrato central del change: cada vista es
 * un preset EXACTO de `WhatsappPaginatedQuery` (status/assignment/view) — lo
 * que el sub-menú setea es lo que viaja al BE (`GET /messaging/conversations`).
 * Verificado contra el BE real (`messaging.routes.ts`, worktree inbox-views-be):
 * `view=unattended` es un eje PROPIO (ortogonal a assignment) y GANA sobre
 * `status` — el preset de "Sin atender" manda SOLO `view` (sin status).
 */
import { describe, it, expect } from 'vitest';
import {
  INBOX_VIEWS,
  INBOX_VIEW_PRESETS,
  INBOX_VIEW_EMPTY_MESSAGES,
  formatViewCount,
  viewCountAriaLabel,
} from './inboxViews';

describe('INBOX_VIEWS — catálogo ordenado (paridad sidebar Chatwoot)', () => {
  it('expone las 7 vistas en el orden Mi bandeja / Sin atender / Menciones / Todas / Sin asignar / Pospuestas / Resueltas', () => {
    expect(INBOX_VIEWS.map((v) => v.id)).toEqual([
      'mine',
      'unattended',
      'mentioned',
      'all',
      'unassigned',
      'snoozed',
      'resolved',
    ]);
    expect(INBOX_VIEWS.map((v) => v.label)).toEqual([
      'Mi bandeja',
      'Sin atender',
      'Menciones',
      'Todas',
      'Sin asignar',
      'Pospuestas',
      'Resueltas',
    ]);
  });
});

describe('INBOX_VIEW_PRESETS — pin del query por vista (contrato BE)', () => {
  it('mine → {status:"open", assignment:"mine"} (no-resueltas asignadas al user)', () => {
    expect(INBOX_VIEW_PRESETS.mine).toEqual({ status: 'open', assignment: 'mine' });
  });

  it('unattended → {view:"unattended"} SOLO — sin status (view GANA sobre status en el BE) ni assignment', () => {
    expect(INBOX_VIEW_PRESETS.unattended).toEqual({ view: 'unattended' });
  });

  it('all → {status:"open"} — idéntico al default histórico de la page (cero regresión del cache entry inicial)', () => {
    expect(INBOX_VIEW_PRESETS.all).toEqual({ status: 'open' });
  });

  it('unassigned → {status:"open", assignment:"unassigned"}', () => {
    expect(INBOX_VIEW_PRESETS.unassigned).toEqual({ status: 'open', assignment: 'unassigned' });
  });

  it('resolved → {status:"resolved"} — sin assignment (los presets no acumulan ejes de otras vistas)', () => {
    expect(INBOX_VIEW_PRESETS.resolved).toEqual({ status: 'resolved' });
  });

  it('mentioned → {view:"mentioned"} SOLO — eje PROPIO del BE (muestra resueltas también), sin status ni assignment', () => {
    expect(INBOX_VIEW_PRESETS.mentioned).toEqual({ view: 'mentioned' });
  });

  it('snoozed → {view:"snoozed"} SOLO — pospuestas vigentes, eje PROPIO del BE, sin status ni assignment', () => {
    expect(INBOX_VIEW_PRESETS.snoozed).toEqual({ view: 'snoozed' });
  });

  it('cada vista del catálogo tiene su preset y su empty message (sin huecos)', () => {
    for (const view of INBOX_VIEWS) {
      expect(INBOX_VIEW_PRESETS[view.id]).toBeDefined();
      expect(INBOX_VIEW_EMPTY_MESSAGES[view.id]).toMatch(/^No hay conversaciones/);
    }
  });
});

describe('formatViewCount — formato visual del contador (99+ para >99, el cero SÍ se muestra)', () => {
  it('undefined → null (sin dato no se pinta número — hook de counts caído/cargando)', () => {
    expect(formatViewCount(undefined)).toBeNull();
  });

  it('0 → "0" (el cero es información en un dashboard de vistas, jamás se oculta)', () => {
    expect(formatViewCount(0)).toBe('0');
  });

  it('valores normales se muestran tal cual', () => {
    expect(formatViewCount(3)).toBe('3');
    expect(formatViewCount(99)).toBe('99');
  });

  it('>99 → "99+"', () => {
    expect(formatViewCount(100)).toBe('99+');
    expect(formatViewCount(1437)).toBe('99+');
  });
});

describe('viewCountAriaLabel — nombre accesible legible ("Sin atender, 3 conversaciones")', () => {
  it('sin count (hook caído) → solo el label de la vista', () => {
    expect(viewCountAriaLabel('Sin atender', undefined)).toBe('Sin atender');
  });

  it('plural: "Sin atender, 3 conversaciones"', () => {
    expect(viewCountAriaLabel('Sin atender', 3)).toBe('Sin atender, 3 conversaciones');
  });

  it('singular: "Mi bandeja, 1 conversación"', () => {
    expect(viewCountAriaLabel('Mi bandeja', 1)).toBe('Mi bandeja, 1 conversación');
  });

  it('cero: "Resueltas, 0 conversaciones"', () => {
    expect(viewCountAriaLabel('Resueltas', 0)).toBe('Resueltas, 0 conversaciones');
  });

  it('>99 usa el número REAL en el aria-label (el "99+" es solo visual)', () => {
    expect(viewCountAriaLabel('Todas', 143)).toBe('Todas, 143 conversaciones');
  });
});
