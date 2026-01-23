// Import Monaco setup first to ensure workers are configured before Monaco loads
import '../monacoSetup';
import Editor, { type Monaco, type OnMount, type BeforeMount } from '@monaco-editor/react';
import { useCallback, useEffect, useRef } from 'react';
import type * as monaco from 'monaco-editor';
import { useSpecStore, useEditorStore } from '@/stores';
import { useUIStore } from '@/stores';
import { setupMonacoYaml } from '../monacoYamlSetup';

export function TextEditor() {
  const { rawText, setText, parseErrors } = useSpecStore();
  const { theme } = useUIStore();
  const setEditor = useEditorStore((state) => state.setEditor);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Configure monaco-yaml before the editor mounts
  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    setupMonacoYaml(monaco);
  }, []);

  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditor(editor);

    // Configure YAML-specific settings
    editor.updateOptions({
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      folding: true,
      renderLineHighlight: 'all',
      tabSize: 2,
      insertSpaces: true,
      automaticLayout: true,
    });
  }, [setEditor]);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        setText(value);
      }
    },
    [setText]
  );

  // Determine Monaco theme based on app theme
  const getMonacoTheme = () => {
    if (theme === 'dark') return 'vs-dark';
    if (theme === 'light') return 'vs';
    // For system theme, check if dark mode is preferred
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'vs-dark';
    }
    return 'vs';
  };

  // Show error markers in the editor
  const handleEditorValidation = useCallback(() => {
    if (!monacoRef.current || !editorRef.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const markers: monaco.editor.IMarkerData[] = parseErrors.map((error) => ({
      severity: error.severity === 'error'
        ? monacoRef.current!.MarkerSeverity.Error
        : monacoRef.current!.MarkerSeverity.Warning,
      message: error.message,
      startLineNumber: error.location?.startLine ?? 1,
      startColumn: error.location?.startColumn ?? 1,
      endLineNumber: error.location?.endLine ?? 1,
      endColumn: error.location?.endColumn ?? 1,
    }));

    monacoRef.current.editor.setModelMarkers(model, 'openapi', markers);
  }, [parseErrors]);

  // Update markers when errors change
  useEffect(() => {
    handleEditorValidation();
  }, [handleEditorValidation]);

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        defaultLanguage="yaml"
        value={rawText}
        theme={getMonacoTheme()}
        onChange={handleChange}
        beforeMount={handleBeforeMount}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 13,
          fontFamily: 'Fira Code, monospace',
          fontLigatures: true,
          padding: { top: 8 },
        }}
        loading={
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Loading editor...
          </div>
        }
      />
    </div>
  );
}
