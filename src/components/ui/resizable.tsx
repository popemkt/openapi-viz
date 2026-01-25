import * as React from 'react';
import { GripVerticalIcon, GripHorizontalIcon } from 'lucide-react';
import { Group, Panel, Separator } from 'react-resizable-panels';

import { cn } from '@/lib/utils';

function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof Group>) {
  return (
    <Group
      data-slot="resizable-panel-group"
      className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
}) {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        'group',
        // Base styles for horizontal (left-right) splits
        'bg-border focus-visible:ring-ring relative flex w-px items-center justify-center',
        'after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2',
        'focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden',
        // Vertical (top-bottom) split overrides
        'data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full',
        'data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1',
        'data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0',
        'data-[panel-group-direction=vertical]:after:-translate-y-1/2',
        className
      )}
      {...props}
    >
      {withHandle && (
        <>
          {/* Handle for horizontal splits (left-right) - tall and narrow with vertical grip */}
          <div className="bg-border hover:bg-muted-foreground/20 z-10 flex h-4 w-3 items-center justify-center rounded-sm border transition-colors group-data-[panel-group-direction=vertical]:hidden">
            <GripVerticalIcon className="size-2.5" />
          </div>
          {/* Handle for vertical splits (top-bottom) - short and wide with horizontal grip, centered */}
          <div className="bg-border hover:bg-muted-foreground/20 z-10 hidden h-1.5 w-12 items-center justify-center rounded-sm border transition-colors group-data-[panel-group-direction=vertical]:flex">
            <GripHorizontalIcon className="size-4" />
          </div>
        </>
      )}
    </Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
