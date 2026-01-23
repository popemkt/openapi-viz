import type { EdgeType } from '@/types';

export const SCHEMA_COLORS = {
  bg: 'bg-slate-100',
  text: 'text-slate-700',
  border: 'border-slate-300',
};

export const EDGE_COLORS: Record<EdgeType, string> = {
  // Endpoint -> Schema edges
  'request-body': '#22c55e',   // green
  response: '#3b82f6',         // blue
  parameter: '#8b5cf6',        // violet

  // Schema -> Schema composition edges
  allOf: '#f59e0b',            // amber - solid composition (all required)
  oneOf: '#06b6d4',            // cyan - exclusive choice
  anyOf: '#10b981',            // emerald - flexible choice
  not: '#dc2626',              // red - negation

  // Schema -> Schema structural edges
  property: '#64748b',         // slate - property reference
  'additional-props': '#84cc16', // lime - additionalProperties
  'array-items': '#a855f7',    // purple - array relationship
  'tuple-item': '#ec4899',     // pink - tuple position

  // Schema -> Schema polymorphism edges
  discriminator: '#f97316',    // orange - discriminator mapping

  // Legacy type for backward compatibility
  'schema-ref': '#64748b',     // slate - generic reference (deprecated)

  // Special type
  circular: '#ef4444',         // red - circular reference
};

export const EDGE_LABELS: Record<EdgeType, string> = {
  // Endpoint -> Schema edges
  'request-body': 'request body',
  response: 'returns',
  parameter: 'parameter',

  // Schema -> Schema composition edges
  allOf: 'extends',
  oneOf: 'one of',
  anyOf: 'any of',
  not: 'not',

  // Schema -> Schema structural edges
  property: 'property',
  'additional-props': 'additionalProperties',
  'array-items': 'items',
  'tuple-item': 'tuple item',

  // Schema -> Schema polymorphism edges
  discriminator: 'discriminator',

  // Legacy type for backward compatibility
  'schema-ref': 'references',

  // Special type
  circular: 'circular ref',
};
