import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HttpMethod } from '@/types';

export type FilterDisplayMode = 'hide' | 'highlight';

interface FilterState {
  showEndpoints: boolean;
  showSchemas: boolean;
  methodFilters: HttpMethod[];
  tagFilters: string[];
  pathPattern: string;
  searchQuery: string;
  filterDisplayMode: FilterDisplayMode;

  toggleEndpoints: () => void;
  toggleSchemas: () => void;
  setMethodFilters: (methods: HttpMethod[]) => void;
  toggleMethod: (method: HttpMethod) => void;
  setTagFilters: (tags: string[]) => void;
  toggleTag: (tag: string) => void;
  setPathPattern: (pattern: string) => void;
  setSearchQuery: (query: string) => void;
  setFilterDisplayMode: (mode: FilterDisplayMode) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      showEndpoints: true,
      showSchemas: true,
      methodFilters: [],
      tagFilters: [],
      pathPattern: '',
      searchQuery: '',
      filterDisplayMode: 'hide' as FilterDisplayMode,

      toggleEndpoints: () =>
        set((state) => ({ showEndpoints: !state.showEndpoints })),

      toggleSchemas: () =>
        set((state) => ({ showSchemas: !state.showSchemas })),

      setMethodFilters: (methods) => set({ methodFilters: methods }),

      toggleMethod: (method) =>
        set((state) => ({
          methodFilters: state.methodFilters.includes(method)
            ? state.methodFilters.filter((m) => m !== method)
            : [...state.methodFilters, method],
        })),

      setTagFilters: (tags) => set({ tagFilters: tags }),

      toggleTag: (tag) =>
        set((state) => ({
          tagFilters: state.tagFilters.includes(tag)
            ? state.tagFilters.filter((t) => t !== tag)
            : [...state.tagFilters, tag],
        })),

      setPathPattern: (pattern) => set({ pathPattern: pattern }),

      setSearchQuery: (query) => set({ searchQuery: query }),

      setFilterDisplayMode: (mode) => set({ filterDisplayMode: mode }),

      resetFilters: () =>
        set({
          showEndpoints: true,
          showSchemas: true,
          methodFilters: [],
          tagFilters: [],
          pathPattern: '',
          searchQuery: '',
          filterDisplayMode: 'hide',
        }),
    }),
    {
      name: 'openapi-viz-filters',
    }
  )
);
