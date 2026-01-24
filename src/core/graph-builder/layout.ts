/**
 * Layout Module
 *
 * Handles graph layout using the Dagre algorithm.
 * Responsible for positioning nodes in the visualization.
 */

import dagre from 'dagre';
import type { GraphNode, GraphEdge } from '@/types';

export interface LayoutOptions {
  direction: 'LR' | 'TB';
  nodeWidth: number;
  nodeHeight: number;
  rankSpacing: number;
  nodeSpacing: number;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  direction: 'LR',
  nodeWidth: 200,
  nodeHeight: 120,
  rankSpacing: 100,
  nodeSpacing: 50,
};

/**
 * Applies Dagre layout algorithm to position nodes.
 */
export function applyDagreLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: Partial<LayoutOptions> = {}
): GraphNode[] {
  const opts = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  const dagreGraph = new dagre.graphlib.Graph();

  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: opts.direction,
    ranksep: opts.rankSpacing,
    nodesep: opts.nodeSpacing,
  });

  // Add nodes to Dagre graph
  for (const node of nodes) {
    dagreGraph.setNode(node.id, {
      width: opts.nodeWidth,
      height: opts.nodeHeight,
    });
  }

  // Add edges to Dagre graph
  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target);
  }

  // Run layout algorithm
  dagre.layout(dagreGraph);

  // Apply positions back to nodes
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - opts.nodeWidth / 2,
        y: nodeWithPosition.y - opts.nodeHeight / 2,
      },
    };
  });
}
