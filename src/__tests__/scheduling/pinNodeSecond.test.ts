import { describe, it, expect } from 'vitest';
import { pinNodeSecond } from '@/pages/scheduling/SchedulingTasksPage/components/TasksTableView';

describe('pinNodeSecond', () => {
  it('returns list unchanged when networkSiteName is not in list', () => {
    const keys = ['title', 'stageCategory', 'assigneeName'];
    expect(pinNodeSecond(keys)).toEqual(['title', 'stageCategory', 'assigneeName']);
  });

  it('moves networkSiteName from last position to position 1 (index 1)', () => {
    const keys = ['title', 'stageCategory', 'assigneeName', 'networkSiteName'];
    expect(pinNodeSecond(keys)).toEqual(['title', 'networkSiteName', 'stageCategory', 'assigneeName']);
  });

  it('keeps networkSiteName at position 1 when it is already there', () => {
    const keys = ['title', 'networkSiteName', 'stageCategory'];
    expect(pinNodeSecond(keys)).toEqual(['title', 'networkSiteName', 'stageCategory']);
  });

  it('returns [networkSiteName] when it is the only element in the list', () => {
    const keys = ['networkSiteName'];
    expect(pinNodeSecond(keys)).toEqual(['networkSiteName']);
  });

  it('moves networkSiteName from first position (index 0) to position 1', () => {
    const keys = ['networkSiteName', 'title', 'stageCategory'];
    expect(pinNodeSecond(keys)).toEqual(['title', 'networkSiteName', 'stageCategory']);
  });
});
