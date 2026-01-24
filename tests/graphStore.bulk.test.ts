import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphStore } from '../src/stores/graphStore';
import type { GraphNode, GraphEdge } from '../src/types';

// Helper to create mock nodes
function createMockNode(id: string): GraphNode {
  return {
    id,
    type: 'schema',
    position: { x: 0, y: 0 },
    data: {
      type: 'schema',
      schema: {
        id,
        name: id,
        type: 'object',
        properties: {},
        sourceLocation: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
      },
      visible: true,
      hasDiscriminator: false,
      incomingRefCount: 0,
      outgoingRefCount: 0,
    },
  };
}

// Helper to create mock edges
function createMockEdge(source: string, target: string): GraphEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    data: {
      edgeType: 'property',
    },
  };
}

describe('graphStore bulk actions', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useGraphStore.getState().reset();
  });

  describe('setSelectedNodeIds', () => {
    it('directly sets selection from Set', () => {
      const { setSelectedNodeIds } = useGraphStore.getState();

      setSelectedNodeIds(new Set(['A', 'B', 'C']));

      const { selectedNodeIds } = useGraphStore.getState();
      expect(selectedNodeIds.size).toBe(3);
      expect(selectedNodeIds.has('A')).toBe(true);
      expect(selectedNodeIds.has('B')).toBe(true);
      expect(selectedNodeIds.has('C')).toBe(true);
    });

    it('replaces existing selection', () => {
      const { setSelectedNodeIds } = useGraphStore.getState();

      setSelectedNodeIds(new Set(['A', 'B']));
      setSelectedNodeIds(new Set(['C', 'D']));

      const { selectedNodeIds } = useGraphStore.getState();
      expect(selectedNodeIds.size).toBe(2);
      expect(selectedNodeIds.has('A')).toBe(false);
      expect(selectedNodeIds.has('C')).toBe(true);
      expect(selectedNodeIds.has('D')).toBe(true);
    });
  });

  describe('toggleVisibility', () => {
    it('hides visible nodes', () => {
      const { toggleVisibility } = useGraphStore.getState();

      toggleVisibility(['A', 'B']);

      const { hiddenNodeIds } = useGraphStore.getState();
      expect(hiddenNodeIds.size).toBe(2);
      expect(hiddenNodeIds.has('A')).toBe(true);
      expect(hiddenNodeIds.has('B')).toBe(true);
    });

    it('shows hidden nodes', () => {
      const { hideNodes, toggleVisibility } = useGraphStore.getState();

      hideNodes(['A', 'B']);
      toggleVisibility(['A']);

      const { hiddenNodeIds } = useGraphStore.getState();
      expect(hiddenNodeIds.size).toBe(1);
      expect(hiddenNodeIds.has('A')).toBe(false);
      expect(hiddenNodeIds.has('B')).toBe(true);
    });

    it('toggles mixed visibility states', () => {
      const { hideNodes, toggleVisibility } = useGraphStore.getState();

      hideNodes(['A']);
      // A is hidden, B is visible
      toggleVisibility(['A', 'B']);

      const { hiddenNodeIds } = useGraphStore.getState();
      expect(hiddenNodeIds.has('A')).toBe(false); // Was hidden, now visible
      expect(hiddenNodeIds.has('B')).toBe(true); // Was visible, now hidden
    });

    it('clears selection when hiding nodes', () => {
      const { setSelectedNodeIds, toggleVisibility } = useGraphStore.getState();

      setSelectedNodeIds(new Set(['A', 'B', 'C']));
      toggleVisibility(['A', 'B']); // Hide A and B

      const { selectedNodeIds } = useGraphStore.getState();
      expect(selectedNodeIds.size).toBe(1);
      expect(selectedNodeIds.has('C')).toBe(true);
      expect(selectedNodeIds.has('A')).toBe(false);
      expect(selectedNodeIds.has('B')).toBe(false);
    });
  });

  describe('focusOnNodes', () => {
    beforeEach(() => {
      // Set up a graph: A -> B -> C, A -> D
      const { setNodes, setEdges } = useGraphStore.getState();
      setNodes([
        createMockNode('A'),
        createMockNode('B'),
        createMockNode('C'),
        createMockNode('D'),
        createMockNode('E'), // Isolated node
      ]);
      setEdges([
        createMockEdge('A', 'B'),
        createMockEdge('B', 'C'),
        createMockEdge('A', 'D'),
      ]);
    });

    it('keeps focus nodes and their neighbors visible', () => {
      const { focusOnNodes } = useGraphStore.getState();

      focusOnNodes(['A']);

      const { hiddenNodeIds } = useGraphStore.getState();
      // A is focused, B and D are neighbors
      expect(hiddenNodeIds.has('A')).toBe(false);
      expect(hiddenNodeIds.has('B')).toBe(false);
      expect(hiddenNodeIds.has('D')).toBe(false);
      // C and E are not neighbors of A
      expect(hiddenNodeIds.has('C')).toBe(true);
      expect(hiddenNodeIds.has('E')).toBe(true);
    });

    it('handles multiple focus nodes', () => {
      const { focusOnNodes } = useGraphStore.getState();

      focusOnNodes(['A', 'C']);

      const { hiddenNodeIds } = useGraphStore.getState();
      // A's neighbors: B, D; C's neighbors: B
      expect(hiddenNodeIds.has('A')).toBe(false);
      expect(hiddenNodeIds.has('B')).toBe(false);
      expect(hiddenNodeIds.has('C')).toBe(false);
      expect(hiddenNodeIds.has('D')).toBe(false);
      // E is isolated, not a neighbor of A or C
      expect(hiddenNodeIds.has('E')).toBe(true);
    });

    it('clears selection for hidden nodes', () => {
      const { setSelectedNodeIds, focusOnNodes } = useGraphStore.getState();

      setSelectedNodeIds(new Set(['A', 'C', 'E']));
      focusOnNodes(['A']);

      const { selectedNodeIds } = useGraphStore.getState();
      expect(selectedNodeIds.has('A')).toBe(true);
      expect(selectedNodeIds.has('C')).toBe(false); // C got hidden
      expect(selectedNodeIds.has('E')).toBe(false); // E got hidden
    });

    it('handles empty focus array', () => {
      const { focusOnNodes } = useGraphStore.getState();

      focusOnNodes([]);

      const { hiddenNodeIds } = useGraphStore.getState();
      // All nodes should be hidden since nothing is in focus
      expect(hiddenNodeIds.size).toBe(5);
    });
  });

  describe('selectAll', () => {
    beforeEach(() => {
      const { setNodes } = useGraphStore.getState();
      setNodes([
        createMockNode('A'),
        createMockNode('B'),
        createMockNode('C'),
      ]);
    });

    it('selects all visible nodes', () => {
      const { selectAll } = useGraphStore.getState();

      selectAll();

      const { selectedNodeIds } = useGraphStore.getState();
      expect(selectedNodeIds.size).toBe(3);
      expect(selectedNodeIds.has('A')).toBe(true);
      expect(selectedNodeIds.has('B')).toBe(true);
      expect(selectedNodeIds.has('C')).toBe(true);
    });

    it('excludes hidden nodes from selection', () => {
      const { hideNodes, selectAll } = useGraphStore.getState();

      hideNodes(['A']);
      selectAll();

      const { selectedNodeIds } = useGraphStore.getState();
      expect(selectedNodeIds.size).toBe(2);
      expect(selectedNodeIds.has('A')).toBe(false);
      expect(selectedNodeIds.has('B')).toBe(true);
      expect(selectedNodeIds.has('C')).toBe(true);
    });
  });

  describe('selectConnected', () => {
    beforeEach(() => {
      // Set up graph: A -> B -> C -> D, E (isolated)
      const { setNodes, setEdges } = useGraphStore.getState();
      setNodes([
        createMockNode('A'),
        createMockNode('B'),
        createMockNode('C'),
        createMockNode('D'),
        createMockNode('E'),
      ]);
      setEdges([
        createMockEdge('A', 'B'),
        createMockEdge('B', 'C'),
        createMockEdge('C', 'D'),
      ]);
    });

    it('expands selection to all connected nodes', () => {
      const { selectConnected } = useGraphStore.getState();

      selectConnected(['A']);

      const { selectedNodeIds } = useGraphStore.getState();
      expect(selectedNodeIds.size).toBe(4);
      expect(selectedNodeIds.has('A')).toBe(true);
      expect(selectedNodeIds.has('B')).toBe(true);
      expect(selectedNodeIds.has('C')).toBe(true);
      expect(selectedNodeIds.has('D')).toBe(true);
      expect(selectedNodeIds.has('E')).toBe(false); // Isolated
    });

    it('works bidirectionally', () => {
      const { selectConnected } = useGraphStore.getState();

      selectConnected(['D']);

      const { selectedNodeIds } = useGraphStore.getState();
      // Should select all connected nodes regardless of edge direction
      expect(selectedNodeIds.size).toBe(4);
      expect(selectedNodeIds.has('A')).toBe(true);
    });

    it('does not select hidden nodes', () => {
      const { hideNodes, selectConnected } = useGraphStore.getState();

      hideNodes(['C']);
      selectConnected(['A']);

      const { selectedNodeIds } = useGraphStore.getState();
      // Should stop at B since C is hidden
      expect(selectedNodeIds.has('A')).toBe(true);
      expect(selectedNodeIds.has('B')).toBe(true);
      expect(selectedNodeIds.has('C')).toBe(false);
      expect(selectedNodeIds.has('D')).toBe(false); // Can't reach D through hidden C
    });

    it('handles multiple starting nodes', () => {
      const { selectConnected } = useGraphStore.getState();

      // Add separate subgraph: E -> F
      const { nodes } = useGraphStore.getState();
      useGraphStore.setState({
        nodes: [...nodes, createMockNode('F')],
      });
      const { edges } = useGraphStore.getState();
      useGraphStore.setState({
        edges: [...edges, createMockEdge('E', 'F')],
      });

      selectConnected(['A', 'E']);

      const { selectedNodeIds } = useGraphStore.getState();
      // Should select both subgraphs
      expect(selectedNodeIds.has('A')).toBe(true);
      expect(selectedNodeIds.has('D')).toBe(true);
      expect(selectedNodeIds.has('E')).toBe(true);
      expect(selectedNodeIds.has('F')).toBe(true);
    });
  });

  describe('saveBaseLayout / restoreBaseLayout', () => {
    it('saves current positions to baseLayout', () => {
      const { setLayout, saveBaseLayout } = useGraphStore.getState();

      setLayout({
        positions: {
          A: { x: 100, y: 200 },
          B: { x: 300, y: 400 },
        },
      });
      saveBaseLayout();

      const { baseLayout } = useGraphStore.getState();
      expect(baseLayout.A).toEqual({ x: 100, y: 200 });
      expect(baseLayout.B).toEqual({ x: 300, y: 400 });
    });

    it('restores positions from baseLayout', () => {
      const { setLayout, saveBaseLayout, restoreBaseLayout } = useGraphStore.getState();

      // Save initial positions
      setLayout({
        positions: {
          A: { x: 100, y: 200 },
          B: { x: 300, y: 400 },
        },
      });
      saveBaseLayout();

      // Change positions
      setLayout({
        positions: {
          A: { x: 500, y: 600 },
          B: { x: 700, y: 800 },
        },
      });

      // Restore
      restoreBaseLayout();

      const { layout } = useGraphStore.getState();
      expect(layout.positions.A).toEqual({ x: 100, y: 200 });
      expect(layout.positions.B).toEqual({ x: 300, y: 400 });
    });

    it('unhides all nodes when restoring base layout', () => {
      const { hideNodes, saveBaseLayout, restoreBaseLayout } = useGraphStore.getState();

      saveBaseLayout();
      hideNodes(['A', 'B']);

      expect(useGraphStore.getState().hiddenNodeIds.size).toBe(2);

      restoreBaseLayout();

      expect(useGraphStore.getState().hiddenNodeIds.size).toBe(0);
    });
  });

  describe('setAutoLayout', () => {
    it('enables auto-layout', () => {
      const { setAutoLayout } = useGraphStore.getState();

      setAutoLayout(true);

      expect(useGraphStore.getState().isAutoLayoutEnabled).toBe(true);
    });

    it('disables auto-layout', () => {
      const { setAutoLayout } = useGraphStore.getState();

      setAutoLayout(false);

      expect(useGraphStore.getState().isAutoLayoutEnabled).toBe(false);
    });
  });

  describe('relayoutVisibleNodes', () => {
    beforeEach(() => {
      // Set up a simple graph: A -> B -> C, D (isolated), E (will be hidden)
      const { setNodes, setEdges } = useGraphStore.getState();
      setNodes([
        { ...createMockNode('A'), position: { x: 0, y: 0 } },
        { ...createMockNode('B'), position: { x: 0, y: 0 } },
        { ...createMockNode('C'), position: { x: 0, y: 0 } },
        { ...createMockNode('D'), position: { x: 500, y: 500 } },
        { ...createMockNode('E'), position: { x: 1000, y: 1000 } },
      ]);
      setEdges([
        createMockEdge('A', 'B'),
        createMockEdge('B', 'C'),
      ]);
    });

    it('repositions visible nodes using Dagre layout', () => {
      const { relayoutVisibleNodes } = useGraphStore.getState();

      relayoutVisibleNodes();

      const { nodes } = useGraphStore.getState();
      // All nodes should have new positions (not all at 0,0)
      const positions = nodes.map(n => n.position);
      const allAtOrigin = positions.every(p => p.x === 0 && p.y === 0);
      expect(allAtOrigin).toBe(false);
    });

    it('does not move hidden nodes', () => {
      const { hideNodes, relayoutVisibleNodes } = useGraphStore.getState();

      // Hide E and remember its position
      hideNodes(['E']);
      const originalEPosition = { x: 1000, y: 1000 };

      relayoutVisibleNodes();

      const { nodes } = useGraphStore.getState();
      const nodeE = nodes.find(n => n.id === 'E');
      expect(nodeE?.position).toEqual(originalEPosition);
    });

    it('updates layout.positions for visible nodes', () => {
      const { relayoutVisibleNodes } = useGraphStore.getState();

      relayoutVisibleNodes();

      const { layout } = useGraphStore.getState();
      // Should have positions for all visible nodes
      expect(layout.positions.A).toBeDefined();
      expect(layout.positions.B).toBeDefined();
      expect(layout.positions.C).toBeDefined();
      expect(layout.positions.D).toBeDefined();
      expect(layout.positions.E).toBeDefined();
    });

    it('only uses visible edges for layout calculation', () => {
      const { hideNodes, relayoutVisibleNodes } = useGraphStore.getState();

      // Hide B, which breaks the A->B->C chain
      hideNodes(['B']);

      relayoutVisibleNodes();

      const { nodes } = useGraphStore.getState();
      const nodeA = nodes.find(n => n.id === 'A');
      const nodeC = nodes.find(n => n.id === 'C');

      // A and C should be laid out independently since B is hidden
      // They should both get positions (not throw an error)
      expect(nodeA?.position).toBeDefined();
      expect(nodeC?.position).toBeDefined();
    });
  });

  describe('reset', () => {
    it('resets all new fields', () => {
      const { setNodes, setEdges, hideNodes, setSelectedNodeIds, setLayout, saveBaseLayout, setAutoLayout, reset } =
        useGraphStore.getState();

      // Set up state
      setNodes([createMockNode('A')]);
      setEdges([createMockEdge('A', 'B')]);
      hideNodes(['A']);
      setSelectedNodeIds(new Set(['A']));
      setLayout({ positions: { A: { x: 100, y: 100 } } });
      saveBaseLayout();
      setAutoLayout(false);

      // Reset
      reset();

      const state = useGraphStore.getState();
      expect(state.nodes).toHaveLength(0);
      expect(state.edges).toHaveLength(0);
      expect(state.hiddenNodeIds.size).toBe(0);
      expect(state.selectedNodeIds.size).toBe(0);
      expect(state.baseLayout).toEqual({});
      expect(state.isAutoLayoutEnabled).toBe(true);
    });
  });
});
