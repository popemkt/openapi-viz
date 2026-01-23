/**
 * Common type definitions
 */

import type { SourceLocation } from './openapi';

/**
 * Parse error definition
 */
export interface ParseError {
  message: string;
  location?: SourceLocation;
  severity: 'error' | 'warning';
}

/**
 * Source map for text ↔ node synchronization
 */
export interface SourceMap {
  nodeToLocation: Map<string, SourceLocation>;
  lineToNodes: Map<number, string[]>;
}
