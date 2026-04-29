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

export interface NetworkDevice {
  id: string;
  name: string;
  type: 'router' | 'switch' | 'onu' | 'olt' | 'access_point' | 'other';
  ipAddress: string;
  macAddress: string;
  location: string;
  status: 'online' | 'offline' | 'warning';
  model: string;
  lastSeen: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'router' | 'cable' | 'splitter' | 'onu' | 'tools' | 'other';
  sku: string;
  quantity: number;
  minStock: number;
  unitPrice: number;
  supplier: string;
  location: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface InventoryProduct {
  id: string;
  name: string;
  category: 'router' | 'cable' | 'splitter' | 'onu' | 'tools' | 'other';
  sku: string;
  description: string;
  unitPrice: number;
  supplier: string;
  totalStock: number;
  minStock: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface SupplyOrder {
  id: string;
  proveedor: string;
  estado: 'pendiente' | 'recibido' | 'cancelado';
  fecha: string;
  total: number;
}

export interface InventoryUnit {
  id: string;
  productId: string;
  productName: string;
  serialNumber: string | null;
  barcode: string | null;
  status: 'available' | 'assigned' | 'damaged' | 'retired';
  location: string;
  purchaseDate: string | null;
  purchasePrice: number | null;
  assignedToClientId: string | null;
  assignedAt: string | null;
  notes: string;
}
