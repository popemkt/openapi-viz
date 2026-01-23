import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { SchemaNodeData, SchemaProperty } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { BoxIcon, LayersIcon, SplitIcon, MergeIcon, ListIcon } from 'lucide-react';
import { EDGE_COLORS } from '@/constants/colors';

interface SchemaNodeProps {
  data: SchemaNodeData;
  selected?: boolean;
}

export const SchemaNode = memo(function SchemaNode({ data, selected }: SchemaNodeProps) {
  const { schema } = data;

  const propertyCount = schema.properties ? Object.keys(schema.properties).length : 0;
  const requiredCount = schema.required?.length || 0;

  // Detect composition types
  const hasAllOf = schema.allOf && schema.allOf.length > 0;
  const hasOneOf = schema.oneOf && schema.oneOf.length > 0;
  const hasAnyOf = schema.anyOf && schema.anyOf.length > 0;
  const hasItems = !!schema.items;
  const hasComposition = hasAllOf || hasOneOf || hasAnyOf || hasItems;

  return (
    <div
      className={cn(
        'min-w-[160px] rounded-md border bg-card shadow-sm transition-shadow',
        selected && 'ring-2 ring-primary'
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-500" />

      {/* Header */}
      <div className="flex items-center gap-2 rounded-t-md bg-slate-100 px-3 py-2 dark:bg-slate-800">
        <BoxIcon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300">
          {schema.name}
        </span>
      </div>

      {/* Composition type badges */}
      {hasComposition && (
        <div className="flex flex-wrap gap-1 px-3 pt-2">
          {hasAllOf && (
            <Badge
              className="text-[10px] text-white"
              style={{ backgroundColor: EDGE_COLORS.allOf }}
            >
              <LayersIcon className="mr-1 h-3 w-3" />
              allOf
            </Badge>
          )}
          {hasOneOf && (
            <Badge
              className="text-[10px] text-white"
              style={{ backgroundColor: EDGE_COLORS.oneOf }}
            >
              <SplitIcon className="mr-1 h-3 w-3" />
              oneOf
            </Badge>
          )}
          {hasAnyOf && (
            <Badge
              className="text-[10px] text-white"
              style={{ backgroundColor: EDGE_COLORS.anyOf }}
            >
              <MergeIcon className="mr-1 h-3 w-3" />
              anyOf
            </Badge>
          )}
          {hasItems && (
            <Badge
              className="text-[10px] text-white"
              style={{ backgroundColor: EDGE_COLORS['array-items'] }}
            >
              <ListIcon className="mr-1 h-3 w-3" />
              array
            </Badge>
          )}
        </div>
      )}

      {/* Properties info */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            {schema.type}
          </Badge>
          {propertyCount > 0 && (
            <span>
              {propertyCount} prop{propertyCount !== 1 ? 's' : ''}
            </span>
          )}
          {requiredCount > 0 && (
            <span className="text-amber-600">({requiredCount} required)</span>
          )}
        </div>

        {/* Show first few properties */}
        {schema.properties && (
          <div className="mt-2 space-y-0.5">
            {Object.entries(schema.properties)
              .slice(0, 3)
              .map(([name, prop]: [string, SchemaProperty]) => (
                <div key={name} className="flex items-center gap-1 text-[10px]">
                  <span className={cn('font-mono', prop.required && 'font-medium')}>
                    {name}
                  </span>
                  <span className="text-muted-foreground">: {prop.type}</span>
                </div>
              ))}
            {Object.keys(schema.properties).length > 3 && (
              <div className="text-[10px] text-muted-foreground">
                ...{Object.keys(schema.properties).length - 3} more
              </div>
            )}
          </div>
        )}

        {schema.description && (
          <div className="mt-2 text-[10px] text-muted-foreground line-clamp-2">
            {schema.description}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-slate-500" />
    </div>
  );
});
