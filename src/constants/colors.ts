export const SCHEMA_COLORS = {
  bg: 'bg-slate-100',
  text: 'text-slate-700',
  border: 'border-slate-300',
};

export const EDGE_COLORS = {
  'request-body': '#22c55e',
  response: '#3b82f6',
  parameter: '#8b5cf6',
  'schema-ref': '#64748b',
  circular: '#ef4444',
  allOf: '#f59e0b', // amber - solid composition (all required)
  oneOf: '#06b6d4', // cyan - exclusive choice
  anyOf: '#10b981', // emerald - flexible choice
  'array-items': '#a855f7', // purple - array relationship
};

export const EDGE_LABELS = {
  'request-body': 'request body',
  response: 'returns',
  parameter: 'parameter',
  'schema-ref': 'references',
  circular: 'circular ref',
  allOf: 'extends',
  oneOf: 'one of',
  anyOf: 'any of',
  'array-items': 'items',
};
