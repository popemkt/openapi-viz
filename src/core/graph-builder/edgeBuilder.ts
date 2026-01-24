/**
 * Edge Builder Module
 *
 * This module handles converting relationships to graph edges with
 * semantic labels and styling.
 */

import type { GraphEdge, GraphEdgeData, EdgeType, Schema } from '@/types';
import type { Relationship, RelationshipType } from '@/types/relationships';
import {
  RELATIONSHIP_TO_EDGE_TYPE,
  relationshipContextToEdgeContext,
  createSemanticEdgeLabel,
  getEdgeConfig,
} from '@/constants/edgeTypes';

/**
 * Converts a relationship type to an edge type.
 * Handles the circular override case.
 */
export function getEdgeTypeForRelationship(
  relType: RelationshipType,
  isCircular: boolean
): EdgeType {
  if (isCircular) {
    return 'circular';
  }
  return RELATIONSHIP_TO_EDGE_TYPE[relType];
}

/**
 * Converts relationships to graph edges with semantic labels and styling.
 */
export function relationshipsToEdges(
  relationships: Relationship[],
  circularIds: Set<string>,
  schemaMap: Map<string, Schema>,
  endpointIds: Set<string>
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seenEdges = new Set<string>();

  for (const rel of relationships) {
    const isCircular = circularIds.has(rel.id);
    const edgeType = getEdgeTypeForRelationship(rel.type, isCircular);

    // Determine source and target node IDs
    let sourceId: string;
    let targetId: string;

    if (rel.source.componentType === 'endpoint') {
      sourceId = rel.source.name;
      // Verify endpoint exists
      if (!endpointIds.has(sourceId)) continue;
    } else {
      sourceId = `schema-${rel.source.name}`;
      // Verify schema exists
      if (!schemaMap.has(rel.source.name)) continue;
    }

    if (rel.target.componentType === 'endpoint') {
      targetId = rel.target.name;
      if (!endpointIds.has(targetId)) continue;
    } else {
      targetId = `schema-${rel.target.name}`;
      // Verify schema exists
      if (!schemaMap.has(rel.target.name)) continue;
    }

    // Create unique edge ID to avoid duplicates
    const edgeKey = `${sourceId}-${targetId}-${edgeType}-${JSON.stringify(rel.context)}`;
    if (seenEdges.has(edgeKey)) continue;
    seenEdges.add(edgeKey);

    // Convert relationship context to edge semantic context
    const semanticContext = relationshipContextToEdgeContext(rel.context);

    // Generate labels
    const conciseLabel = createSemanticEdgeLabel(edgeType, semanticContext, false);
    const verboseLabel = createSemanticEdgeLabel(edgeType, semanticContext, true);

    // Get edge styling configuration
    const config = getEdgeConfig(edgeType);

    const edgeData: GraphEdgeData = {
      edgeType,
      label: conciseLabel,
      conciseLabel,
      verboseLabel,
      semanticContext,
    };

    const edge: GraphEdge = {
      id: `${sourceId}-${targetId}-${edgeType}-${rel.id}`,
      source: sourceId,
      target: targetId,
      data: edgeData,
      style: {
        stroke: config.color,
        strokeWidth: config.strokeWidth,
        strokeDasharray: config.dashed ? '5,5' : undefined,
      },
      label: conciseLabel,
      labelStyle: { fontSize: 10, fill: config.color },
      labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
      animated: config.animated || isCircular,
      markerEnd: { type: config.markerEnd === 'arrowclosed' ? 'arrowclosed' : 'arrow' },
    };

    edges.push(edge);
  }

  return edges;
}
