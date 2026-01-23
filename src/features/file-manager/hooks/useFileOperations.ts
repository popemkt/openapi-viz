import { useCallback, useRef } from 'react';
import { useSpecStore } from '@/stores';
import { NEW_SPEC_TEMPLATE } from '@/constants';

export function useFileOperations() {
  const { rawText, loadFile, markSaved, fileName, isDirty } = useSpecStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleNew = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to create a new file?');
      if (!confirmed) return;
    }
    loadFile(NEW_SPEC_TEMPLATE, 'new-api.yaml');
  }, [isDirty, loadFile]);

  const handleOpen = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to open a different file?');
      if (!confirmed) return;
    }

    // Create a hidden file input and trigger it
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const content = await file.text();
        loadFile(content, file.name);
      } catch (error) {
        console.error('Error reading file:', error);
        alert('Error reading file. Please try again.');
      }
    };
    input.click();
  }, [isDirty, loadFile]);

  const handleSave = useCallback(() => {
    const blob = new Blob([rawText], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'openapi-spec.yaml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    markSaved();
  }, [rawText, fileName, markSaved]);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files[0];
      if (!file) return;

      // Check file type
      const validTypes = ['.yaml', '.yml', '.json'];
      const isValidType = validTypes.some((ext) => file.name.toLowerCase().endsWith(ext));
      if (!isValidType) {
        alert('Please drop a YAML or JSON file.');
        return;
      }

      if (isDirty) {
        const confirmed = window.confirm('You have unsaved changes. Are you sure you want to open a different file?');
        if (!confirmed) return;
      }

      try {
        const content = await file.text();
        loadFile(content, file.name);
      } catch (error) {
        console.error('Error reading file:', error);
        alert('Error reading file. Please try again.');
      }
    },
    [isDirty, loadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return {
    handleNew,
    handleOpen,
    handleSave,
    handleDrop,
    handleDragOver,
    fileInputRef,
  };
}
