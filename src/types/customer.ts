export type CustomerStatus = 'active' | 'inactive' | 'blocked' | 'new' | 'baja';

export interface Service {
  id: number;
  type: string;
  plan: string;
  status: CustomerStatus;
  price: number;
  startDate: string;
  endDate: string | null;
  ipAddress: string | null;
  description: string;
  /** Installation address from GR (available after task-service-location change). */
  address?: string | null;
  /** Latitude from GR. Null when GR does not have it. */
  lat?: number | null;
  /** Longitude from GR. Null when GR does not have it. */
  lng?: number | null;
}

export interface LogEntry {
  id: number;
  date: string;
  type: string;
  message: string;
  adminId: number | null;
  adminName: string | null;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: CustomerStatus;
  category: string;
  tariffPlan: string | null;
  createdAt: string;
  updatedAt: string;
  services: Service[];
  logs: LogEntry[];
  // Optional fields surfaced by the Postgres adapter (Splynx Customer module)
  city?: string;
  country?: string;
  login?: string;
  splynxId?: string | null;
  grClienteId?: string | null;
  customAttributes?: Record<string, unknown> | null;
  /** Gestión Real balance sync fields (gr-client-balance-sync change). */
  balanceDue?: number | null;
  balanceOverdue?: number | null;
  invoicesQty?: number | null;
  lastBalanceAt?: string | null;
}

export interface CustomerSummary {
  id: number;
  /** Gestión Real client id — shown as the business id when present. */
  grClienteId?: string | null;
  name: string;
  email: string;
  phone: string;
  status: CustomerStatus;
  category: string;
  tariffPlan: string | null;
  login: string | null;
  ipRanges: string | null;
  accessDevices: number;
  createdAt: string;
}

export interface CreateCustomerData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  status?: 'active' | 'inactive';
}

export interface UpdateCustomerData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface AddServiceData {
  type: string;
  plan: string;
  ipAddress?: string;
  status?: string;
  startDate?: string;
}

export interface UpdateServiceData {
  type?: string;
  plan?: string;
  ipAddress?: string;
  status?: string;
  endDate?: string;
}
