/**
 * Display mode for truncating long names/paths in the graph view
 */
export type DisplayMode = 'full' | 'short' | 'medium';

/**
 * Truncates a dot-separated schema name based on the display mode.
 *
 * Examples for "Force.Mortgages.Evidence.Services.Api.V1.ProvenData.RealEstate.RealEstate":
 * - full: "Force.Mortgages.Evidence.Services.Api.V1.ProvenData.RealEstate.RealEstate"
 * - medium: "RealEstate.RealEstate" (last 2 segments)
 * - short: "RealEstate" (last segment)
 *
 * @param name - The full schema name (dot-separated)
 * @param mode - The display mode
 * @returns The truncated name
 */
export function truncateSchemaName(name: string, mode: DisplayMode): string {
  if (mode === 'full' || !name) {
    return name;
  }

  const segments = name.split('.');

  if (segments.length <= 1) {
    return name;
  }

  if (mode === 'short') {
    return segments[segments.length - 1];
  }

  // medium: last 2 segments
  if (segments.length <= 2) {
    return name;
  }

  return segments.slice(-2).join('.');
}

/**
 * Truncates an endpoint path based on the display mode.
 *
 * Examples for "/api/v1/dossiers/{dossierReference}/proven-data/real-estate":
 * - full: "/api/v1/dossiers/{dossierReference}/proven-data/real-estate"
 * - medium: "…/proven-data/real-estate" (last 2 segments)
 * - short: "…/real-estate" (last segment)
 *
 * @param path - The full endpoint path
 * @param mode - The display mode
 * @returns The truncated path
 */
export function truncateEndpointPath(path: string, mode: DisplayMode): string {
  if (mode === 'full' || !path) {
    return path;
  }

  // Remove leading slash for processing, then split
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const segments = normalizedPath.split('/').filter(Boolean);

  if (segments.length <= 1) {
    return path;
  }

  if (mode === 'short') {
    return `…/${segments[segments.length - 1]}`;
  }

  // medium: last 2 segments
  if (segments.length <= 2) {
    return path;
  }

  return `…/${segments.slice(-2).join('/')}`;
}
