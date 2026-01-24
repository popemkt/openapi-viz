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
  shortcut?: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  className?: string;
  disabled?: boolean;
  showLabel?: boolean;
}

function ActionButton({
  icon: Icon,
  label,
  shortcut,
  onClick,
  variant = 'outline',
  className,
  disabled,
  showLabel = true,
}: ActionButtonProps) {
  const tooltipText = shortcut ? `${label} (${shortcut})` : label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size="sm"
          className={cn('h-8 gap-1.5', showLabel ? 'px-2.5' : 'w-8 p-0', className)}
          onClick={onClick}
          disabled={disabled}
        >
          <Icon className="h-4 w-4" />
          {showLabel && <span className="text-xs">{label}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltipText}</TooltipContent>
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
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 shadow-lg">
        {/* Selection info and actions */}
        {hasSelection && (
          <>
            <Badge variant="secondary" className="h-6 px-2.5 text-xs font-medium">
              {selectedNodeIds.size} selected
            </Badge>

            <div className="h-5 w-px bg-border" />

            <div className="flex items-center gap-1">
              <ActionButton
                icon={EyeOffIcon}
                label="Hide"
                shortcut="Del"
                onClick={handleHide}
              />
              <ActionButton
                icon={TargetIcon}
                label="Focus"
                onClick={handleFocus}
              />
              <ActionButton
                icon={Maximize2Icon}
                label="Expand"
                onClick={handleExpand}
              />
            </div>

            <div className="h-5 w-px bg-border" />

            <ActionButton
              icon={XIcon}
              label="Clear"
              shortcut="Esc"
              onClick={handleClear}
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
            />
          </>
        )}

        {/* Hidden nodes indicator and unhide action */}
        {hasHidden && (
          <>
            {hasSelection && <div className="h-5 w-px bg-border" />}

            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="h-6 px-2.5 text-xs font-medium">
                {hiddenNodeIds.size} hidden
              </Badge>
              <ActionButton
                icon={EyeIcon}
                label="Show All"
                onClick={handleUnhideAll}
              />
            </div>
          </>
        )}

        {/* Relayout action */}
        <div className="h-5 w-px bg-border" />
        <ActionButton
          icon={LayoutGridIcon}
          label="Relayout"
          onClick={handleRelayout}
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
        />
      </div>
    </div>
  );
});
