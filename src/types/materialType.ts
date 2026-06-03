export interface MaterialType {
  id: string;
  name: string;
  label: string | null;
  unit: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
