export interface ContractSummary {
  id: string;
  clientId: string;
  clientName: string;
  plan: string;
  status: 'active' | 'inactive' | 'blocked' | 'late' | 'baja';
  technology: string | null;
  startDate: string;
}
