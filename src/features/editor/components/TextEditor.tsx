import { useEffect, useRef, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import YamlWorker from 'monaco-yaml/yaml.worker?worker';
import { configureMonacoYaml } from 'monaco-yaml';
import { useSpecStore, useEditorStore } from '@/stores';
import { useUIStore } from '@/stores';

// Configure Monaco environment for workers BEFORE any Monaco usage
// This must happen at module load time
window.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'yaml') {
      return new YamlWorker();
    }
    return new EditorWorker();
  },
};

// Configure monaco-yaml with OpenAPI schemas
// Must be called before creating any editors
configureMonacoYaml(monaco, {
  enableSchemaRequest: true,
  hover: true,
  completion: true,
  validate: true,
  format: true,
  schemas: [
    {
      // OpenAPI 3.1 schema
      uri: 'https://spec.openapis.org/oas/3.1/schema-base/2022-10-07',
      fileMatch: ['*'],
    },
    {
      // OpenAPI 3.0 schema (fallback)
      uri: 'https://spec.openapis.org/oas/3.0/schema/2021-09-28',
      fileMatch: ['*'],
    },
  ],
});

export function TextEditor() {
  const { rawText, setText, parseErrors } = useSpecStore();
  const { theme } = useUIStore();
  const setEditor = useEditorStore((state) => state.setEditor);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<monaco.editor.ITextModel | null>(null);

  // Determine Monaco theme based on app theme
  const getMonacoTheme = useCallback(() => {
    if (theme === 'dark') return 'vs-dark';
    if (theme === 'light') return 'vs';
    // For system theme, check if dark mode is preferred
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'vs-dark';
    }
    return 'vs';
  }, [theme]);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    // Create model with YAML language
    const model = monaco.editor.createModel(rawText, 'yaml');
    modelRef.current = model;

    // Create editor instance
    const editor = monaco.editor.create(containerRef.current, {
      model,
      theme: getMonacoTheme(),
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      folding: true,
      renderLineHighlight: 'all',
      tabSize: 2,
      insertSpaces: true,
      automaticLayout: true,
      fontSize: 13,
      fontFamily: 'Fira Code, monospace',
      fontLigatures: true,
      padding: { top: 8 },
    });

    editorRef.current = editor;
    setEditor(editor);

    // Listen for content changes
    const disposable = editor.onDidChangeModelContent(() => {
      const value = editor.getValue();
      setText(value);
    });

    // Cleanup on unmount
    return () => {
      disposable.dispose();
      editor.dispose();
      model.dispose();
      editorRef.current = null;
      modelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Update editor value when rawText changes externally (e.g., file load)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentValue = editor.getValue();
    if (currentValue !== rawText) {
      // Preserve cursor position during external updates
      const position = editor.getPosition();
      editor.setValue(rawText);
      if (position) {
        editor.setPosition(position);
      }
    }
  }, [rawText]);

  // Update theme when it changes
  useEffect(() => {
    monaco.editor.setTheme(getMonacoTheme());
  }, [getMonacoTheme]);

  // Update error markers when parseErrors change
  useEffect(() => {
    const model = modelRef.current;
    if (!model) return;

    const markers: monaco.editor.IMarkerData[] = parseErrors.map((error) => ({
      severity: error.severity === 'error'
        ? monaco.MarkerSeverity.Error
        : monaco.MarkerSeverity.Warning,
      message: error.message,
      startLineNumber: error.location?.startLine ?? 1,
      startColumn: error.location?.startColumn ?? 1,
      endLineNumber: error.location?.endLine ?? 1,
      endColumn: error.location?.endColumn ?? 1,
    }));

    monaco.editor.setModelMarkers(model, 'openapi', markers);
  }, [parseErrors]);

  return (
    <div className="h-full w-full" ref={containerRef} />
  );
}
