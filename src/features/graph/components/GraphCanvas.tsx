import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  applyNodeChanges,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { useGraphStore } from '@/stores';
import type { GraphNode, EndpointNodeData } from '@/types/graph';
import type { HttpMethod } from '@/types';
import { METHOD_HEX_COLORS, SCHEMA_HEX_COLOR } from '@/constants';
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
  const { nodes: storeNodes, edges: storeEdges, selectNode, selectedNodeIds, setNodes } = useGraphStore();

  // Apply filters to nodes and edges
  const { filteredNodes, filteredEdges } = useFilteredGraph(storeNodes, storeEdges);

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Support multi-select with Shift+Click
      const additive = event.shiftKey;
      selectNode(node.id, additive);
    },
    [selectNode]
  );

  const handlePaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<GraphNode>[]) => {
      // Apply all changes using React Flow's helper to keep internal state in sync
      // This is required to fix error #015 - nodes must be properly initialized
      // React Flow needs to track dimensions, selection state, etc.
      const updatedNodes = applyNodeChanges(changes, storeNodes);
      setNodes(updatedNodes);
    },
    [storeNodes, setNodes]
  );

  // Apply selection styling to nodes
  const nodesWithSelection = useMemo(() => {
    return filteredNodes.map((node) => ({
      ...node,
      selected: selectedNodeIds.has(node.id),
    }));
  }, [filteredNodes, selectedNodeIds]);

  // Apply animated dashed styling to edges connected to selected nodes
  const edgesWithAnimation = useMemo(() => {
    if (selectedNodeIds.size === 0) {
      return filteredEdges;
    }

    return filteredEdges.map((edge) => {
      const isConnectedToSelected =
        selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target);

      if (isConnectedToSelected) {
        return {
          ...edge,
          animated: true,
          style: {
            ...edge.style,
            strokeDasharray: '5,5',
            strokeWidth: 2.5,
          },
        };
      }
      return edge;
    });
  }, [filteredEdges, selectedNodeIds]);

  // Get color for minimap nodes based on node type
  const getMinimapNodeColor = useCallback((node: Node) => {
    const graphNode = node as GraphNode;
    if (graphNode.data.type === 'endpoint') {
      const endpointData = graphNode.data as EndpointNodeData;
      const method = endpointData.endpoint.method as HttpMethod;
      return METHOD_HEX_COLORS[method] ?? SCHEMA_HEX_COLOR;
    }
    return SCHEMA_HEX_COLOR;
  }, []);

  return (
    <div className="flex h-full w-full flex-col">
      <FilterToolbar />
      <div className="flex-1">
        <ReactFlow
          nodes={nodesWithSelection}
          edges={edgesWithAnimation}
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
            nodeColor={getMinimapNodeColor}
            pannable
            zoomable
            className="!bg-card !border-border"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
