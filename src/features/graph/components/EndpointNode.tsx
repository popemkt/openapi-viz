import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { EndpointNodeData, HttpMethod } from '@/types';
import { cn } from '@/lib/utils';
import { METHOD_COLORS } from '@/constants';
import { Badge } from '@/components/ui/badge';

interface EndpointNodeProps {
  data: EndpointNodeData;
  selected?: boolean;
}

export const EndpointNode = memo(function EndpointNode({ data, selected }: EndpointNodeProps) {
  const { endpoint } = data;
  const methodColor = METHOD_COLORS[endpoint.method as HttpMethod];

  return (
    <div
      className={cn(
        'min-w-[180px] rounded-md border bg-card shadow-sm transition-shadow',
        selected && 'ring-2 ring-primary',
        endpoint.deprecated && 'opacity-60'
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary" />

      {/* Header with method badge */}
      <div className={cn('flex items-center gap-2 rounded-t-md px-3 py-2', methodColor.bg)}>
        <Badge variant="outline" className={cn('uppercase font-mono text-xs', methodColor.text, methodColor.border)}>
          {endpoint.method}
        </Badge>
        {endpoint.deprecated && (
          <Badge variant="secondary" className="text-xs">
            deprecated
          </Badge>
        )}
      </div>

      {/* Path and summary */}
      <div className="px-3 py-2">
        <div className="font-mono text-xs text-foreground break-all">{endpoint.path}</div>
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

      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
});
