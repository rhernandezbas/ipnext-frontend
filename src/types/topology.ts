export interface TopologyNode {
  id: string;
  name: string;
  type: 'isp' | 'router' | 'olt' | 'ont' | 'client';
  status: 'activo' | 'inactivo' | 'alerta';
  children?: TopologyNode[];
}
