import { create } from 'zustand';
import type * as monaco from 'monaco-editor';

interface EditorState {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  setEditor: (editor: monaco.editor.IStandaloneCodeEditor | null) => void;
  revealLine: (lineNumber: number) => void;
  selectRange: (startLine: number, startColumn: number, endLine: number, endColumn: number) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editor: null,

  setEditor: (editor) => set({ editor }),

  revealLine: (lineNumber: number) => {
    const { editor } = get();
    if (!editor) return;

    editor.revealLineInCenter(lineNumber);
    editor.setPosition({ lineNumber, column: 1 });
    editor.focus();
  },

  selectRange: (startLine: number, startColumn: number, endLine: number, endColumn: number) => {
    const { editor } = get();
    if (!editor) return;

    const range = {
      startLineNumber: startLine,
      startColumn,
      endLineNumber: endLine,
      endColumn,
    };

    editor.setSelection(range);
    editor.revealRangeInCenter(range);
    editor.focus();
  },
}));
