import { useEffect } from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { useUIStore, useGraphStore } from '@/stores';
import { TextEditor } from '@/features/editor';
import { GraphCanvas } from '@/features/graph';
import { DetailPanel } from '@/features/detail-panel';
import { SchemaInheritancePanel } from '@/features/inheritance-panel';
import { ReactFlowProvider } from '@xyflow/react';

function GraphPane() {
  return (
    <div className="h-full bg-background">
      <ReactFlowProvider>
        <GraphCanvas />
      </ReactFlowProvider>
    </div>
  );
}

function EditorPane() {
  return (
    <div className="h-full bg-card">
      <TextEditor />
    </div>
  );
}

export function MainContent() {
  const { viewMode, detailPanelOpen, setDetailPanelOpen, inheritancePanelOpen } = useUIStore();
  const { selectedNodeIds } = useGraphStore();

  // Open detail panel when a node is selected
  useEffect(() => {
    if (selectedNodeIds.size > 0) {
      setDetailPanelOpen(true);
    }
  }, [selectedNodeIds, setDetailPanelOpen]);

  // Build the main view content based on view mode
  const renderMainView = () => {
    if (viewMode === 'editor') {
      return <EditorPane />;
    }

    if (viewMode === 'graph') {
      return <GraphPane />;
    }

    // Split view - always uses horizontal layout
    return (
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={50} minSize={20}>
          <EditorPane />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={20}>
          <GraphPane />
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  };

  // Build the content with horizontal layout (main + optional inheritance panel)
  const renderHorizontalContent = () => {
    const mainView = renderMainView();

    if (!inheritancePanelOpen) {
      return mainView;
    }

    // When inheritance panel is open, wrap in horizontal group
    return (
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={75} minSize={50}>
          {mainView}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={25} minSize={15}>
          <SchemaInheritancePanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  };

  // Build final layout with optional detail panel (vertical)
  const horizontalContent = renderHorizontalContent();

  if (!detailPanelOpen) {
    return horizontalContent;
  }

  // When detail panel is open, wrap everything in vertical group
  return (
    <ResizablePanelGroup orientation="vertical">
      <ResizablePanel defaultSize={70} minSize={30}>
        {horizontalContent}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={30} minSize={15}>
        <DetailPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
