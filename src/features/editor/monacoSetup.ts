/**
 * Monaco Editor setup for Vite with monaco-yaml support.
 * This file must be imported before any Monaco-related code runs.
 */
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import YamlWorker from 'monaco-yaml/yaml.worker?worker';

// Configure Monaco environment to use the YAML worker
// This must be done before Monaco loads
window.MonacoEnvironment = {
  getWorker(workerId: string, label: string) {
    console.log('[Monaco] getWorker called with workerId:', workerId, 'label:', label);
    // The label for monaco-yaml is 'yaml', and workerId might be 'monaco-yaml/yaml.worker'
    if (label === 'yaml' || workerId.includes('yaml')) {
      console.log('[Monaco] Creating YamlWorker');
      return new YamlWorker();
    }
    // Default editor worker for editorWorkerService
    console.log('[Monaco] Creating EditorWorker');
    return new EditorWorker();
  },
};

// Configure @monaco-editor/react to use our local Monaco instance instead of CDN
loader.config({ monaco });

export { monaco };
