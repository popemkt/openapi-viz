import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DisplayMode } from '../utils/displayUtils';

export type ViewMode = 'editor' | 'graph' | 'split';
export type Theme = 'light' | 'dark' | 'system';

interface UIState {
  viewMode: ViewMode;
  splitPosition: number;
  detailPanelOpen: boolean;
  detailPanelHeight: number;
  theme: Theme;

  // Graph view display settings
  schemaNameDisplayMode: DisplayMode;
  endpointPathDisplayMode: DisplayMode;
  compactMode: boolean;
  maxNodeWidth: number;

  setViewMode: (mode: ViewMode) => void;
  setSplitPosition: (position: number) => void;
  toggleDetailPanel: () => void;
  setDetailPanelOpen: (open: boolean) => void;
  setDetailPanelHeight: (height: number) => void;
  setTheme: (theme: Theme) => void;
  setSchemaNameDisplayMode: (mode: DisplayMode) => void;
  setEndpointPathDisplayMode: (mode: DisplayMode) => void;
  setCompactMode: (compact: boolean) => void;
  toggleCompactMode: () => void;
  setMaxNodeWidth: (width: number) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      viewMode: 'split',
      splitPosition: 50,
      detailPanelOpen: false,
      detailPanelHeight: 300,
      theme: 'system',

      // Graph view display settings - default to short mode for compact display
      schemaNameDisplayMode: 'short',
      endpointPathDisplayMode: 'short',
      compactMode: true,
      maxNodeWidth: 250,

      setViewMode: (mode) => set({ viewMode: mode }),

      setSplitPosition: (position) => set({ splitPosition: position }),

      toggleDetailPanel: () =>
        set((state) => ({ detailPanelOpen: !state.detailPanelOpen })),

      setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),

      setDetailPanelHeight: (height) => set({ detailPanelHeight: height }),

      setTheme: (theme) => set({ theme }),

      setSchemaNameDisplayMode: (mode) => set({ schemaNameDisplayMode: mode }),

      setEndpointPathDisplayMode: (mode) =>
        set({ endpointPathDisplayMode: mode }),

      setCompactMode: (compact) => set({ compactMode: compact }),

      toggleCompactMode: () =>
        set((state) => ({ compactMode: !state.compactMode })),

      setMaxNodeWidth: (width) => set({ maxNodeWidth: width }),
    }),
    {
      name: 'openapi-viz-ui',
    }
  )
);
