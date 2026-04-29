import { useTopology } from '@/hooks/useTopology';
import type { TopologyNode } from '@/types/topology';

const TYPE_LABELS: Record<TopologyNode['type'], string> = {
  isp: 'ISP',
  router: 'Router',
  olt: 'OLT',
  ont: 'ONT',
  client: 'Cliente',
};

const STATUS_COLORS: Record<TopologyNode['status'], string> = {
  activo: 'bg-green-100 text-green-800',
  inactivo: 'bg-gray-100 text-gray-600',
  alerta: 'bg-yellow-100 text-yellow-800',
};

function NodeTree({ node, depth = 0 }: { node: TopologyNode; depth?: number }) {
  return (
    <div style={{ marginLeft: depth * 20 }} className="my-1">
      <div className="flex items-center gap-2 py-1">
        <span className="text-xs text-gray-400 font-mono">{TYPE_LABELS[node.type]}</span>
        <span className="text-sm text-gray-700 font-medium">{node.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[node.status]}`}>
          {node.status}
        </span>
      </div>
      {node.children?.map(child => (
        <NodeTree key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function NetworkTopologyPage() {
  const { data: topology, isLoading } = useTopology();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Topología de Red</h1>

      {isLoading ? (
        <div className="bg-gray-100 rounded-lg h-48 animate-pulse" />
      ) : topology ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <NodeTree node={topology} />
        </div>
      ) : (
        <p className="text-gray-500">No hay datos de topología disponibles.</p>
      )}
    </div>
  );
}
