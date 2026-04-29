import type { TopologyNode } from '@/types/topology';

const MOCK_TOPOLOGY: TopologyNode = {
  id: 'isp-1',
  name: 'IPNEXT Core',
  type: 'isp',
  status: 'activo',
  children: [
    {
      id: 'router-1',
      name: 'Router Principal',
      type: 'router',
      status: 'activo',
      children: [
        {
          id: 'olt-1',
          name: 'OLT Norte',
          type: 'olt',
          status: 'activo',
          children: [
            { id: 'ont-1', name: 'ONT-001', type: 'ont', status: 'activo', children: [{ id: 'client-1', name: 'Cliente A', type: 'client', status: 'activo' }] },
            { id: 'ont-2', name: 'ONT-002', type: 'ont', status: 'alerta', children: [{ id: 'client-2', name: 'Cliente B', type: 'client', status: 'alerta' }] },
          ],
        },
        {
          id: 'olt-2',
          name: 'OLT Sur',
          type: 'olt',
          status: 'inactivo',
          children: [
            { id: 'ont-3', name: 'ONT-003', type: 'ont', status: 'inactivo', children: [{ id: 'client-3', name: 'Cliente C', type: 'client', status: 'inactivo' }] },
          ],
        },
      ],
    },
  ],
};

export function getTopology(): Promise<TopologyNode> {
  return Promise.resolve(MOCK_TOPOLOGY);
}
