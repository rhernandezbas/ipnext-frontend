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

  it('distinguishes close vs reopen for status_changed', () => {
    expect(describeActivity(act({ type: 'status_changed', toValue: true }))).toContain('cerró');
    expect(describeActivity(act({ type: 'status_changed', toValue: false }))).toContain('reabrió');
  });

  it('distinguishes assigned vs unassigned', () => {
    expect(describeActivity(act({ type: 'assigned' }))).toContain('asignó');
    expect(describeActivity(act({ type: 'unassigned' }))).toContain('quitó');
  });

  it('falls back to a readable label for an unknown type', () => {
    expect(describeActivity(act({ type: 'some_future_event' }))).toBe('some future event');
  });
});
