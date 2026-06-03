export interface DeviceType {
  id: string;
  name: string;
  label: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
