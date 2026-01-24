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
 * Debounced to prevent performance issues during rapid selection changes
 * (e.g., marquee drag selection).
 */
export function useSourceHighlight() {
  const editor = useEditorStore((state) => state.editor);
  const sourceMap = useSpecStore((state) => state.sourceMap);
  const selectedNodeIds = useGraphStore((state) => state.selectedNodeIds);

  // Track decoration IDs for cleanup
  const decorationsRef = useRef<string[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editor || !sourceMap) {
      return;
    }

    // Clear any pending update
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce decoration updates to avoid performance issues during marquee drag
    timeoutRef.current = setTimeout(() => {
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
    }, 100); // 100ms debounce

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [editor, sourceMap, selectedNodeIds]);

  // Cleanup decorations on unmount
  useEffect(() => {
    return () => {
      const editorInstance = useEditorStore.getState().editor;
      if (editorInstance && decorationsRef.current.length > 0) {
        editorInstance.deltaDecorations(decorationsRef.current, []);
      }
    };
  }, []);
}
