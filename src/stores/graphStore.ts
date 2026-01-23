import { create } from 'zustand';
import type { GraphNode, GraphEdge, LayoutState } from '@/types';

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: LayoutState;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;

  setNodes: (nodes: GraphNode[]) => void;
  setEdges: (edges: GraphEdge[]) => void;
  selectNode: (id: string | null) => void;
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
  selectedNodeId: null,
  hoveredNodeId: null,

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  selectNode: (id) => set({ selectedNodeId: id }),

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
      selectedNodeId: null,
      hoveredNodeId: null,
    }),
}));
