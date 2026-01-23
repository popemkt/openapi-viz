import { useCallback } from 'react';
import { XIcon, CodeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useGraphStore, useSpecStore, useUIStore, useEditorStore } from '@/stores';
import type { EndpointNodeData, SchemaNodeData, GraphNodeData } from '@/types';
import { EndpointDetail } from './EndpointDetail';
import { SchemaDetail } from './SchemaDetail';

function isEndpointData(data: GraphNodeData): data is EndpointNodeData {
  return data.type === 'endpoint';
}

function isSchemaData(data: GraphNodeData): data is SchemaNodeData {
  return data.type === 'schema';
}

export function DetailPanel() {
  const { selectedNodeId, nodes } = useGraphStore();
  const { sourceMap } = useSpecStore();
  const { setDetailPanelOpen, setViewMode, viewMode } = useUIStore();
  const { selectRange } = useEditorStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const handleClose = useCallback(() => {
    setDetailPanelOpen(false);
  }, [setDetailPanelOpen]);

  const handleJumpToSource = useCallback(() => {
    if (!selectedNodeId || !sourceMap) return;

    const location = sourceMap.nodeToLocation.get(selectedNodeId);
    if (location) {
      // Switch to split or editor view if in graph-only mode
      if (viewMode === 'graph') {
        setViewMode('split');
      }
      // Select the range in the editor
      selectRange(
        location.startLine,
        location.startColumn,
        location.endLine,
        location.endColumn
      );
    }
  }, [selectedNodeId, sourceMap, viewMode, setViewMode, selectRange]);

  if (!selectedNode) {
    return (
      <div className="flex h-full flex-col border-t border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-sm font-medium text-foreground">Details</span>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Select a node to view details
        </div>
      </div>
    );
  }

  const data = selectedNode.data as GraphNodeData;

  return (
    <div className="flex h-full flex-col border-t border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {data.type}
          </Badge>
          <span className="text-sm font-medium text-foreground">
            {isEndpointData(data) ? data.endpoint.path : isSchemaData(data) ? data.schema.name : 'Unknown'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={handleJumpToSource}>
                <CodeIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Jump to source</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {isEndpointData(data) && <EndpointDetail endpoint={data.endpoint} />}
          {isSchemaData(data) && <SchemaDetail schema={data.schema} />}
        </div>
      </ScrollArea>
    </div>
  );
}
