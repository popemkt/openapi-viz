import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DisplayMode } from '../utils/displayUtils';

export type ViewMode = 'editor' | 'graph' | 'split';
export type Theme = 'light' | 'dark' | 'system';
export type CompactLevel = 'normal' | 'compact' | 'minimal';
export type LayoutDirection = 'LR' | 'TB' | 'RL' | 'BT';
export type LayoutEngine = 'dagre' | 'elk';

interface UIState {
  viewMode: ViewMode;
  splitPosition: number;
  detailPanelOpen: boolean;
  detailPanelHeight: number;
  inheritancePanelOpen: boolean;
  theme: Theme;

  // Graph view display settings
  schemaNameDisplayMode: DisplayMode;
  endpointPathDisplayMode: DisplayMode;
  compactLevel: CompactLevel;
  maxNodeWidth: number;

  // Layout settings
  layoutDirection: LayoutDirection;
  rankSpacing: number;
  nodeSpacing: number;

  // Node scale setting
  nodeScale: number;

  // Layout engine selection
  layoutEngine: LayoutEngine;

  setViewMode: (mode: ViewMode) => void;
  setSplitPosition: (position: number) => void;
  toggleDetailPanel: () => void;
  setDetailPanelOpen: (open: boolean) => void;
  setDetailPanelHeight: (height: number) => void;
  toggleInheritancePanel: () => void;
  setInheritancePanelOpen: (open: boolean) => void;
  setTheme: (theme: Theme) => void;
  setSchemaNameDisplayMode: (mode: DisplayMode) => void;
  setEndpointPathDisplayMode: (mode: DisplayMode) => void;
  setCompactLevel: (level: CompactLevel) => void;
  cycleCompactLevel: () => void;
  setMaxNodeWidth: (width: number) => void;
  setLayoutDirection: (direction: LayoutDirection) => void;
  setRankSpacing: (spacing: number) => void;
  setNodeSpacing: (spacing: number) => void;
  setNodeScale: (scale: number) => void;
  setLayoutEngine: (engine: LayoutEngine) => void;
}

const COMPACT_LEVEL_ORDER: CompactLevel[] = ['normal', 'compact', 'minimal'];

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      viewMode: 'split',
      splitPosition: 50,
      detailPanelOpen: false,
      detailPanelHeight: 300,
      inheritancePanelOpen: false,
      theme: 'system',

      // Graph view display settings - default to compact mode
      schemaNameDisplayMode: 'short',
      endpointPathDisplayMode: 'short',
      compactLevel: 'compact',
      maxNodeWidth: 250,

      // Layout settings - defaults match Dagre defaults
      layoutDirection: 'LR',
      rankSpacing: 100,
      nodeSpacing: 50,

      // Node scale - default is 1.0 (100%)
      nodeScale: 1,

      // Layout engine - default is Dagre
      layoutEngine: 'dagre',

      setViewMode: (mode) => set({ viewMode: mode }),

      setSplitPosition: (position) => set({ splitPosition: position }),

      toggleDetailPanel: () => set((state) => ({ detailPanelOpen: !state.detailPanelOpen })),

      setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),

      setDetailPanelHeight: (height) => set({ detailPanelHeight: height }),

      toggleInheritancePanel: () => set((state) => ({ inheritancePanelOpen: !state.inheritancePanelOpen })),

      setInheritancePanelOpen: (open) => set({ inheritancePanelOpen: open }),

      setTheme: (theme) => set({ theme }),

      setSchemaNameDisplayMode: (mode) => set({ schemaNameDisplayMode: mode }),

      setEndpointPathDisplayMode: (mode) => set({ endpointPathDisplayMode: mode }),

      setCompactLevel: (level) => set({ compactLevel: level }),

      cycleCompactLevel: () =>
        set((state) => {
          const currentIndex = COMPACT_LEVEL_ORDER.indexOf(state.compactLevel);
          const nextIndex = (currentIndex + 1) % COMPACT_LEVEL_ORDER.length;
          return { compactLevel: COMPACT_LEVEL_ORDER[nextIndex] };
        }),

      setMaxNodeWidth: (width) => set({ maxNodeWidth: width }),

      setLayoutDirection: (direction) => set({ layoutDirection: direction }),

      setRankSpacing: (spacing) => set({ rankSpacing: spacing }),

      setNodeSpacing: (spacing) => set({ nodeSpacing: spacing }),

      setNodeScale: (scale) => set({ nodeScale: scale }),

      setLayoutEngine: (engine) => set({ layoutEngine: engine }),
    }),
    {
      name: 'openapi-viz-ui',
    }
  )
);
