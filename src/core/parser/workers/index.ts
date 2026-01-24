/**
 * Parser Web Worker exports.
 */

export { ParserWorkerClient, parseWithWorker } from './parserWorkerClient';

export type {
  ParseRequest,
  ParseResponse,
  ParseSuccessResponse,
  ParseErrorResponse,
  SerializableSourceMap,
  SerializableComponentRegistry,
  SerializableParsedSpec,
  SerializableParseResult,
} from './types';

export {
  serializeSourceMap,
  deserializeSourceMap,
  serializeComponentRegistry,
  deserializeComponentRegistry,
  serializeParsedSpec,
  deserializeParsedSpec,
} from './types';
