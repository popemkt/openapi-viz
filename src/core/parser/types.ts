/**
 * Options for schema extraction to provide context about where the schema is defined.
 */
export interface SchemaExtractionOptions {
  /** Whether this schema is defined inline (vs in components/schemas) */
  isInline: boolean;
  /** Parent context for generating descriptive names (e.g., "Order" for "Order.address") */
  parentContext?: string;
}
