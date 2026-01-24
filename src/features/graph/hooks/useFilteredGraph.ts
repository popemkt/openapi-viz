import { useMemo } from 'react';
import { useFilterStore, useGraphStore } from '@/stores';
import type { GraphNode, GraphEdge, EndpointNodeData, SchemaNodeData, HttpMethod } from '@/types';

function matchPathPattern(path: string, pattern: string): boolean {
  if (!pattern) return true;

  // Convert wildcard pattern to regex
  // * matches any sequence within a path segment
  // ** matches across path segments
  const regexPattern = pattern
    .replace(/\*\*/g, '___DOUBLE_STAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/___DOUBLE_STAR___/g, '.*');

  try {
    const regex = new RegExp(`^${regexPattern}`, 'i');
    return regex.test(path);
  } catch {
    // Invalid regex, treat as literal match
    return path.toLowerCase().includes(pattern.toLowerCase());
  }
}

function matchesSearch(text: string, query: string): boolean {
  if (!query) return true;
  return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Check if a node matches the current filter criteria.
 * This is extracted for reuse in useMatchingNodeIds hook.
 */
export function nodeMatchesFilters(
  node: GraphNode,
  filters: {
    showEndpoints: boolean;
    showSchemas: boolean;
    methodFilters: HttpMethod[];
    tagFilters: string[];
    pathPattern: string;
    searchQuery: string;
  }
): boolean {
  const { showEndpoints, showSchemas, methodFilters, tagFilters, pathPattern, searchQuery } = filters;

  if (node.type === 'endpoint') {
    const data = node.data as EndpointNodeData;
    const endpoint = data.endpoint;

    // Check endpoint visibility toggle
    if (!showEndpoints) return false;

    // Check method filter
    if (methodFilters.length > 0 && !methodFilters.includes(endpoint.method)) {
      return false;
    }

    // Check tag filter
    if (tagFilters.length > 0 && !endpoint.tags.some((tag) => tagFilters.includes(tag))) {
      return false;
    }

    // Check path pattern
    if (pathPattern && !matchPathPattern(endpoint.path, pathPattern)) {
      return false;
    }

    // Check search query
    if (searchQuery) {
      const searchableText = [
        endpoint.path,
        endpoint.method,
        endpoint.summary || '',
        endpoint.description || '',
        endpoint.operationId || '',
        ...endpoint.tags,
      ].join(' ');

      if (!matchesSearch(searchableText, searchQuery)) {
        return false;
      }
    }

    return true;
  } else if (node.type === 'schema') {
    const data = node.data as SchemaNodeData;
    const schema = data.schema;

    // Check schema visibility toggle
    if (!showSchemas) return false;

    // Check search query
    if (searchQuery) {
      const propertyNames = schema.properties ? Object.keys(schema.properties) : [];
      const searchableText = [schema.name, schema.description || '', ...propertyNames].join(' ');

      if (!matchesSearch(searchableText, searchQuery)) {
        return false;
      }
    }

    return true;
  }

  return true;
}

/**
 * Hook to get the IDs of nodes that match the current filter criteria.
 * Useful for "Select Highlighted" functionality.
 */
export function useMatchingNodeIds(): Set<string> {
  const { showEndpoints, showSchemas, methodFilters, tagFilters, pathPattern, searchQuery } =
    useFilterStore();
  const { nodes, hiddenNodeIds } = useGraphStore();

  return useMemo(() => {
    const matchingIds = new Set<string>();
    const filters = { showEndpoints, showSchemas, methodFilters, tagFilters, pathPattern, searchQuery };

    for (const node of nodes) {
      // Skip manually hidden nodes
      if (hiddenNodeIds.has(node.id)) continue;

      if (nodeMatchesFilters(node, filters)) {
        matchingIds.add(node.id);
      }
    }

    return matchingIds;
  }, [nodes, hiddenNodeIds, showEndpoints, showSchemas, methodFilters, tagFilters, pathPattern, searchQuery]);
}

export function useFilteredGraph(
  nodes: GraphNode[],
  edges: GraphEdge[]
): { filteredNodes: GraphNode[]; filteredEdges: GraphEdge[] } {
  const {
    showEndpoints,
    showSchemas,
    methodFilters,
    tagFilters,
    pathPattern,
    searchQuery,
    filterDisplayMode,
  } = useFilterStore();

  const { hiddenNodeIds } = useGraphStore();

  return useMemo(() => {
    const matchingNodeIds = new Set<string>();
    const filters = { showEndpoints, showSchemas, methodFilters, tagFilters, pathPattern, searchQuery };

    const filteredNodes = nodes.map((node) => {
      // Check if manually hidden first
      const isManuallyHidden = hiddenNodeIds.has(node.id);
      if (isManuallyHidden) {
        return {
          ...node,
          data: { ...node.data, visible: false, dimmed: false },
          hidden: true,
        };
      }

      const matchesFilter = nodeMatchesFilters(node, filters);

      if (matchesFilter) {
        matchingNodeIds.add(node.id);
      }

      // In highlight mode, show all nodes but dim non-matching ones
      // In hide mode, hide non-matching nodes
      const shouldHide = filterDisplayMode === 'hide' && !matchesFilter;
      const shouldDim = filterDisplayMode === 'highlight' && !matchesFilter;

      return {
        ...node,
        data: { ...node.data, visible: matchesFilter, dimmed: shouldDim },
        hidden: shouldHide,
      };
    });

    // Filter edges based on display mode
    // In hide mode: hide edges connecting to hidden nodes
    // In highlight mode: dim edges connecting to dimmed nodes
    const filteredEdges = edges.map((edge): GraphEdge => {
      const sourceMatches = matchingNodeIds.has(edge.source);
      const targetMatches = matchingNodeIds.has(edge.target);
      const bothMatch = sourceMatches && targetMatches;
      const eitherMatch = sourceMatches || targetMatches;

      if (filterDisplayMode === 'hide') {
        return {
          ...edge,
          hidden: !bothMatch,
        };
      } else {
        // highlight mode - dim edges that don't connect two matching nodes
        const shouldDim = !eitherMatch;
        return {
          ...edge,
          hidden: false,
          data: edge.data ? { ...edge.data, dimmed: shouldDim } : undefined,
          style: shouldDim ? { ...edge.style, opacity: 0.2 } : edge.style,
        };
      }
    });

    return { filteredNodes, filteredEdges };
  }, [nodes, edges, showEndpoints, showSchemas, methodFilters, tagFilters, pathPattern, searchQuery, filterDisplayMode, hiddenNodeIds]);
}
