import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { SchemaNodeData, SchemaProperty } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BoxIcon,
  LayersIcon,
  SplitIcon,
  MergeIcon,
  ListIcon,
  TagIcon,
  HashIcon,
  BookOpenIcon,
} from 'lucide-react';
import { EDGE_COLORS } from '@/constants/colors';
import { useUIStore } from '@/stores/uiStore';
import { truncateSchemaName } from '@/utils/displayUtils';

interface SchemaNodeProps {
  data: SchemaNodeData;
  selected?: boolean;
}

export const SchemaNode = memo(function SchemaNode({ data, selected }: SchemaNodeProps) {
  const { schema, hasDiscriminator, discriminatorValues, compositionType, incomingRefCount, outgoingRefCount } = data;
  const { schemaNameDisplayMode, compactMode, maxNodeWidth } = useUIStore();

  const propertyCount = schema.properties ? Object.keys(schema.properties).length : 0;
  const requiredCount = schema.required?.length || 0;

  // Get display name based on current mode
  const displayName = compactMode
    ? truncateSchemaName(schema.name, schemaNameDisplayMode)
    : schema.name;
  const isNameTruncated = displayName !== schema.name;

  // Detect composition types from schema or from pre-computed compositionType
  const hasAllOf = compositionType === 'allOf' || (schema.allOf && schema.allOf.length > 0);
  const hasOneOf = compositionType === 'oneOf' || (schema.oneOf && schema.oneOf.length > 0);
  const hasAnyOf = compositionType === 'anyOf' || (schema.anyOf && schema.anyOf.length > 0);
  const hasItems = !!schema.items;
  const hasAdditionalProps = schema.additionalProperties !== undefined && schema.additionalProperties !== true;
  const hasPrefixItems = schema.prefixItems && schema.prefixItems.length > 0;
  const hasComposition = hasAllOf || hasOneOf || hasAnyOf || hasItems || hasAdditionalProps || hasPrefixItems;

  return (
    <div
      className={cn(
        'min-w-[160px] rounded-md border bg-card shadow-sm transition-shadow',
        selected && 'ring-2 ring-primary'
      )}
      style={{ maxWidth: compactMode ? maxNodeWidth : undefined }}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-500" />

      {/* Header */}
      <div className="flex items-center gap-2 rounded-t-md bg-slate-100 px-3 py-2 dark:bg-slate-800">
        <BoxIcon className="h-4 w-4 flex-shrink-0 text-slate-600 dark:text-slate-400" />
        {isNameTruncated ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300 truncate cursor-help">
                {displayName}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[400px]">
              <span className="font-mono text-xs break-all">{schema.name}</span>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
            {displayName}
          </span>
        )}
      </div>

      {/* Discriminator badge */}
      {hasDiscriminator && schema.discriminator && (
        <div className="flex items-center gap-1 px-3 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                className="text-[10px] text-white cursor-help"
                style={{ backgroundColor: EDGE_COLORS.discriminator }}
              >
                <TagIcon className="mr-1 h-3 w-3" />
                discriminator: {schema.discriminator.propertyName}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div className="font-medium">Polymorphic type selector</div>
                <div className="text-muted-foreground">
                  Property "{schema.discriminator.propertyName}" determines the schema variant
                </div>
                {schema.discriminator.mapping && (
                  <div className="mt-1">
                    <span className="text-muted-foreground">Mappings: </span>
                    {Object.keys(schema.discriminator.mapping).join(', ')}
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Discriminator values badge (when this schema is a target of a discriminator) */}
      {discriminatorValues && discriminatorValues.length > 0 && (
        <div className="flex items-center gap-1 px-3 pt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] cursor-help border-orange-400 text-orange-600">
                <TagIcon className="mr-1 h-3 w-3" />
                = {discriminatorValues.join(' | ')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div className="font-medium">Discriminator target</div>
                <div className="text-muted-foreground">
                  This schema is selected when discriminator value is: {discriminatorValues.join(' or ')}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      )}

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
          {hasAdditionalProps && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  className="text-[10px] text-white cursor-help"
                  style={{ backgroundColor: EDGE_COLORS['additional-props'] }}
                >
                  <BookOpenIcon className="mr-1 h-3 w-3" />
                  {schema.additionalProperties === false ? 'closed' : 'map'}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  {schema.additionalProperties === false
                    ? 'No additional properties allowed'
                    : 'Map/Dictionary pattern with typed values'}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
          {hasPrefixItems && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  className="text-[10px] text-white cursor-help"
                  style={{ backgroundColor: EDGE_COLORS['tuple-item'] }}
                >
                  <HashIcon className="mr-1 h-3 w-3" />
                  tuple[{schema.prefixItems?.length}]
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  Tuple type with {schema.prefixItems?.length} fixed positions
                </div>
              </TooltipContent>
            </Tooltip>
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
          {/* Reference counts */}
          {(incomingRefCount > 0 || outgoingRefCount > 0) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-slate-400 cursor-help">
                  ←{incomingRefCount} →{outgoingRefCount}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <div>{incomingRefCount} incoming reference{incomingRefCount !== 1 ? 's' : ''}</div>
                  <div>{outgoingRefCount} outgoing reference{outgoingRefCount !== 1 ? 's' : ''}</div>
                </div>
              </TooltipContent>
            </Tooltip>
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
