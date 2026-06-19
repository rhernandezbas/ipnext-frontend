export type PlanCategory = 'Air' | 'Alta' | 'Corte';

export interface PlanDto {
  id: string;
  code: string;
  name: string;
  category: PlanCategory;
  downloadKbps: number;
  uploadKbps: number;
  rateLimit: string;
  status: string;
  createdAt: string;
}

export interface CreatePlanDto {
  code: string;
  name: string;
  category: PlanCategory;
  downloadKbps: number;
  uploadKbps: number;
}

export interface UpdatePlanDto {
  name?: string;
  category?: PlanCategory;
  downloadKbps?: number;
  uploadKbps?: number;
  status?: string;
}
