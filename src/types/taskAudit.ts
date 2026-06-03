export type AuditSeverity = 'ok' | 'warning' | 'critical';
export type AuditCategory = 'señal' | 'conexión' | 'fotos' | 'instalación' | 'otros';

export interface AuditFinding {
  id: string;
  severity: AuditSeverity;
  category: AuditCategory;
  text: string;
  photoUrls: string[];
  createdAt: string;
}
