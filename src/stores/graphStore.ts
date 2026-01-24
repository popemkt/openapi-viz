import { create } from 'zustand';
import type { GraphNode, GraphEdge, LayoutState } from '@/types';

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: LayoutState;
  selectedNodeIds: Set<string>;
  hoveredNodeId: string | null;

  setNodes: (nodes: GraphNode[]) => void;
  setEdges: (edges: GraphEdge[]) => void;
  /** Select a node. If additive is true, adds to selection; otherwise replaces. Pass null to clear selection. */
  selectNode: (id: string | null, additive?: boolean) => void;
  hoverNode: (id: string | null) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  setLayout: (layout: Partial<LayoutState>) => void;
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

  reset: () =>
    set({
      nodes: [],
      edges: [],
      layout: initialLayout,
      selectedNodeIds: new Set<string>(),
      hoveredNodeId: null,
    }),
}));
