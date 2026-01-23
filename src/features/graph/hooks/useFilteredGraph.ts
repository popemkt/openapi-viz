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
  } = useFilterStore();

  return useMemo(() => {
    const visibleNodeIds = new Set<string>();

    const filteredNodes = nodes.map((node) => {
      let visible = true;

      if (node.type === 'endpoint') {
        const data = node.data as EndpointNodeData;
        const endpoint = data.endpoint;

        // Check endpoint visibility toggle
        if (!showEndpoints) {
          visible = false;
        }

        // Check method filter
        if (visible && methodFilters.length > 0) {
          if (!methodFilters.includes(endpoint.method)) {
            visible = false;
          }
        }

        // Check tag filter
        if (visible && tagFilters.length > 0) {
          if (!endpoint.tags.some((tag) => tagFilters.includes(tag))) {
            visible = false;
          }
        }

        // Check path pattern
        if (visible && pathPattern) {
          if (!matchPathPattern(endpoint.path, pathPattern)) {
            visible = false;
          }
        }

        // Check search query
        if (visible && searchQuery) {
          const searchableText = [
            endpoint.path,
            endpoint.method,
            endpoint.summary || '',
            endpoint.description || '',
            endpoint.operationId || '',
            ...endpoint.tags,
          ].join(' ');

          if (!matchesSearch(searchableText, searchQuery)) {
            visible = false;
          }
        }
      } else if (node.type === 'schema') {
        const data = node.data as SchemaNodeData;
        const schema = data.schema;

        // Check schema visibility toggle
        if (!showSchemas) {
          visible = false;
        }

        // Check search query
        if (visible && searchQuery) {
          const propertyNames = schema.properties
            ? Object.keys(schema.properties)
            : [];
          const searchableText = [
            schema.name,
            schema.description || '',
            ...propertyNames,
          ].join(' ');

          if (!matchesSearch(searchableText, searchQuery)) {
            visible = false;
          }
        }
      }

      if (visible) {
        visibleNodeIds.add(node.id);
      }

      return {
        ...node,
        data: { ...node.data, visible },
        hidden: !visible,
      };
    });

    // Filter edges to only show connections between visible nodes
    const filteredEdges = edges.map((edge) => ({
      ...edge,
      hidden: !visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target),
    }));

    return { filteredNodes, filteredEdges };
  }, [nodes, edges, showEndpoints, showSchemas, methodFilters, tagFilters, pathPattern, searchQuery]);
}
