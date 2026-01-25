import { useMemo, useState, useCallback } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  XIcon,
  GitBranchIcon,
  CircleDotIcon,
  LayersIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSpecStore, useUIStore, useGraphStore } from '@/stores';
import {
  analyzeSchemaInheritance,
  hasCompositions,
  type InheritanceNode,
  type CompositionHierarchy,
} from '@/utils/schemaInheritance';
import { cn } from '@/lib/utils';

interface TreeNodeProps {
  node: InheritanceNode;
  level: number;
  onSelect: (schemaName: string) => void;
  selectedSchema: string | null;
}

function TreeNode({ node, level, onSelect, selectedSchema }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = node.name === selectedSchema;

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  }, []);

  const handleSelect = useCallback(() => {
    onSelect(node.name);
  }, [node.name, onSelect]);

  return (
    <div className="select-none">
      <div
        className={cn(
          'flex items-center gap-1 rounded px-2 py-1 cursor-pointer transition-colors',
          'hover:bg-accent/50',
          isSelected && 'bg-accent text-accent-foreground'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleSelect}
      >
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="p-0.5 hover:bg-accent rounded"
          >
            {isExpanded ? (
              <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="text-sm font-medium truncate">{node.name}</span>
        {node.children.length > 0 && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-auto">
            {node.children.length}
          </Badge>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.name}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              selectedSchema={selectedSchema}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CompositionSectionProps {
  hierarchy: CompositionHierarchy;
  onSelect: (schemaName: string) => void;
  selectedSchema: string | null;
  icon: React.ReactNode;
}

function CompositionSection({ hierarchy, onSelect, selectedSchema, icon }: CompositionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (hierarchy.roots.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-left hover:bg-accent/50 rounded transition-colors"
      >
        {isExpanded ? (
          <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
        )}
        {icon}
        <span className="text-sm font-semibold text-foreground">{hierarchy.label}</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1.5 ml-auto">
          {hierarchy.roots.length} tree{hierarchy.roots.length !== 1 ? 's' : ''}
        </Badge>
      </button>
      {isExpanded && (
        <div className="mt-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-muted-foreground px-2 mb-2 line-clamp-2 cursor-help">
                {hierarchy.description}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              {hierarchy.description}
            </TooltipContent>
          </Tooltip>
          {hierarchy.roots.map((root) => (
            <TreeNode
              key={root.name}
              node={root}
              level={0}
              onSelect={onSelect}
              selectedSchema={selectedSchema}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SchemaInheritancePanel() {
  const { parsedSpec } = useSpecStore();
  const { setInheritancePanelOpen } = useUIStore();
  const { nodes, setSelectedNodeIds } = useGraphStore();
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);

  const analysis = useMemo(() => analyzeSchemaInheritance(parsedSpec), [parsedSpec]);
  const hasAnyCompositions = hasCompositions(analysis);

  const handleClose = useCallback(() => {
    setInheritancePanelOpen(false);
  }, [setInheritancePanelOpen]);

  const handleSelectSchema = useCallback(
    (schemaName: string) => {
      setSelectedSchema(schemaName);
      // Find and select the schema node in the graph
      const schemaNode = nodes.find(
        (n) => n.data.type === 'schema' && n.data.schema?.name === schemaName
      );
      if (schemaNode) {
        setSelectedNodeIds(new Set([schemaNode.id]));
      }
    },
    [nodes, setSelectedNodeIds]
  );

  const compositionIcons = {
    allOf: <GitBranchIcon className="h-4 w-4 text-purple-500" />,
    oneOf: <CircleDotIcon className="h-4 w-4 text-blue-500" />,
    anyOf: <LayersIcon className="h-4 w-4 text-green-500" />,
  };

  return (
    <div className="flex h-full flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <GitBranchIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Schema Inheritance</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleClose}>
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {!parsedSpec ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No specification loaded
            </div>
          ) : !hasAnyCompositions ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <GitBranchIcon className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No schema compositions found
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                This spec doesn't use allOf, oneOf, or anyOf
              </p>
            </div>
          ) : (
            <>
              <CompositionSection
                hierarchy={analysis.allOf}
                onSelect={handleSelectSchema}
                selectedSchema={selectedSchema}
                icon={compositionIcons.allOf}
              />
              <CompositionSection
                hierarchy={analysis.oneOf}
                onSelect={handleSelectSchema}
                selectedSchema={selectedSchema}
                icon={compositionIcons.oneOf}
              />
              <CompositionSection
                hierarchy={analysis.anyOf}
                onSelect={handleSelectSchema}
                selectedSchema={selectedSchema}
                icon={compositionIcons.anyOf}
              />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
