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
  const { viewMode, detailPanelOpen, setDetailPanelOpen } = useUIStore();
  const { selectedNodeId } = useGraphStore();

  // Open detail panel when a node is selected
  useEffect(() => {
    if (selectedNodeId) {
      setDetailPanelOpen(true);
    }
  }, [selectedNodeId, setDetailPanelOpen]);

  const mainContent = (() => {
    if (viewMode === 'editor') {
      return <EditorPane />;
    }

    if (viewMode === 'graph') {
      return <GraphPane />;
    }

    // Split view
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
  })();

  // If detail panel is open, show it in a vertical split
  if (detailPanelOpen) {
    return (
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel defaultSize={70} minSize={30}>
          {mainContent}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={30} minSize={15}>
          <DetailPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  return mainContent;
}
