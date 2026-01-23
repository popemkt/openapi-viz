/**
 * Edge type configuration and semantic label generation.
 *
 * This module provides:
 * - Edge type metadata (styling, animation, visual properties)
 * - Semantic label generators for human-readable edge labels
 * - Mapping between relationship types and edge types
 */

import type { EdgeType, EdgeSemanticContext } from '@/types/graph';
import type { RelationshipType, RelationshipContext } from '@/types/relationships';
import { EDGE_COLORS } from './colors';

/**
 * Configuration for an edge type's visual appearance.
 */
export interface EdgeTypeConfig {
  /**
   * The edge color (hex code).
   */
  color: string;

  /**
   * Whether the edge should be dashed.
   */
  dashed: boolean;

  /**
   * Whether the edge should be animated (e.g., for circular references).
   */
  animated: boolean;

  /**
   * Default label template for concise mode.
   * Use {property}, {statusCode}, {parameterName}, etc. as placeholders.
   */
  conciseLabelTemplate: string;

  /**
   * Default label template for verbose mode.
   * Use {property}, {statusCode}, {parameterName}, etc. as placeholders.
   */
  verboseLabelTemplate: string;

  /**
   * Arrow marker configuration.
   */
  markerEnd: 'arrow' | 'arrowclosed' | 'none';

  /**
   * Edge stroke width.
   */
  strokeWidth: number;

  /**
   * Optional description for UI/tooltips.
   */
  description: string;
}

/**
 * Complete configuration for all edge types.
 */
