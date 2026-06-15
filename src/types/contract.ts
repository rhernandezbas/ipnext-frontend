export interface ContractSummary {
  id: string;
  clientId: string;
  clientName: string;
  code: string | null; // grContratoId expuesto por el BE (#55)
  plan: string;
  status: 'active' | 'inactive' | 'blocked' | 'late' | 'baja';
  technology: string | null;
  startDate: string;
}
