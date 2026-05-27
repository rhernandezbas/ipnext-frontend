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
  supplier: string;
  status: 'pending' | 'received' | 'cancelled';
  date: string;
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
