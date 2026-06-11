import { describe, it, expect } from 'vitest';
import { describeActivity } from './taskActivityLabel';
import type { ActivityDto } from '@/types/taskActivity';

function act(over: Partial<ActivityDto>): ActivityDto {
  return {
    id: 'a1', taskId: 't1', type: 'created', actorId: 'u1', actorName: 'Alice',
    fromValue: null, toValue: null, metadata: null, createdAt: '2026-06-03T10:00:00Z',
    ...over,
  };
}

describe('describeActivity', () => {
  it('describes a created event', () => {
    expect(describeActivity(act({ type: 'created' }))).toBe('creó la tarea');
  });

  it('describes a priority change with from/to', () => {
    const text = describeActivity(act({ type: 'priority_changed', fromValue: 'Baja', toValue: 'Alta' }));
    expect(text).toContain('prioridad');
    expect(text).toContain('Baja');
    expect(text).toContain('Alta');
  });

  it('uses stage names from metadata for stage_changed', () => {
    const text = describeActivity(act({
      type: 'stage_changed',
      fromValue: 's1', toValue: 's2',
      metadata: { fromStageName: 'Nuevo', toStageName: 'En progreso' },
    }));
    expect(text).toContain('Nuevo');
    expect(text).toContain('En progreso');
  });

  it('distinguishes close vs reopen for status_changed (legacy boolean payloads)', () => {
    expect(describeActivity(act({ type: 'status_changed', toValue: true }))).toContain('cerró');
    expect(describeActivity(act({ type: 'status_changed', toValue: false }))).toContain('reabrió');
  });

  it('renders string status_changed payloads (#41): closed / open / dismissed', () => {
    expect(describeActivity(act({ type: 'status_changed', fromValue: 'open', toValue: 'closed' }))).toBe('cerró la tarea');
    expect(describeActivity(act({ type: 'status_changed', fromValue: 'closed', toValue: 'open' }))).toBe('reabrió la tarea');
    expect(describeActivity(act({ type: 'status_changed', fromValue: 'open', toValue: 'dismissed' }))).toBe('descartó la tarea');
    expect(describeActivity(act({ type: 'status_changed', fromValue: 'dismissed', toValue: 'open' }))).toBe('reabrió la tarea');
  });

  it('does not crash on a legacy boolean status_changed payload (#41)', () => {
    expect(() => describeActivity(act({ type: 'status_changed', fromValue: false, toValue: true }))).not.toThrow();
    expect(describeActivity(act({ type: 'status_changed', fromValue: false, toValue: true }))).toBe('cerró la tarea');
  });

  it('distinguishes assigned vs unassigned', () => {
    expect(describeActivity(act({ type: 'assigned' }))).toContain('asignó');
    expect(describeActivity(act({ type: 'unassigned' }))).toContain('quitó');
  });

  it('shows the diff with names for project/customer/reporter changes', () => {
    expect(
      describeActivity(act({ type: 'project_changed', fromValue: 'p0', toValue: 'p1', metadata: { fromName: 'Fibra Norte', toName: 'Fibra Sur' } })),
    ).toBe('cambió el proyecto: Fibra Norte → Fibra Sur');
    expect(
      describeActivity(act({ type: 'customer_changed', metadata: { fromName: 'Acme', toName: 'Globex' } })),
    ).toBe('cambió el cliente: Acme → Globex');
  });

  it('describes contract/partner by presence (no resolvable name)', () => {
    // the reported case: contract removed → "sin contrato"
    expect(describeActivity(act({ type: 'contract_changed', fromValue: 'c0', toValue: null }))).toBe('quitó el contrato');
    expect(describeActivity(act({ type: 'contract_changed', fromValue: null, toValue: 'c1' }))).toContain('asignó');
    expect(describeActivity(act({ type: 'partner_changed', fromValue: 'x', toValue: 'y' }))).toBe('cambió el partner');
  });

  it('shows the technician name for assigned/unassigned (the reported case)', () => {
    expect(
      describeActivity(act({ type: 'assigned', fromValue: null, toValue: 'u1', metadata: { fromName: null, toName: 'Juan Pérez' } })),
    ).toBe('asignó a Juan Pérez');
    expect(
      describeActivity(act({ type: 'assigned', fromValue: 'u0', toValue: 'u1', metadata: { fromName: 'Ana', toName: 'Juan' } })),
    ).toBe('reasignó: Ana → Juan');
    expect(
      describeActivity(act({ type: 'unassigned', fromValue: 'u0', toValue: null, metadata: { fromName: 'Ana', toName: null } })),
    ).toBe('quitó la asignación de Ana');
  });

  it('shows the watcher name for watcher_added/removed (#17), with fallback', () => {
    expect(
      describeActivity(act({ type: 'watcher_added', toValue: 'u1', metadata: { toName: 'Carla Ruiz' } })),
    ).toBe('agregó a Carla Ruiz');
    expect(
      describeActivity(act({ type: 'watcher_removed', fromValue: 'u2', metadata: { fromName: 'Ana Gómez' } })),
    ).toBe('quitó a Ana Gómez');
    // sin nombre en metadata → degrada al texto genérico
    expect(describeActivity(act({ type: 'watcher_added' }))).toBe('agregó un observador');
    expect(describeActivity(act({ type: 'watcher_removed' }))).toBe('quitó un observador');
  });

  it('shows values for due date, address and description', () => {
    expect(
      describeActivity(act({ type: 'due_date_changed', fromValue: null, toValue: '2026-06-10T00:00:00Z', metadata: { field: 'startDate' } })),
    ).toContain('de inicio');
    expect(
      describeActivity(act({ type: 'address_changed', fromValue: { address: 'Calle 1' }, toValue: { address: 'Calle 2' } })),
    ).toBe('cambió la dirección: Calle 1 → Calle 2');
    expect(describeActivity(act({ type: 'description_changed', toValue: 'nueva descripción' }))).toContain('nueva descripción');
  });

  it('falls back to a readable label for an unknown type', () => {
    expect(describeActivity(act({ type: 'some_future_event' }))).toBe('some future event');
  });
});