export const EDGE_TYPE_CONFIG: Record<EdgeType, EdgeTypeConfig> = {
  // ========================================
  // Endpoint -> Schema edges
  // ========================================
  'request-body': {
    color: EDGE_COLORS['request-body'],
    dashed: false,
    animated: false,
    conciseLabelTemplate: 'body',
    verboseLabelTemplate: 'request body ({mediaType})',
    markerEnd: 'arrowclosed',
    strokeWidth: 2,
    description: 'Request body uses this schema',
  },

  response: {
    color: EDGE_COLORS.response,
    dashed: false,
    animated: false,
    conciseLabelTemplate: '{statusCode}',
    verboseLabelTemplate: '{statusCode} response ({mediaType})',
    markerEnd: 'arrowclosed',
    strokeWidth: 2,
    description: 'Response returns this schema',
  },

  parameter: {
    color: EDGE_COLORS.parameter,
    dashed: true,
    animated: false,
    conciseLabelTemplate: '{parameterName}',
    verboseLabelTemplate: '{parameterLocation} param: {parameterName}',
    markerEnd: 'arrowclosed',
    strokeWidth: 1.5,
    description: 'Parameter uses this schema',
  },

  // ========================================
  // Schema -> Schema composition edges
  // ========================================
  allOf: {
    color: EDGE_COLORS.allOf,
    dashed: false,
    animated: false,
    conciseLabelTemplate: 'extends',
    verboseLabelTemplate: 'allOf (inherits from)',
    markerEnd: 'arrowclosed',
    strokeWidth: 2,
    description: 'Schema extends another via allOf composition',
  },

  oneOf: {
    color: EDGE_COLORS.oneOf,
    dashed: true,
    animated: false,
    conciseLabelTemplate: 'oneOf',
    verboseLabelTemplate: 'oneOf (exclusive choice)',
    markerEnd: 'arrowclosed',
    strokeWidth: 2,
    description: 'Schema is one of these exclusive alternatives',
  },

  anyOf: {
    color: EDGE_COLORS.anyOf,
    dashed: true,
    animated: false,
    conciseLabelTemplate: 'anyOf',
    verboseLabelTemplate: 'anyOf (flexible choice)',
    markerEnd: 'arrowclosed',
    strokeWidth: 2,
    description: 'Schema is any of these alternatives',
  },

  not: {
    color: EDGE_COLORS.not,
    dashed: true,
    animated: false,
    conciseLabelTemplate: 'not',
    verboseLabelTemplate: 'not (must not match)',
    markerEnd: 'arrowclosed',
    strokeWidth: 1.5,
    description: 'Schema must not match this schema',
  },

  // ========================================
  // Schema -> Schema structural edges
  // ========================================
  property: {
    color: EDGE_COLORS.property,
    dashed: false,
    animated: false,
    conciseLabelTemplate: '.{propertyName}',
    verboseLabelTemplate: 'property: {propertyName}{requiredSuffix}',
    markerEnd: 'arrowclosed',
    strokeWidth: 1.5,
    description: 'Property references this schema',
  },

  'additional-props': {
    color: EDGE_COLORS['additional-props'],
    dashed: true,
    animated: false,
    conciseLabelTemplate: '[*]',
    verboseLabelTemplate: 'additionalProperties (Map<string, T>)',
    markerEnd: 'arrowclosed',
    strokeWidth: 1.5,
    description: 'Additional properties use this schema',
  },

  'array-items': {
    color: EDGE_COLORS['array-items'],
    dashed: false,
    animated: false,
    conciseLabelTemplate: '[]',
    verboseLabelTemplate: 'items (array of)',
    markerEnd: 'arrowclosed',
    strokeWidth: 2,
    description: 'Array items are of this schema type',
  },

  'tuple-item': {
    color: EDGE_COLORS['tuple-item'],
    dashed: false,
    animated: false,
    conciseLabelTemplate: '[{tupleIndex}]',
    verboseLabelTemplate: 'tuple item at index {tupleIndex}',
    markerEnd: 'arrowclosed',
    strokeWidth: 1.5,
    description: 'Tuple item at specific position',
  },

  // ========================================
  // Schema -> Schema polymorphism edges
  // ========================================
  discriminator: {
    color: EDGE_COLORS.discriminator,
    dashed: false,
    animated: false,
    conciseLabelTemplate: '={discriminatorValue}',
    verboseLabelTemplate: 'discriminator: {discriminatorValue}',
    markerEnd: 'arrowclosed',
    strokeWidth: 2,
    description: 'Discriminator maps this value to the target schema',
  },

  // ========================================
  // Legacy and special types
  // ========================================
  'schema-ref': {
    color: EDGE_COLORS['schema-ref'],
    dashed: false,
    animated: false,
    conciseLabelTemplate: 'ref',
    verboseLabelTemplate: 'references',
    markerEnd: 'arrowclosed',
    strokeWidth: 1.5,
    description: 'Generic schema reference (deprecated)',
  },

  circular: {
    color: EDGE_COLORS.circular,
    dashed: true,
    animated: true,
    conciseLabelTemplate: '↻',
    verboseLabelTemplate: 'circular reference',
    markerEnd: 'arrowclosed',
    strokeWidth: 2,
    description: 'Circular reference in the schema graph',
  },
};

/**
 * Maps relationship types from the parser to edge types for visualization.
 */
export const RELATIONSHIP_TO_EDGE_TYPE: Record<RelationshipType, EdgeType> = {
  // Endpoint -> Schema
  'endpoint-request-body': 'request-body',
  'endpoint-response': 'response',
  'endpoint-parameter': 'parameter',

  // Schema -> Schema composition
  'schema-allOf': 'allOf',
  'schema-oneOf': 'oneOf',
  'schema-anyOf': 'anyOf',
  'schema-not': 'not',

  // Schema -> Schema structural
  'schema-property': 'property',
  'schema-additional-props': 'additional-props',
  'schema-array-items': 'array-items',
  'schema-tuple-item': 'tuple-item',

  // Schema -> Schema polymorphism
  'schema-discriminator': 'discriminator',
};

/**
 * Converts RelationshipContext to EdgeSemanticContext.
 */
export function relationshipContextToEdgeContext(
  context: RelationshipContext
): EdgeSemanticContext {
  return {
    propertyName: context.propertyName,
    statusCode: context.statusCode,
    mediaType: context.mediaType,
    parameterName: context.parameterName,
    parameterLocation: context.parameterLocation,
    discriminatorValue: context.discriminatorValue,
    tupleIndex: context.tupleIndex,
    isArray: context.isArray,
    required: context.required,
  };
}

