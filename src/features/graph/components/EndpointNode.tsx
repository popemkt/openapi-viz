import { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { EndpointNodeData, HttpMethod } from '@/types';
import { cn } from '@/lib/utils';
import { METHOD_COLORS } from '@/constants';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUIStore, type LayoutDirection } from '@/stores/uiStore';
import { truncateEndpointPath } from '@/utils/displayUtils';

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

interface EndpointNodeProps {
  data: EndpointNodeData;
  selected?: boolean;
}

export const EndpointNode = memo(function EndpointNode({ data, selected }: EndpointNodeProps) {
  const { endpoint, dimmed } = data;
  const methodColor = METHOD_COLORS[endpoint.method as HttpMethod];
  const { endpointPathDisplayMode, compactLevel, maxNodeWidth, nodeScale, layoutDirection } = useUIStore();

  const isCompact = compactLevel === 'compact' || compactLevel === 'minimal';
  const isMinimal = compactLevel === 'minimal';

  // Get display path based on current mode
  const displayPath = isCompact
    ? truncateEndpointPath(endpoint.path, endpointPathDisplayMode)
    : endpoint.path;
  const isPathTruncated = displayPath !== endpoint.path;

  // Calculate scaled dimensions
  const scaledMinWidth = 180 * nodeScale;
  const scaledMaxWidth = isCompact ? maxNodeWidth * nodeScale : undefined;

  // Get handle positions based on layout direction
  const handlePositions = useMemo(() => getHandlePositions(layoutDirection), [layoutDirection]);

  // Calculate header font size based on scale
  const headerFontSize = `${0.75 * nodeScale}rem`; // 0.75rem = text-xs base

  return (
    <div
      className={cn(
        'rounded-md border bg-card shadow-sm transition-all origin-top-left',
        selected && 'ring-2 ring-primary',
        endpoint.deprecated && 'opacity-60',
        dimmed && 'opacity-30 grayscale'
      )}
      style={{
        minWidth: scaledMinWidth,
        maxWidth: scaledMaxWidth,
        fontSize: `${nodeScale}rem`,
      }}
    >
      <Handle type="target" position={handlePositions.target} className="!bg-primary" />

      {/* Header with method badge */}
      <div className={cn('flex items-center gap-2 rounded-t-md px-3 py-2', methodColor.bg)}>
        <Badge
          variant="outline"
          className={cn('uppercase font-mono', methodColor.text, methodColor.border)}
          style={{ fontSize: headerFontSize }}
        >
          {endpoint.method}
        </Badge>
        {/* In minimal mode, show truncated path in header */}
        {isMinimal && (
          isPathTruncated ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="font-mono text-foreground truncate cursor-help flex-1 min-w-0"
                  style={{ fontSize: headerFontSize }}
                >
                  {displayPath}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[400px]">
                <span className="font-mono text-xs break-all">{endpoint.path}</span>
              </TooltipContent>
            </Tooltip>
          ) : (
            <span
              className="font-mono text-foreground truncate flex-1 min-w-0"
              style={{ fontSize: headerFontSize }}
            >
              {displayPath}
            </span>
          )
        )}
        {endpoint.deprecated && (
          <Badge variant="secondary" style={{ fontSize: headerFontSize }}>
            deprecated
          </Badge>
        )}
      </div>

      {/* Path and summary - hidden in minimal mode */}
      {!isMinimal && (
        <div className="px-3 py-2">
          {isPathTruncated ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="font-mono text-xs text-foreground truncate cursor-help">{displayPath}</div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[400px]">
                <span className="font-mono text-xs break-all">{endpoint.path}</span>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="font-mono text-xs text-foreground break-all">{endpoint.path}</div>
          )}
          {endpoint.summary && (
            <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{endpoint.summary}</div>
          )}
          {endpoint.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {endpoint.tags.slice(0, 2).map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
              {endpoint.tags.length > 2 && (
                <Badge variant="secondary" className="text-[10px]">
                  +{endpoint.tags.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={handlePositions.source} className="!bg-primary" />
    </div>
  );
});
