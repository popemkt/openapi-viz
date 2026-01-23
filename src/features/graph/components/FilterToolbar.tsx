import { memo } from 'react';
import { FilterIcon, XIcon, SearchIcon, BoxIcon, RouteIcon } from 'lucide-react';
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
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFilterStore, useSpecStore } from '@/stores';
import { HTTP_METHODS, METHOD_COLORS } from '@/constants';
import { cn } from '@/lib/utils';

export const FilterToolbar = memo(function FilterToolbar() {
  const {
    showEndpoints,
    showSchemas,
    methodFilters,
    tagFilters,
    pathPattern,
    searchQuery,
    toggleEndpoints,
    toggleSchemas,
    toggleMethod,
    toggleTag,
    setPathPattern,
    setSearchQuery,
    resetFilters,
  } = useFilterStore();

  const { parsedSpec } = useSpecStore();

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
