// Main entry point
export { buildGraph, type GraphBuildResult } from './buildGraph';

// Layout
export {
  applyDagreLayout,
  DEFAULT_LAYOUT_OPTIONS,
  type LayoutOptions,
} from './layout';

// Circular detection
export { detectCircularRelationships } from './circularDetection';

// Edge building
export { getEdgeTypeForRelationship, relationshipsToEdges } from './edgeBuilder';

// Node building
export {
  calculateRefCounts,
  collectDiscriminatorValues,
  getCompositionType,
  createEndpointNode,
  createSchemaNode,
  buildEndpointNodes,
  buildSchemaNodes,
  type RefCounts,
  type SchemaNodeOptions,
  type BuildSchemaNodesOptions,
} from './nodeBuilder';

// Legacy support (backward compatibility)
export {
  extractSchemaRef,
  getDirectSchemaRefs,
  detectCircularEdgesLegacy,
  buildLegacySchemaEdges,
  buildLegacyEndpointEdges,
} from './legacySupport';

// Workers
export {
  GraphWorkerClient,
  buildGraphWithWorker,
  type BuildGraphOptions,
  type GraphBuildResult as WorkerGraphBuildResult,
  type BuildGraphRequest,
  type BuildGraphResponse,
} from './workers';
