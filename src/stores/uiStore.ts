import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'editor' | 'graph' | 'split';
export type Theme = 'light' | 'dark' | 'system';

interface UIState {
  viewMode: ViewMode;
  splitPosition: number;
  detailPanelOpen: boolean;
  detailPanelHeight: number;
  theme: Theme;

  setViewMode: (mode: ViewMode) => void;
  setSplitPosition: (position: number) => void;
  toggleDetailPanel: () => void;
  setDetailPanelOpen: (open: boolean) => void;
  setDetailPanelHeight: (height: number) => void;
  setTheme: (theme: Theme) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      viewMode: 'split',
      splitPosition: 50,
      detailPanelOpen: false,
      detailPanelHeight: 300,
      theme: 'system',

      setViewMode: (mode) => set({ viewMode: mode }),

      setSplitPosition: (position) => set({ splitPosition: position }),

      toggleDetailPanel: () =>
        set((state) => ({ detailPanelOpen: !state.detailPanelOpen })),

      setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),

      setDetailPanelHeight: (height) => set({ detailPanelHeight: height }),

      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'openapi-viz-ui',
    }
  )
);
