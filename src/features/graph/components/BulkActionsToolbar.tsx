import { memo } from 'react';
import {
  EyeOffIcon,
  TargetIcon,
  Maximize2Icon,
  XIcon,
  EyeIcon,
  LayoutGridIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useGraphStore } from '@/stores';
import { cn } from '@/lib/utils';

interface ActionButtonProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  className?: string;
  disabled?: boolean;
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'ghost',
  className,
  disabled,
}: ActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size="sm"
          className={cn('h-8 w-8 p-0', className)}
          onClick={onClick}
          disabled={disabled}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export const BulkActionsToolbar = memo(function BulkActionsToolbar() {
  const {
    selectedNodeIds,
    hiddenNodeIds,
    hideNodes,
    focusOnNodes,
    selectConnected,
    selectNode,
    showAllHiddenNodes,
    relayoutVisibleNodes,
  } = useGraphStore();

  const hasSelection = selectedNodeIds.size > 0;
  const hasHidden = hiddenNodeIds.size > 0;

  // Don't render if nothing to show
  if (!hasSelection && !hasHidden) {
    return null;
  }

  const handleHide = () => {
    hideNodes(Array.from(selectedNodeIds));
  };

  const handleFocus = () => {
    focusOnNodes(Array.from(selectedNodeIds));
  };

  const handleExpand = () => {
    selectConnected(Array.from(selectedNodeIds));
  };

  const handleClear = () => {
    selectNode(null);
  };

  const handleUnhideAll = () => {
    showAllHiddenNodes();
  };

  const handleRelayout = () => {
    relayoutVisibleNodes();
  };

  return (
    <div
      className={cn(
        'absolute bottom-4 left-1/2 z-10 -translate-x-1/2',
        // Fade-in animation
        'animate-in fade-in-0 zoom-in-95 duration-200'
      )}
    >
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-lg">
        {/* Selection actions */}
        {hasSelection && (
          <>
            <div className="flex items-center gap-0.5 px-1">
              <Badge variant="secondary" className="h-6 px-2 text-xs font-medium">
                {selectedNodeIds.size} selected
              </Badge>
            </div>

            <div className="h-6 w-px bg-border" />

            <ActionButton
              icon={EyeOffIcon}
              label="Hide selected (Del)"
              onClick={handleHide}
            />
            <ActionButton
              icon={TargetIcon}
              label="Focus: show only selection + neighbors"
              onClick={handleFocus}
            />
            <ActionButton
              icon={Maximize2Icon}
              label="Expand: select all connected nodes"
              onClick={handleExpand}
            />

            <div className="h-6 w-px bg-border" />

            <ActionButton
              icon={XIcon}
              label="Clear selection (Esc)"
              onClick={handleClear}
            />
          </>
        )}

        {/* Hidden nodes actions */}
        {hasHidden && (
          <>
            {hasSelection && <div className="h-6 w-px bg-border" />}

            <div className="flex items-center gap-1 px-1">
              <ActionButton
                icon={EyeIcon}
                label={`Show ${hiddenNodeIds.size} hidden node${hiddenNodeIds.size > 1 ? 's' : ''}`}
                onClick={handleUnhideAll}
              />
              <Badge variant="outline" className="h-6 px-2 text-xs">
                {hiddenNodeIds.size} hidden
              </Badge>
            </div>
          </>
        )}

        {/* Layout action - always visible when toolbar shows */}
        <div className="h-6 w-px bg-border" />
        <ActionButton
          icon={LayoutGridIcon}
          label="Relayout visible nodes"
          onClick={handleRelayout}
        />
      </div>
    </div>
  );
});
