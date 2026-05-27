export type PlanSubtype = 'internet' | 'voice' | 'recurring' | 'onetime' | 'bundle';

export interface ServicePlan {
  id: string;
  name: string;
  type: 'internet' | 'voip' | 'tv' | 'other';
  planSubtype: PlanSubtype;
  downloadSpeed: number;
  uploadSpeed: number;
  price: number;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  status: 'active' | 'inactive';
  description: string;
  subscriberCount: number;
}
