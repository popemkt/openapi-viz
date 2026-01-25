import { memo, useMemo } from 'react';
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
  AlertTriangleIcon,
} from 'lucide-react';
import { EDGE_COLORS } from '@/constants/colors';
import { useUIStore, type LayoutDirection } from '@/stores/uiStore';
import { truncateSchemaName } from '@/utils/displayUtils';

// Map layout direction to handle positions
function getHandlePositions(direction: LayoutDirection): { source: Position; target: Position } {
  switch (direction) {
    case 'LR':
      return { source: Position.Right, target: Position.Left };
    case 'RL':
      return { source: Position.Left, target: Position.Right };
    case 'TB':
      return { source: Position.Bottom, target: Position.Top };
    case 'BT':
      return { source: Position.Top, target: Position.Bottom };
  }
}

interface SchemaNodeProps {
  data: SchemaNodeData;
  selected?: boolean;
}

export const SchemaNode = memo(function SchemaNode({ data, selected }: SchemaNodeProps) {
  const {
    schema,
    hasDiscriminator,
    discriminatorValues,
    compositionType,
    incomingRefCount,
    outgoingRefCount,
    dimmed,
    isOrphaned,
  } = data;
  const { schemaNameDisplayMode, compactLevel, maxNodeWidth, nodeScale, layoutDirection } =
    useUIStore();

  const propertyCount = schema.properties ? Object.keys(schema.properties).length : 0;
  const requiredCount = schema.required?.length || 0;

  const isCompact = compactLevel === 'compact' || compactLevel === 'minimal';
  const isMinimal = compactLevel === 'minimal';

  // Get display name based on current mode
  const displayName = isCompact
    ? truncateSchemaName(schema.name, schemaNameDisplayMode)
    : schema.name;
  const isNameTruncated = displayName !== schema.name;

  // Detect composition types from schema or from pre-computed compositionType
  const hasAllOf = compositionType === 'allOf' || (schema.allOf && schema.allOf.length > 0);
  const hasOneOf = compositionType === 'oneOf' || (schema.oneOf && schema.oneOf.length > 0);
  const hasAnyOf = compositionType === 'anyOf' || (schema.anyOf && schema.anyOf.length > 0);
  const hasItems = !!schema.items;
  const hasAdditionalProps =
    schema.additionalProperties !== undefined && schema.additionalProperties !== true;
  const hasPrefixItems = schema.prefixItems && schema.prefixItems.length > 0;
  const hasComposition =
    hasAllOf || hasOneOf || hasAnyOf || hasItems || hasAdditionalProps || hasPrefixItems;

  // Calculate scaled dimensions
  const scaledMinWidth = 160 * nodeScale;
  const scaledMaxWidth = isCompact ? maxNodeWidth * nodeScale : undefined;

  // Get handle positions based on layout direction
  const handlePositions = useMemo(() => getHandlePositions(layoutDirection), [layoutDirection]);

  // Calculate header font size based on scale (0.875rem = text-sm base)
  const headerFontSize = `${0.875 * nodeScale}rem`;

  return (
    <div
      className={cn(
        'bg-card origin-top-left rounded-md border shadow-sm transition-all',
        selected && 'ring-primary ring-2',
        dimmed && 'opacity-30 grayscale',
        isOrphaned && 'border-2 border-dashed border-orange-400'
      )}
      style={{
        minWidth: scaledMinWidth,
        maxWidth: scaledMaxWidth,
        fontSize: `${nodeScale}rem`,
      }}
    >
      <Handle type="target" position={handlePositions.target} className="!bg-slate-500" />

      {/* Header */}
      <div className="flex items-center gap-2 rounded-t-md bg-slate-100 px-3 py-2 dark:bg-slate-800">
        <BoxIcon
          className="flex-shrink-0 text-slate-600 dark:text-slate-400"
          style={{ width: `${1 * nodeScale}rem`, height: `${1 * nodeScale}rem` }}
        />
        {isNameTruncated ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="cursor-help truncate font-mono font-medium text-slate-700 dark:text-slate-300"
                style={{ fontSize: headerFontSize }}
              >
                {displayName}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[400px]">
              <span className="font-mono text-xs break-all">{schema.name}</span>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span
            className="truncate font-mono font-medium text-slate-700 dark:text-slate-300"
            style={{ fontSize: headerFontSize }}
          >
            {displayName}
          </span>
        )}
      </div>

      {/* Orphaned badge */}
      {isOrphaned && (
        <div className="flex items-center gap-1 px-3 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="cursor-help bg-orange-500 text-[10px] text-white">
                <AlertTriangleIcon className="mr-1 h-3 w-3" />
                Orphaned
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div className="font-medium">Unused Schema</div>
                <div className="text-muted-foreground">
                  This schema is not referenced by any endpoint or other schema. Consider removing
                  it to reduce API spec complexity.
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Discriminator badge - hidden in minimal mode */}
      {!isMinimal && hasDiscriminator && schema.discriminator && (
        <div className="flex items-center gap-1 px-3 pt-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                className="cursor-help text-[10px] text-white"
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

      {/* Discriminator values badge - hidden in minimal mode */}
      {!isMinimal && discriminatorValues && discriminatorValues.length > 0 && (
        <div className="flex items-center gap-1 px-3 pt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="cursor-help border-orange-400 text-[10px] text-orange-600"
              >
                <TagIcon className="mr-1 h-3 w-3" />= {discriminatorValues.join(' | ')}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div className="font-medium">Discriminator target</div>
                <div className="text-muted-foreground">
                  This schema is selected when discriminator value is:{' '}
                  {discriminatorValues.join(' or ')}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Composition type badges - hidden in minimal mode */}
      {!isMinimal && hasComposition && (
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
                  className="cursor-help text-[10px] text-white"
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
                  className="cursor-help text-[10px] text-white"
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

      {/* Properties info - hidden in minimal mode */}
      {!isMinimal && (
        <div className="px-3 py-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
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
                  <span className="cursor-help text-slate-400">
                    ←{incomingRefCount} →{outgoingRefCount}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <div>
                      {incomingRefCount} incoming reference{incomingRefCount !== 1 ? 's' : ''}
                    </div>
                    <div>
                      {outgoingRefCount} outgoing reference{outgoingRefCount !== 1 ? 's' : ''}
                    </div>
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
                    <span className={cn('font-mono', prop.required && 'font-medium')}>{name}</span>
                    <span className="text-muted-foreground">: {prop.type}</span>
                  </div>
                ))}
              {Object.keys(schema.properties).length > 3 && (
                <div className="text-muted-foreground text-[10px]">
                  ...{Object.keys(schema.properties).length - 3} more
                </div>
              )}
            </div>
          )}

          {schema.description && (
            <div className="text-muted-foreground mt-2 line-clamp-2 text-[10px]">
              {schema.description}
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={handlePositions.source} className="!bg-slate-500" />
    </div>
  );
});
