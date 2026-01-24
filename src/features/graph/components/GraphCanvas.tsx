import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  SelectionMode,
  applyNodeChanges,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import { useGraphStore } from '@/stores';
import type { GraphNode, EndpointNodeData } from '@/types/graph';
import type { HttpMethod } from '@/types';
import { METHOD_HEX_COLORS, SCHEMA_HEX_COLOR } from '@/constants';
import { EndpointNode } from './EndpointNode';
import { SchemaNode } from './SchemaNode';
import { FilterToolbar } from './FilterToolbar';
import { BulkActionsToolbar } from './BulkActionsToolbar';
import { useFilteredGraph } from '../hooks/useFilteredGraph';
import { useSourceHighlight } from '@/shared/hooks/useSourceHighlight';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: Record<string, any> = {
  endpoint: EndpointNode,
  schema: SchemaNode,
};

function GraphCanvasInner() {
  const { nodes: storeNodes, edges: storeEdges, selectNode, selectedNodeIds, setNodes, hideNodes, setSelectedNodeIds } = useGraphStore();

  // Apply filters to nodes and edges
  const { filteredNodes, filteredEdges } = useFilteredGraph(storeNodes, storeEdges);

  // Sync selection to Monaco editor highlighting
  useSourceHighlight();

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

  // Sync React Flow's selection state with our store
  // Uses equality check to prevent infinite loops
  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      const newIds = new Set(selectedNodes.map((n) => n.id));

      // Check if selection actually changed to prevent infinite loops
      if (newIds.size !== selectedNodeIds.size ||
          ![...newIds].every((id) => selectedNodeIds.has(id))) {
        setSelectedNodeIds(newIds);
      }
    },
    [selectedNodeIds, setSelectedNodeIds]
  );

  // Handle keyboard shortcuts for selection actions
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Handle Delete/Backspace to hide selected nodes
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeIds.size > 0) {
        event.preventDefault();
        hideNodes(Array.from(selectedNodeIds));
      }

      // Handle Escape to clear selection
      if (event.key === 'Escape' && selectedNodeIds.size > 0) {
        event.preventDefault();
        selectNode(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, hideNodes, selectNode]);

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
      <div className="relative flex-1">
        <BulkActionsToolbar />
        <ReactFlow
          nodes={nodesWithSelection}
          edges={edgesWithAnimation}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodesChange={handleNodesChange}
          onSelectionChange={handleSelectionChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
          // Marquee selection configuration
          selectionOnDrag={true}
          selectionMode={SelectionMode.Partial}
          // Pan with middle/right mouse button, allowing left-drag for selection
          panOnDrag={[1, 2]}
          // Multi-selection modifier keys
          multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
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

export function GraphCanvas() {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner />
    </ReactFlowProvider>
  );
}
