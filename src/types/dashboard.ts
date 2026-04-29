export interface DashboardStats {
  newClientsThisMonth: number;
  activeClients: number;
  openTickets: number;
  pendingTickets: number;
  unresponsiveDevices: number;
  onlineDevices: number;
  revenueThisMonth: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  uptime: string;
}

export interface DashboardShortcut {
  id: string;
  label: string;
  icon: string;
  href: string;
  color: string;
}

export interface RecentActivity {
  id: string;
  type: 'client_added' | 'ticket_opened' | 'invoice_paid' | 'device_offline' | 'payment_received';
  description: string;
  timestamp: string;
  link: string;
}
