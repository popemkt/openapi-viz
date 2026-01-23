import { useCallback, useRef } from 'react';
import { useSpecStore } from '@/stores';
import { exportAsHtml, exportAsPng, exportAsSvg } from '../utils/exportUtils';

export function useExport() {
  const { rawText, parsedSpec, fileName } = useSpecStore();
  const graphRef = useRef<HTMLElement | null>(null);

  const setGraphRef = useCallback((element: HTMLElement | null) => {
    graphRef.current = element;
  }, []);

  const handleExportHtml = useCallback(() => {
    const baseFileName = fileName?.replace(/\.(yaml|yml|json)$/i, '') || 'openapi-spec';
    exportAsHtml(rawText, parsedSpec, `${baseFileName}.html`);
  }, [rawText, parsedSpec, fileName]);

  const handleExportPng = useCallback(async () => {
    const graphElement = document.querySelector('.react-flow') as HTMLElement;
    if (!graphElement) {
      console.error('Graph element not found');
      return;
    }

    const baseFileName = fileName?.replace(/\.(yaml|yml|json)$/i, '') || 'openapi-graph';
    try {
      await exportAsPng(graphElement, `${baseFileName}.png`);
    } catch (error) {
      console.error('Failed to export PNG:', error);
      alert('Failed to export as PNG. Please try again.');
    }
  }, [fileName]);

  const handleExportSvg = useCallback(async () => {
    const graphElement = document.querySelector('.react-flow') as HTMLElement;
    if (!graphElement) {
      console.error('Graph element not found');
      return;
    }

    const baseFileName = fileName?.replace(/\.(yaml|yml|json)$/i, '') || 'openapi-graph';
    try {
      await exportAsSvg(graphElement, `${baseFileName}.svg`);
    } catch (error) {
      console.error('Failed to export SVG:', error);
      alert('Failed to export as SVG. Please try again.');
    }
  }, [fileName]);

  return {
    handleExportHtml,
    handleExportPng,
    handleExportSvg,
    setGraphRef,
  };
}
