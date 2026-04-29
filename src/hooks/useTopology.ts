import { useQuery } from '@tanstack/react-query';
import type { TopologyNode } from '@/types/topology';
import * as api from '@/api/topology.api';

export function useTopology() {
  return useQuery<TopologyNode>({ queryKey: ['topology'], queryFn: api.getTopology });
}
