import { useMemo } from 'react';
import { useFilterStore } from '@/stores';
import type { GraphNode, GraphEdge, EndpointNodeData, SchemaNodeData } from '@/types';

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

  return useMemo(() => {
    const matchingNodeIds = new Set<string>();

    const filteredNodes = nodes.map((node) => {
      let matchesFilter = true;

      if (node.type === 'endpoint') {
        const data = node.data as EndpointNodeData;
        const endpoint = data.endpoint;

        // Check endpoint visibility toggle
        if (!showEndpoints) {
          matchesFilter = false;
        }

        // Check method filter
        if (matchesFilter && methodFilters.length > 0) {
          if (!methodFilters.includes(endpoint.method)) {
            matchesFilter = false;
          }
        }

        // Check tag filter
        if (matchesFilter && tagFilters.length > 0) {
          if (!endpoint.tags.some((tag) => tagFilters.includes(tag))) {
            matchesFilter = false;
          }
        }

        // Check path pattern
        if (matchesFilter && pathPattern) {
          if (!matchPathPattern(endpoint.path, pathPattern)) {
            matchesFilter = false;
          }
        }

        // Check search query
        if (matchesFilter && searchQuery) {
          const searchableText = [
            endpoint.path,
            endpoint.method,
            endpoint.summary || '',
            endpoint.description || '',
            endpoint.operationId || '',
            ...endpoint.tags,
          ].join(' ');

          if (!matchesSearch(searchableText, searchQuery)) {
            matchesFilter = false;
          }
        }
      } else if (node.type === 'schema') {
        const data = node.data as SchemaNodeData;
        const schema = data.schema;

        // Check schema visibility toggle
        if (!showSchemas) {
          matchesFilter = false;
        }

        // Check search query
        if (matchesFilter && searchQuery) {
          const propertyNames = schema.properties
            ? Object.keys(schema.properties)
            : [];
          const searchableText = [
            schema.name,
            schema.description || '',
            ...propertyNames,
          ].join(' ');

          if (!matchesSearch(searchableText, searchQuery)) {
            matchesFilter = false;
          }
        }
      }

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
  }, [nodes, edges, showEndpoints, showSchemas, methodFilters, tagFilters, pathPattern, searchQuery, filterDisplayMode]);
}
