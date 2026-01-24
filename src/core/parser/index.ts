// Main parsing function and result type
export { parseSpec, type ParseResult } from './parseSpec';

// Schema extraction options type
export { type SchemaExtractionOptions } from './types';

// Line mapping utilities (useful for source location features)
export {
  COMPONENT_SECTIONS,
  type ComponentSection,
  createSourceLocation,
  buildLineMap,
  buildSourceMap,
} from './lineMapper';

// Extractors (useful for advanced customization)
export {
  // Schema extraction
  generateSchemaId,
  extractSchemaType,
  extractRefName,
  extractDiscriminator,
  extractSchema,
  // Endpoint extraction
  HTTP_METHODS,
  extractEndpoints,
  // Component extraction
  extractComponents,
  extractSchemas,
  extractTags,
} from './extractors';

// Relationship collection (useful for graph building)
export {
  createSchemaRef,
  createEndpointRef,
  collectRelationships,
  collectSchemaRelationships,
  collectEndpointRelationships,
} from './relationshipCollector';

// Web Worker support (for off-main-thread parsing)
export {
  ParserWorkerClient,
  parseWithWorker,
  type ParseRequest,
  type ParseResponse,
  type SerializableSourceMap,
  type SerializableParsedSpec,
  type SerializableParseResult,
  serializeSourceMap,
  deserializeSourceMap,
  serializeParsedSpec,
  deserializeParsedSpec,
} from './workers';
