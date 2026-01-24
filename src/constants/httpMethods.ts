import type { HttpMethod } from '@/types';

export const HTTP_METHODS: HttpMethod[] = [
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
];

export const METHOD_COLORS: Record<HttpMethod, { bg: string; text: string; border: string }> = {
  get: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  post: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  put: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  delete: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  patch: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  options: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  head: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
};

// Hex colors for minimap (MiniMap requires actual color values, not Tailwind classes)
export const METHOD_HEX_COLORS: Record<HttpMethod, string> = {
  get: '#3b82f6', // blue-500
  post: '#22c55e', // green-500
  put: '#f59e0b', // amber-500
  delete: '#ef4444', // red-500
  patch: '#a855f7', // purple-500
  options: '#6b7280', // gray-500
  head: '#6b7280', // gray-500
};

// Schema node color for minimap
export const SCHEMA_HEX_COLOR = '#64748b'; // slate-500
