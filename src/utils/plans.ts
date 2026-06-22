import type { PlanDto } from '@/types/plans';

export const isEligiblePlan = (p: PlanDto): boolean =>
  p.status === 'enabled' && p.category !== 'Corte';
