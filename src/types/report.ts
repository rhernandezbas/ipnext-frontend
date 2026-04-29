export type ReportCategory = 'clients' | 'finance' | 'network' | 'scheduling' | 'voice' | 'inventory';

export type ReportType =
  | 'clients_by_status' | 'clients_by_plan' | 'clients_by_location' | 'new_clients' | 'churned_clients'
  | 'revenue_by_period' | 'unpaid_invoices' | 'payment_methods' | 'overdue_clients' | 'tax_report'
  | 'device_uptime' | 'bandwidth_usage' | 'ip_usage' | 'nas_sessions'
  | 'tasks_by_status' | 'technician_performance'
  | 'cdr_summary' | 'voice_revenue'
  | 'stock_levels' | 'low_stock';

export interface ReportFilter {
  key: string;
  label: string;
  type: 'date' | 'select' | 'text' | 'daterange';
  options?: { value: string; label: string }[];
  required: boolean;
}

export interface ReportDefinition {
  id: string;
  type: ReportType;
  category: ReportCategory;
  name: string;
  description: string;
  filters: ReportFilter[];
}

export interface ReportResult {
  reportType: ReportType;
  generatedAt: string;
  filters: Record<string, string>;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  summary: Record<string, unknown>;
}
