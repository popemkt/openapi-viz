import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { useGraphStore } from '@/stores';
import { EndpointNode } from './EndpointNode';
import { SchemaNode } from './SchemaNode';
import { FilterToolbar } from './FilterToolbar';
import { useFilteredGraph } from '../hooks/useFilteredGraph';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, any> = {
  endpoint: EndpointNode,
  schema: SchemaNode,
};

export function GraphCanvas() {
  const { nodes: storeNodes, edges: storeEdges, selectNode, selectedNodeId, setNodes } = useGraphStore();

  // Apply filters to nodes and edges
  const { filteredNodes, filteredEdges } = useFilteredGraph(storeNodes, storeEdges);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const handlePaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Only handle position changes for dragging - ignore other change types
      const positionChanges = changes.filter(
        (change): change is NodeChange & { type: 'position'; position: { x: number; y: number } } =>
          change.type === 'position' && 'position' in change && change.position !== undefined
      );

      if (positionChanges.length === 0) {
        return;
      }

      // Create a map of updated positions from position changes
      const updatedPositions = new Map(
        positionChanges.map((change) => [change.id, change.position])
      );

      // Update store nodes with new positions where applicable
      const updatedStoreNodes = storeNodes.map((node) => {
        const newPosition = updatedPositions.get(node.id);
        if (newPosition && (node.position.x !== newPosition.x || node.position.y !== newPosition.y)) {
          return { ...node, position: newPosition };
        }
        return node;
      });

      setNodes(updatedStoreNodes);
    },
    [storeNodes, setNodes]
  );

  // Apply selection styling
  const nodesWithSelection = useMemo(() => {
    return filteredNodes.map((node) => ({
      ...node,
      selected: node.id === selectedNodeId,
    }));
  }, [filteredNodes, selectedNodeId]);

  return (
    <div className="flex h-full w-full flex-col">
      <FilterToolbar />
      <div className="flex-1">
        <ReactFlow
          nodes={nodesWithSelection}
          edges={filteredEdges}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodesChange={handleNodesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            animated: false,
            style: { strokeWidth: 2 },
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          <MiniMap
            nodeStrokeWidth={3}
            pannable
            zoomable
            className="!bg-card !border-border"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