/**
 * Generates a semantic label for an edge based on its type and context.
 * Returns both concise and verbose versions.
 */
export function generateSemanticLabels(
  edgeType: EdgeType,
  context: EdgeSemanticContext = {}
): { concise: string; verbose: string } {
  const config = EDGE_TYPE_CONFIG[edgeType];

  const replacePlaceholders = (template: string): string => {
    let result = template;

    // Replace known placeholders
    result = result.replace('{propertyName}', context.propertyName ?? '?');
    result = result.replace('{statusCode}', context.statusCode ?? '???');
    result = result.replace('{mediaType}', context.mediaType ?? 'application/json');
    result = result.replace('{parameterName}', context.parameterName ?? '?');
    result = result.replace('{parameterLocation}', context.parameterLocation ?? 'query');
    result = result.replace('{discriminatorValue}', context.discriminatorValue ?? '?');
    result = result.replace(
      '{tupleIndex}',
      context.tupleIndex !== undefined ? String(context.tupleIndex) : '?'
    );
    result = result.replace('{requiredSuffix}', context.required ? ' (required)' : '');

    return result;
  };

  return {
    concise: replacePlaceholders(config.conciseLabelTemplate),
    verbose: replacePlaceholders(config.verboseLabelTemplate),
  };
}

/**
 * Creates a human-readable label for display in the graph.
 * Supports both concise and verbose modes.
 */
export function createSemanticEdgeLabel(
  edgeType: EdgeType,
  context: EdgeSemanticContext = {},
  verbose = false
): string {
  const labels = generateSemanticLabels(edgeType, context);
  return verbose ? labels.verbose : labels.concise;
}

/**
 * Gets the edge configuration for a given edge type.
 */
export function getEdgeConfig(edgeType: EdgeType): EdgeTypeConfig {
  return EDGE_TYPE_CONFIG[edgeType];
}

/**
 * Converts a relationship type to an edge type.
 */
export function relationshipTypeToEdgeType(relType: RelationshipType): EdgeType {
  return RELATIONSHIP_TO_EDGE_TYPE[relType];
}

/**
 * Determines if an edge type represents a composition relationship.
 */
export function isCompositionEdge(edgeType: EdgeType): boolean {
  return edgeType === 'allOf' || edgeType === 'oneOf' || edgeType === 'anyOf';
}

/**
 * Determines if an edge type represents a structural relationship.
 */
export function isStructuralEdge(edgeType: EdgeType): boolean {
  return (
    edgeType === 'property' ||
    edgeType === 'additional-props' ||
    edgeType === 'array-items' ||
    edgeType === 'tuple-item'
  );
}

/**
 * Determines if an edge type represents an endpoint relationship.
 */
export function isEndpointEdge(edgeType: EdgeType): boolean {
  return edgeType === 'request-body' || edgeType === 'response' || edgeType === 'parameter';
}

/**
 * Edge categories for filtering in UI.
 */
export const EDGE_CATEGORIES = {
  endpoint: ['request-body', 'response', 'parameter'] as EdgeType[],
  composition: ['allOf', 'oneOf', 'anyOf', 'not'] as EdgeType[],
  structural: ['property', 'additional-props', 'array-items', 'tuple-item'] as EdgeType[],
  polymorphism: ['discriminator'] as EdgeType[],
  special: ['circular', 'schema-ref'] as EdgeType[],
};

/**
 * Human-readable names for edge categories.
 */
export const EDGE_CATEGORY_LABELS: Record<keyof typeof EDGE_CATEGORIES, string> = {
  endpoint: 'Endpoint References',
  composition: 'Composition (allOf/oneOf/anyOf)',
  structural: 'Structural (properties, items)',
  polymorphism: 'Polymorphism (discriminator)',
  special: 'Special',
};
