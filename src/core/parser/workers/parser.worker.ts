/**
 * Parser Web Worker
 *
 * Performs OpenAPI spec parsing off the main thread to prevent UI blocking
 * for large specifications. Uses the structured clone algorithm for
 * message passing, requiring serializable data types.
 */

import { parseSpec } from '../parseSpec';
import type { ParseRequest, ParseResponse } from './types';
import { serializeSourceMap, serializeParsedSpec } from './types';

/**
 * Handle incoming parse requests.
 */
self.onmessage = async (event: MessageEvent<ParseRequest>) => {
  const request = event.data;

  if (request.type !== 'parse') {
    return;
  }

  try {
    const result = await parseSpec(request.text);

    const response: ParseResponse = {
      type: 'success',
      id: request.id,
      result: {
        spec: result.spec ? serializeParsedSpec(result.spec) : null,
        errors: result.errors,
        sourceMap: serializeSourceMap(result.sourceMap),
      },
    };

    self.postMessage(response);
  } catch (error) {
    const response: ParseResponse = {
      type: 'error',
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    };

    self.postMessage(response);
  }
};
