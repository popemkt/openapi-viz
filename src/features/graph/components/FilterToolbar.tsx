import { memo } from 'react';
import {
  FilterIcon,
  XIcon,
  SearchIcon,
  BoxIcon,
  RouteIcon,
  Maximize2Icon,
  SquareIcon,
  MinusIcon,
  SettingsIcon,
  EyeOffIcon,
  HighlighterIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFilterStore, useSpecStore, useUIStore } from '@/stores';
import { HTTP_METHODS, METHOD_COLORS } from '@/constants';
import { cn } from '@/lib/utils';
import type { DisplayMode } from '@/utils/displayUtils';

export const FilterToolbar = memo(function FilterToolbar() {
  const {
    showEndpoints,
    showSchemas,
    methodFilters,
    tagFilters,
    pathPattern,
    searchQuery,
    filterDisplayMode,
    toggleEndpoints,
    toggleSchemas,
    toggleMethod,
    toggleTag,
    setPathPattern,
    setSearchQuery,
    setFilterDisplayMode,
    resetFilters,
  } = useFilterStore();

  const { parsedSpec } = useSpecStore();

  const {
    compactLevel,
    cycleCompactLevel,
    schemaNameDisplayMode,
    setSchemaNameDisplayMode,
    endpointPathDisplayMode,
    setEndpointPathDisplayMode,
  } = useUIStore();

  const availableTags = parsedSpec?.tags.map((t) => t.name) || [];
  const activeFilterCount =
    (methodFilters.length > 0 ? 1 : 0) +
    (tagFilters.length > 0 ? 1 : 0) +
    (pathPattern ? 1 : 0) +
    (searchQuery ? 1 : 0) +
    (!showEndpoints ? 1 : 0) +
    (!showSchemas ? 1 : 0);

  return (
    <div className="flex items-center gap-2 border-b border-border bg-card/50 px-3 py-2">
      {/* Search input */}
      <div className="relative flex-1 max-w-xs">
        <SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search endpoints & schemas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
      </div>

      {/* Path pattern */}
      <div className="relative max-w-[160px]">
        <Input
          placeholder="/api/*"
          value={pathPattern}
          onChange={(e) => setPathPattern(e.target.value)}
          className="h-8 text-sm font-mono"
          title="Path pattern (supports * wildcards)"
        />
      </div>

      {/* Toggle endpoints */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Toggle
            pressed={showEndpoints}
            onPressedChange={toggleEndpoints}
            size="sm"
            aria-label="Toggle endpoints"
          >
            <RouteIcon className="h-4 w-4" />
          </Toggle>
        </TooltipTrigger>
        <TooltipContent>Show Endpoints</TooltipContent>
      </Tooltip>

      {/* Toggle schemas */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Toggle
            pressed={showSchemas}
            onPressedChange={toggleSchemas}
            size="sm"
            aria-label="Toggle schemas"
          >
            <BoxIcon className="h-4 w-4" />
          </Toggle>
        </TooltipTrigger>
        <TooltipContent>Show Schemas</TooltipContent>
      </Tooltip>

      {/* Filter display mode toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Toggle
            pressed={filterDisplayMode === 'highlight'}
            onPressedChange={(pressed) => setFilterDisplayMode(pressed ? 'highlight' : 'hide')}
            size="sm"
            aria-label="Toggle filter display mode"
          >
            {filterDisplayMode === 'highlight' ? (
              <HighlighterIcon className="h-4 w-4" />
            ) : (
              <EyeOffIcon className="h-4 w-4" />
            )}
          </Toggle>
        </TooltipTrigger>
        <TooltipContent>
          {filterDisplayMode === 'highlight'
            ? 'Highlight mode: dim non-matching (click to hide)'
            : 'Hide mode: hide non-matching (click to highlight)'}
        </TooltipContent>
      </Tooltip>

      {/* Separator */}
      <div className="h-6 w-px bg-border" />

      {/* Compact level toggle - cycles through normal/compact/minimal */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={cycleCompactLevel}
            aria-label="Cycle compact level"
          >
            {compactLevel === 'normal' && <Maximize2Icon className="h-4 w-4" />}
            {compactLevel === 'compact' && <SquareIcon className="h-4 w-4" />}
            {compactLevel === 'minimal' && <MinusIcon className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {compactLevel === 'normal' && 'Normal: Full details (click for compact)'}
          {compactLevel === 'compact' && 'Compact: Truncated names (click for minimal)'}
          {compactLevel === 'minimal' && 'Minimal: Headers only (click for normal)'}
        </TooltipContent>
      </Tooltip>

      {/* Display settings dropdown */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <SettingsIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Display settings</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs">Schema Name Display</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={schemaNameDisplayMode}
            onValueChange={(value) => setSchemaNameDisplayMode(value as DisplayMode)}
          >
            <DropdownMenuRadioItem value="full">Full name</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="medium">Medium (last 2 parts)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="short">Short (last part only)</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs">Endpoint Path Display</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={endpointPathDisplayMode}
            onValueChange={(value) => setEndpointPathDisplayMode(value as DisplayMode)}
          >
            <DropdownMenuRadioItem value="full">Full path</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="medium">Medium (last 2 segments)</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="short">Short (last segment only)</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Separator */}
      <div className="h-6 w-px bg-border" />

      {/* Method filter dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            Methods
            {methodFilters.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {methodFilters.length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel className="text-xs">HTTP Methods</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {HTTP_METHODS.map((method) => {
            const colors = METHOD_COLORS[method];
            return (
              <DropdownMenuCheckboxItem
                key={method}
                checked={methodFilters.includes(method)}
                onCheckedChange={() => toggleMethod(method)}
              >
                <span className={cn('uppercase font-mono text-xs', colors.text)}>
                  {method}
                </span>
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Tags filter dropdown */}
      {availableTags.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              Tags
              {tagFilters.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {tagFilters.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
            <DropdownMenuLabel className="text-xs">Tags</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableTags.map((tag) => (
              <DropdownMenuCheckboxItem
                key={tag}
                checked={tagFilters.includes(tag)}
                onCheckedChange={() => toggleTag(tag)}
              >
                {tag}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Active filters indicator and reset */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-xs">
            <FilterIcon className="mr-1 h-3 w-3" />
            {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={resetFilters}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear all filters</TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
});
