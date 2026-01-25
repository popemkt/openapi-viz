/**
 * ELK Layout Module
 *
 * Provides an alternative layout algorithm using ELK (Eclipse Layout Kernel).
 * ELK offers better handling of complex graphs with many cross-edges and
 * circular references compared to Dagre.
 */

import ELK from 'elkjs/lib/elk.bundled.js';
import type { GraphNode, GraphEdge } from '@/types';

export interface ElkLayoutOptions {
  direction: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
  nodeWidth: number;
  nodeHeight: number;
  nodeSpacing: number;
  layerSpacing: number;
}

export const DEFAULT_ELK_LAYOUT_OPTIONS: ElkLayoutOptions = {
  direction: 'RIGHT',
  nodeWidth: 200,
  nodeHeight: 120,
  nodeSpacing: 50,
  layerSpacing: 100,
};

// Map from our direction types to ELK direction values
const DIRECTION_MAP: Record<ElkLayoutOptions['direction'], string> = {
  RIGHT: 'RIGHT',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  UP: 'UP',
};

// Map from UI LayoutDirection to ELK direction
export const UI_TO_ELK_DIRECTION: Record<string, ElkLayoutOptions['direction']> = {
  LR: 'RIGHT',
  TB: 'DOWN',
  RL: 'LEFT',
  BT: 'UP',
};

/**
 * Applies ELK layout algorithm to position nodes.
 * ELK is async (WebAssembly-based) and generally produces better layouts
 * for complex graphs with many edges.
 */
export async function applyElkLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: Partial<ElkLayoutOptions> = {}
): Promise<GraphNode[]> {
  const opts = { ...DEFAULT_ELK_LAYOUT_OPTIONS, ...options };
  const elk = new ELK();

  // Convert nodes to ELK format
  const elkNodes = nodes.map((node) => ({
    id: node.id,
    width: opts.nodeWidth,
    height: opts.nodeHeight,
  }));

  // Convert edges to ELK format
  const elkEdges = edges.map((edge, index) => ({
    id: `e${index}`,
    sources: [edge.source],
    targets: [edge.target],
  }));

  // Build ELK graph
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': DIRECTION_MAP[opts.direction],
      'elk.spacing.nodeNode': String(opts.nodeSpacing),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.layerSpacing),
      // Additional options for better layouts
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children: elkNodes,
    edges: elkEdges,
  };

  // Run ELK layout
  const layoutedGraph = await elk.layout(elkGraph);

  // Apply positions back to nodes
  const positionMap = new Map<string, { x: number; y: number }>();
  for (const child of layoutedGraph.children || []) {
    if (child.x !== undefined && child.y !== undefined) {
      positionMap.set(child.id, { x: child.x, y: child.y });
    }
  }

  return nodes.map((node) => {
    const pos = positionMap.get(node.id);
    return {
      ...node,
      position: pos || node.position,
    };
  });
}
