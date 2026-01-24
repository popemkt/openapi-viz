import { useEffect, useRef } from 'react';
import type * as monaco from 'monaco-editor';
import { useEditorStore } from '@/stores/editorStore';
import { useSpecStore } from '@/stores/specStore';
import { useGraphStore } from '@/stores/graphStore';

/**
 * Hook that syncs graph node selection to Monaco editor decorations.
 * When nodes are selected in the graph, their source code locations
 * are highlighted in the editor with a visible background and left border.
 *
 * Uses Monaco's deltaDecorations API for efficient decoration updates.
 */
export function useSourceHighlight() {
  const editor = useEditorStore((state) => state.editor);
  const sourceMap = useSpecStore((state) => state.sourceMap);
  const selectedNodeIds = useGraphStore((state) => state.selectedNodeIds);

  // Track decoration IDs for cleanup
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!editor || !sourceMap) {
      return;
    }

    // Collect ranges for all selected nodes
    const ranges: monaco.IRange[] = [];

    for (const nodeId of selectedNodeIds) {
      const location = sourceMap.nodeToLocation.get(nodeId);
      if (location) {
        ranges.push({
          startLineNumber: location.startLine,
          startColumn: location.startColumn,
          endLineNumber: location.endLine,
          endColumn: location.endColumn,
        });
      }
    }

    // Apply decorations - deltaDecorations handles add/update/remove efficiently
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      ranges.map((range) => ({
        range,
        options: {
          className: 'source-highlight-selection',
          isWholeLine: false,
          overviewRuler: {
            color: 'hsl(var(--primary))',
            position: 2, // monaco.editor.OverviewRulerLane.Center
          },
        },
      }))
    );

    // Cleanup function - remove all decorations when unmounting or when dependencies change
    return () => {
      if (editor && decorationsRef.current.length > 0) {
        // Clear decorations by passing empty array as new decorations
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      }
    };
  }, [editor, sourceMap, selectedNodeIds]);
}
