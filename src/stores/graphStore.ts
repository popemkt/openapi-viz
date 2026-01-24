import { create } from 'zustand';
import type { GraphNode, GraphEdge, LayoutState } from '@/types';
import { applyDagreLayout } from '@/core/graph-builder/layout';

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: LayoutState;
  selectedNodeIds: Set<string>;
  hoveredNodeId: string | null;
  /** Manually hidden node IDs (hidden via Delete key) */
  hiddenNodeIds: Set<string>;
  /** Canonical layout positions (for restore after relayout) */
  baseLayout: Record<string, { x: number; y: number }>;
  /** Whether auto-layout is enabled on changes */
  isAutoLayoutEnabled: boolean;

  setNodes: (nodes: GraphNode[]) => void;
  setEdges: (edges: GraphEdge[]) => void;
  /** Select a node. If additive is true, adds to selection; otherwise replaces. Pass null to clear selection. */
  selectNode: (id: string | null, additive?: boolean) => void;
  /** Direct set for syncing with React Flow's selection state */
  setSelectedNodeIds: (ids: Set<string>) => void;
  hoverNode: (id: string | null) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  setLayout: (layout: Partial<LayoutState>) => void;
  /** Hide the specified node IDs manually */
  hideNodes: (ids: string[]) => void;
  /** Show (unhide) the specified node IDs */
  showNodes: (ids: string[]) => void;
  /** Show all manually hidden nodes */
  showAllHiddenNodes: () => void;
  /** Toggle hidden state for multiple nodes */
  toggleVisibility: (ids: string[]) => void;
  /** Hide all nodes except the specified ones and their immediate neighbors */
  focusOnNodes: (ids: string[]) => void;
  /** Select all visible (non-hidden) nodes */
  selectAll: () => void;
  /** Expand selection to include all connected nodes (recursive) */
  selectConnected: (ids: string[]) => void;
  /** Save current layout positions as the base layout */
  saveBaseLayout: () => void;
  /** Restore positions from the saved base layout */
  restoreBaseLayout: () => void;
  /** Toggle auto-layout mode */
  setAutoLayout: (enabled: boolean) => void;
  /** Relayout visible nodes using Dagre algorithm */
  relayoutVisibleNodes: () => void;
  reset: () => void;
}

