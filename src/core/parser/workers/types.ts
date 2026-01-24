/**
 * Types for the parser Web Worker communication protocol.
 *
 * Web Workers use the structured clone algorithm for message passing,
 * which does not support Map objects. This module provides serializable
 * versions of parser types that use plain objects instead of Maps.
 */

import type {
  ParseError,
  SourceLocation,
  ParsedSpec,
  ComponentRegistry,
  Schema,
  ResponseDef,
  ParameterDef,
  RequestBodyDef,
  HeaderDef,
  LinkDef,
  CallbackDef,
} from '@/types';

/**
 * Serializable version of SourceMap using plain objects instead of Maps.
 */
export interface SerializableSourceMap {
  nodeToLocation: Record<string, SourceLocation>;
  lineToNodes: Record<number, string[]>;
}

/**
 * Serializable version of ComponentRegistry using plain objects instead of Maps.
 */
export interface SerializableComponentRegistry {
  schemas: Record<string, Schema>;
  responses: Record<string, ResponseDef>;
  parameters: Record<string, ParameterDef>;
  requestBodies: Record<string, RequestBodyDef>;
  headers: Record<string, HeaderDef>;
  links: Record<string, LinkDef>;
  callbacks: Record<string, CallbackDef>;
}

/**
 * Serializable version of ParsedSpec with plain object component registry.
 */
export interface SerializableParsedSpec extends Omit<ParsedSpec, 'components'> {
  components: SerializableComponentRegistry;
}

/**
 * Serializable parse result for worker communication.
 */
export interface SerializableParseResult {
  spec: SerializableParsedSpec | null;
  errors: ParseError[];
  sourceMap: SerializableSourceMap;
}

/**
 * Request message sent to the parser worker.
 */
export interface ParseRequest {
  type: 'parse';
  id: string;
  text: string;
}

/**
 * Successful response from the parser worker.
 */
export interface ParseSuccessResponse {
  type: 'success';
  id: string;
  result: SerializableParseResult;
}

/**
 * Error response from the parser worker.
 */
export interface ParseErrorResponse {
  type: 'error';
  id: string;
  error: string;
}

/**
 * Union type for all worker responses.
 */
export type ParseResponse = ParseSuccessResponse | ParseErrorResponse;

/**
 * Convert a Map-based SourceMap to a serializable plain object version.
 */
export function serializeSourceMap(
  sourceMap: import('@/types').SourceMap
): SerializableSourceMap {
  const nodeToLocation: Record<string, SourceLocation> = {};
  const lineToNodes: Record<number, string[]> = {};

  for (const [key, value] of sourceMap.nodeToLocation) {
    nodeToLocation[key] = value;
  }

  for (const [key, value] of sourceMap.lineToNodes) {
    lineToNodes[key] = value;
  }

  return { nodeToLocation, lineToNodes };
}

/**
 * Convert a serializable SourceMap back to a Map-based version.
 */
export function deserializeSourceMap(
  serialized: SerializableSourceMap
): import('@/types').SourceMap {
  const nodeToLocation = new Map<string, SourceLocation>();
  const lineToNodes = new Map<number, string[]>();

  for (const [key, value] of Object.entries(serialized.nodeToLocation)) {
    nodeToLocation.set(key, value);
  }

  for (const [key, value] of Object.entries(serialized.lineToNodes)) {
    lineToNodes.set(Number(key), value);
  }

  return { nodeToLocation, lineToNodes };
}

/**
 * Convert a Map-based ComponentRegistry to a serializable plain object version.
 */
export function serializeComponentRegistry(
  registry: ComponentRegistry
): SerializableComponentRegistry {
  return {
    schemas: Object.fromEntries(registry.schemas),
    responses: Object.fromEntries(registry.responses),
    parameters: Object.fromEntries(registry.parameters),
    requestBodies: Object.fromEntries(registry.requestBodies),
    headers: Object.fromEntries(registry.headers),
    links: Object.fromEntries(registry.links),
    callbacks: Object.fromEntries(registry.callbacks),
  };
}

/**
 * Convert a serializable ComponentRegistry back to a Map-based version.
 */
export function deserializeComponentRegistry(
  serialized: SerializableComponentRegistry
): ComponentRegistry {
  return {
    schemas: new Map(Object.entries(serialized.schemas)),
    responses: new Map(Object.entries(serialized.responses)),
    parameters: new Map(Object.entries(serialized.parameters)),
    requestBodies: new Map(Object.entries(serialized.requestBodies)),
    headers: new Map(Object.entries(serialized.headers)),
    links: new Map(Object.entries(serialized.links)),
    callbacks: new Map(Object.entries(serialized.callbacks)),
  };
}

/**
 * Convert a ParsedSpec to a serializable version.
 */
export function serializeParsedSpec(
  spec: ParsedSpec
): SerializableParsedSpec {
  return {
    ...spec,
    components: serializeComponentRegistry(spec.components),
  };
}

/**
 * Convert a serializable ParsedSpec back to the original type.
 */
export function deserializeParsedSpec(
  serialized: SerializableParsedSpec
): ParsedSpec {
  return {
    ...serialized,
    components: deserializeComponentRegistry(serialized.components),
  };
}
