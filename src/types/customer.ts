export type CustomerStatus = 'active' | 'inactive' | 'blocked' | 'new';

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
  balance: number;
  category: string;
  tariffPlan: string | null;
  createdAt: string;
  updatedAt: string;
  services: Service[];
  logs: LogEntry[];
}

export interface CustomerSummary {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: CustomerStatus;
  balance: number;
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