const initialLayout: LayoutState = {
  positions: {},
  zoom: 1,
  pan: { x: 0, y: 0 },
};

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  layout: initialLayout,
  selectedNodeIds: new Set<string>(),
  hoveredNodeId: null,
  hiddenNodeIds: new Set<string>(),
  baseLayout: {},
  isAutoLayoutEnabled: true,

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  selectNode: (id, additive = false) =>
    set((state) => {
      if (id === null) {
        // Clear selection
        return { selectedNodeIds: new Set<string>() };
      }
      if (additive) {
        // Toggle selection: add if not present, remove if present
        const newSet = new Set(state.selectedNodeIds);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return { selectedNodeIds: newSet };
      }
      // Replace selection with single node
      return { selectedNodeIds: new Set([id]) };
    }),

  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),

  hoverNode: (id) => set({ hoveredNodeId: id }),

  updateNodePosition: (id, position) =>
    set((state) => ({
      layout: {
        ...state.layout,
        positions: {
          ...state.layout.positions,
          [id]: position,
        },
      },
    })),

  setLayout: (layout) =>
    set((state) => ({
      layout: { ...state.layout, ...layout },
    })),

  hideNodes: (ids) =>
    set((state) => {
      const newHidden = new Set(state.hiddenNodeIds);
      ids.forEach((id) => newHidden.add(id));
      // Clear selection for hidden nodes
      const newSelected = new Set(state.selectedNodeIds);
      ids.forEach((id) => newSelected.delete(id));
      return { hiddenNodeIds: newHidden, selectedNodeIds: newSelected };
    }),

  showNodes: (ids) =>
    set((state) => {
      const newHidden = new Set(state.hiddenNodeIds);
      ids.forEach((id) => newHidden.delete(id));
      return { hiddenNodeIds: newHidden };
    }),

  showAllHiddenNodes: () => set({ hiddenNodeIds: new Set<string>() }),

  toggleVisibility: (ids) =>
    set((state) => {
      const newHidden = new Set(state.hiddenNodeIds);
      const newSelected = new Set(state.selectedNodeIds);

      ids.forEach((id) => {
        if (newHidden.has(id)) {
          // Currently hidden -> show
          newHidden.delete(id);
        } else {
          // Currently visible -> hide
          newHidden.add(id);
          // Clear from selection when hiding
          newSelected.delete(id);
        }
      });

      return { hiddenNodeIds: newHidden, selectedNodeIds: newSelected };
    }),

  focusOnNodes: (ids) =>
    set((state) => {
      const focusSet = new Set(ids);

      // Find all neighbors (nodes connected by edges)
      const neighbors = new Set<string>();
      state.edges.forEach((edge) => {
        if (focusSet.has(edge.source)) {
          neighbors.add(edge.target);
        }
        if (focusSet.has(edge.target)) {
          neighbors.add(edge.source);
        }
      });

      // Nodes to keep visible: focus set + neighbors
      const keepVisible = new Set([...focusSet, ...neighbors]);

      // Hide all nodes not in keepVisible
      const newHidden = new Set<string>();
      state.nodes.forEach((node) => {
        if (!keepVisible.has(node.id)) {
          newHidden.add(node.id);
        }
      });

      // Update selection to only include nodes that remain visible
      const newSelected = new Set(
        [...state.selectedNodeIds].filter((id) => keepVisible.has(id))
      );

      return { hiddenNodeIds: newHidden, selectedNodeIds: newSelected };
    }),

  selectAll: () =>
    set((state) => {
      // Select all visible (non-hidden) nodes
      const visibleNodeIds = state.nodes
        .filter((node) => !state.hiddenNodeIds.has(node.id))
        .map((node) => node.id);
      return { selectedNodeIds: new Set(visibleNodeIds) };
    }),

  selectConnected: (ids) =>
    set((state) => {
      const selected = new Set(ids);
      let changed = true;

      // Recursively expand to all connected nodes
      while (changed) {
        changed = false;
        state.edges.forEach((edge) => {
          const sourceSelected = selected.has(edge.source);
          const targetSelected = selected.has(edge.target);

          // Expand to connected nodes that are not hidden
          if (sourceSelected && !targetSelected && !state.hiddenNodeIds.has(edge.target)) {
            selected.add(edge.target);
            changed = true;
          }
          if (targetSelected && !sourceSelected && !state.hiddenNodeIds.has(edge.source)) {
            selected.add(edge.source);
            changed = true;
          }
        });
      }

      return { selectedNodeIds: selected };
    }),

  saveBaseLayout: () =>
    set((state) => ({
      baseLayout: { ...state.layout.positions },
    })),

  restoreBaseLayout: () =>
    set((state) => ({
      layout: {
        ...state.layout,
        positions: { ...state.baseLayout },
      },
      // Also unhide all nodes when restoring base layout
      hiddenNodeIds: new Set<string>(),
    })),

  setAutoLayout: (enabled) => set({ isAutoLayoutEnabled: enabled }),

  relayoutVisibleNodes: () =>
    set((state) => {
      // Get only visible (non-hidden) nodes
      const visibleNodes = state.nodes.filter(
        (node) => !state.hiddenNodeIds.has(node.id)
      );

      // Get edges that connect visible nodes only
      const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
      const visibleEdges = state.edges.filter(
        (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
      );

      // Apply Dagre layout to visible nodes
      const layoutedVisibleNodes = applyDagreLayout(visibleNodes, visibleEdges);

      // Create a map of new positions
      const newPositions: Record<string, { x: number; y: number }> = {};
      layoutedVisibleNodes.forEach((node) => {
        newPositions[node.id] = node.position;
      });

      // Merge layouted nodes back: update visible node positions, keep hidden nodes as-is
      const updatedNodes = state.nodes.map((node) => {
        if (newPositions[node.id]) {
          return { ...node, position: newPositions[node.id] };
        }
        return node;
      });

      // Also update the layout.positions for consistency
      const updatedPositions = { ...state.layout.positions, ...newPositions };

      return {
        nodes: updatedNodes,
        layout: { ...state.layout, positions: updatedPositions },
      };
    }),

  reset: () =>
    set({
      nodes: [],
      edges: [],
      layout: initialLayout,
      selectedNodeIds: new Set<string>(),
      hoveredNodeId: null,
      hiddenNodeIds: new Set<string>(),
      baseLayout: {},
      isAutoLayoutEnabled: true,
    }),
}));
