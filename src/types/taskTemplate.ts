export type TaskTemplateCategory = 'installation' | 'repair' | 'maintenance' | 'inspection' | 'other';

export interface TaskTemplateItem {
  id: string;
  templateId: string;
  text: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  category: TaskTemplateCategory;
  items?: TaskTemplateItem[];
}
