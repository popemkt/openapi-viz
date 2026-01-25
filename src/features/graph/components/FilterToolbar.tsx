import { memo, useState, useEffect, useRef } from 'react';
import {
  XIcon,
  SearchIcon,
  BoxIcon,
  RouteIcon,
  Maximize2Icon,
  SquareIcon,
  MinusIcon,
  EyeOffIcon,
  HighlighterIcon,
  MousePointer2Icon,
  ArrowRightIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  SlidersHorizontalIcon,
  LayoutIcon,
  FilterIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/segmented-control';
import { useFilterStore, useSpecStore, useUIStore, useGraphStore } from '@/stores';
import { useMatchingNodeIds } from '../hooks/useFilteredGraph';
import { HTTP_METHODS, METHOD_COLORS } from '@/constants';
import { cn } from '@/lib/utils';
import type { DisplayMode } from '@/utils/displayUtils';
import type { LayoutDirection, LayoutEngine } from '@/stores/uiStore';
import type { CompactLevel } from '@/stores/uiStore';

// Node visibility options for segmented control
type NodeVisibility = 'all' | 'endpoints' | 'schemas';

const nodeVisibilityOptions: SegmentedControlOption<NodeVisibility>[] = [
  { value: 'all', label: 'All', icon: <RouteIcon className="h-3.5 w-3.5" /> },
  { value: 'endpoints', label: 'Endpoints', icon: <RouteIcon className="h-3.5 w-3.5" /> },
  { value: 'schemas', label: 'Schemas', icon: <BoxIcon className="h-3.5 w-3.5" /> },
];

// Filter mode options for segmented control
const filterModeOptions: SegmentedControlOption<'highlight' | 'hide'>[] = [
  { value: 'highlight', label: 'Highlight', icon: <HighlighterIcon className="h-3.5 w-3.5" /> },
  { value: 'hide', label: 'Hide', icon: <EyeOffIcon className="h-3.5 w-3.5" /> },
];

// Compact level options for segmented control in dropdown
const compactLevelOptions: SegmentedControlOption<CompactLevel>[] = [
  { value: 'normal', label: 'Full', icon: <Maximize2Icon className="h-3.5 w-3.5" /> },
  { value: 'compact', label: 'Compact', icon: <SquareIcon className="h-3.5 w-3.5" /> },
  { value: 'minimal', label: 'Minimal', icon: <MinusIcon className="h-3.5 w-3.5" /> },
];

export const FilterToolbar = memo(function FilterToolbar() {
  const {
    showEndpoints,
    showSchemas,
    methodFilters,
    tagFilters,
    pathPattern,
    searchQuery,
    filterDisplayMode,
    setShowEndpoints,
    setShowSchemas,
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
    setCompactLevel,
    schemaNameDisplayMode,
    setSchemaNameDisplayMode,
    endpointPathDisplayMode,
    setEndpointPathDisplayMode,
    layoutDirection,
    setLayoutDirection,
    rankSpacing,
    setRankSpacing,
    nodeSpacing,
    setNodeSpacing,
    nodeScale,
    setNodeScale,
    layoutEngine,
    setLayoutEngine,
  } = useUIStore();

  const { setSelectedNodeIds, relayoutVisibleNodes } = useGraphStore();

  // Local state for pending layout settings (only applied on "Apply Layout" click)
  const [pendingDirection, setPendingDirection] = useState<LayoutDirection>(layoutDirection);
  const [pendingSpacing, setPendingSpacing] = useState(`${rankSpacing}-${nodeSpacing}`);
  const [pendingEngine, setPendingEngine] = useState<LayoutEngine>(layoutEngine);

  // Get matching (highlighted) node IDs for "Select Highlighted" feature
  const matchingNodeIds = useMatchingNodeIds();

  const availableTags = parsedSpec?.tags.map((t) => t.name) || [];
  const activeFilterCount =
    (methodFilters.length > 0 ? 1 : 0) +
    (tagFilters.length > 0 ? 1 : 0) +
    (pathPattern ? 1 : 0) +
    (searchQuery ? 1 : 0) +
    (!showEndpoints ? 1 : 0) +
    (!showSchemas ? 1 : 0);

  // Derive node visibility value from showEndpoints and showSchemas
  const nodeVisibility: NodeVisibility =
    showEndpoints && showSchemas ? 'all' : showEndpoints ? 'endpoints' : 'schemas';

  const handleNodeVisibilityChange = (value: NodeVisibility) => {
    switch (value) {
      case 'all':
        setShowEndpoints(true);
        setShowSchemas(true);
        break;
      case 'endpoints':
        setShowEndpoints(true);
        setShowSchemas(false);
        break;
      case 'schemas':
        setShowEndpoints(false);
        setShowSchemas(true);
        break;
    }
  };

  // Show "Select Highlighted" button when in highlight mode with active filters
  const showSelectHighlighted = filterDisplayMode === 'highlight' && activeFilterCount > 0;

  const handleSelectHighlighted = () => {
    setSelectedNodeIds(matchingNodeIds);
  };

  const handleApplyLayout = () => {
    // Parse pending spacing
    const [rank, node] = pendingSpacing.split('-').map(Number);

    // Commit pending settings to store
    setLayoutDirection(pendingDirection);
    setRankSpacing(rank);
    setNodeSpacing(node);
    setLayoutEngine(pendingEngine);

    // Apply layout with the new settings
    relayoutVisibleNodes({
      direction: pendingDirection,
      rankSpacing: rank,
      nodeSpacing: node,
    });
  };

  const directionIcons: Record<LayoutDirection, React.ReactNode> = {
    LR: <ArrowRightIcon className="h-4 w-4" />,
    TB: <ArrowDownIcon className="h-4 w-4" />,
    RL: <ArrowLeftIcon className="h-4 w-4" />,
    BT: <ArrowUpIcon className="h-4 w-4" />,
  };

  const directionLabels: Record<LayoutDirection, string> = {
    LR: 'Left to Right',
    TB: 'Top to Bottom',
    RL: 'Right to Left',
    BT: 'Bottom to Top',
  };

  // Track if we need compact mode based on container width
  const [isCompact, setIsCompact] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use ResizeObserver to detect when we need compact mode
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Switch to compact mode when width < 700px
        setIsCompact(entry.contentRect.width < 700);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Compact mode: combine Methods + Tags into a single "Filters" dropdown
  const hasMethodOrTagFilters = methodFilters.length > 0 || tagFilters.length > 0;

  return (
    <div
      ref={containerRef}
      className="border-border bg-card/50 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b px-3 py-2"
    >
      {/* === SECTION 1: Search (always visible, responsive width) === */}
      <div className="relative max-w-[250px] min-w-[140px] flex-1">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder={isCompact ? 'Search...' : 'Search endpoints & schemas...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
      </div>

      {/* Path pattern - hidden in very compact mode, shown in "More" dropdown */}
      {!isCompact && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs whitespace-nowrap">Path:</span>
          <Input
            placeholder="/api/*"
            value={pathPattern}
            onChange={(e) => setPathPattern(e.target.value)}
            className="h-8 w-[100px] font-mono text-sm"
            title="Path pattern (supports * wildcards)"
          />
        </div>
      )}

      {/* Separator */}
      <div className="bg-border h-6 w-px" />

      {/* === SECTION 2: Node Visibility & Filter Mode === */}
      {/* In compact mode: icon-only segmented controls */}
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {!isCompact && (
                <span className="text-muted-foreground text-xs whitespace-nowrap">Show:</span>
              )}
              <SegmentedControl
                size="sm"
                value={nodeVisibility}
                onValueChange={handleNodeVisibilityChange}
                options={nodeVisibilityOptions}
                iconOnly={isCompact}
              />
            </div>
          </TooltipTrigger>
          {isCompact && <TooltipContent>Node visibility: {nodeVisibility}</TooltipContent>}
        </Tooltip>
      </div>

      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1">
              {!isCompact && (
                <span className="text-muted-foreground text-xs whitespace-nowrap">Filter:</span>
              )}
              <SegmentedControl
                size="sm"
                value={filterDisplayMode}
                onValueChange={setFilterDisplayMode}
                options={filterModeOptions}
                iconOnly={isCompact}
              />
            </div>
          </TooltipTrigger>
          {isCompact && <TooltipContent>Filter mode: {filterDisplayMode}</TooltipContent>}
        </Tooltip>
      </div>

      {/* Select Highlighted button - compact in narrow mode */}
      {showSelectHighlighted && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={handleSelectHighlighted}
            >
              <MousePointer2Icon className="h-4 w-4" />
              {!isCompact && <span className="text-xs">Select</span>}
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {matchingNodeIds.size}
              </Badge>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Select {matchingNodeIds.size} highlighted node{matchingNodeIds.size !== 1 ? 's' : ''}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Separator */}
      <div className="bg-border h-6 w-px" />

      {/* === SECTION 3: View & Layout Settings (always dropdowns) === */}
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <SlidersHorizontalIcon className="h-4 w-4" />
                  {!isCompact && <span className="text-xs">View</span>}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            {isCompact && <TooltipContent>View settings</TooltipContent>}
          </Tooltip>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs">Detail Level</DropdownMenuLabel>
            <div className="px-2 py-1.5">
              <SegmentedControl
                size="sm"
                value={compactLevel}
                onValueChange={setCompactLevel}
                options={compactLevelOptions}
                className="w-full"
              />
            </div>
            <DropdownMenuSeparator />
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
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Node Size</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={String(nodeScale)}
              onValueChange={(value) => setNodeScale(Number(value))}
            >
              <DropdownMenuRadioItem value="0.75">Small (75%)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="1">Normal (100%)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="1.25">Large (125%)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="1.5">Extra Large (150%)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <LayoutIcon className="h-4 w-4" />
                  {!isCompact && <span className="text-xs">Layout</span>}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            {isCompact && <TooltipContent>Layout settings</TooltipContent>}
          </Tooltip>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs">Direction</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={pendingDirection}
              onValueChange={(value) => setPendingDirection(value as LayoutDirection)}
            >
              {(['LR', 'TB', 'RL', 'BT'] as LayoutDirection[]).map((dir) => (
                <DropdownMenuRadioItem key={dir} value={dir} className="gap-2">
                  {directionIcons[dir]}
                  <span>{directionLabels[dir]}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Spacing</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={pendingSpacing}
              onValueChange={(value) => setPendingSpacing(value)}
            >
              <DropdownMenuRadioItem value="50-20">Compact</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="100-50">Normal</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="150-80">Spacious</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="200-100">Wide</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Layout Engine</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={pendingEngine}
              onValueChange={(value) => setPendingEngine(value as LayoutEngine)}
            >
              <DropdownMenuRadioItem value="dagre">Dagre (Fast)</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="elk">ELK (Better Routing)</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button size="sm" className="w-full" onClick={handleApplyLayout}>
                Apply Layout
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Separator */}
      <div className="bg-border h-6 w-px" />

      {/* === SECTION 4: Filters (Methods, Tags, Path in compact mode) === */}
      <div className="flex items-center gap-1">
        {/* Compact mode: Combined "Filters" dropdown with Path, Methods, Tags */}
        {isCompact ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <FilterIcon className="h-4 w-4" />
                <span className="text-xs">Filters</span>
                {(hasMethodOrTagFilters || pathPattern) && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {methodFilters.length + tagFilters.length + (pathPattern ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {/* Path pattern in dropdown for compact mode */}
              <DropdownMenuLabel className="text-xs">Path Pattern</DropdownMenuLabel>
              <div className="px-2 py-1.5">
                <Input
                  placeholder="/api/*"
                  value={pathPattern}
                  onChange={(e) => setPathPattern(e.target.value)}
                  className="h-8 font-mono text-sm"
                  title="Path pattern (supports * wildcards)"
                />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs">HTTP Methods</DropdownMenuLabel>
              {HTTP_METHODS.map((method) => {
                const colors = METHOD_COLORS[method];
                return (
                  <DropdownMenuCheckboxItem
                    key={method}
                    checked={methodFilters.includes(method)}
                    onCheckedChange={() => toggleMethod(method)}
                  >
                    <span className={cn('font-mono text-xs uppercase', colors.text)}>{method}</span>
                  </DropdownMenuCheckboxItem>
                );
              })}
              {availableTags.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs">Tags</DropdownMenuLabel>
                  {availableTags.map((tag) => (
                    <DropdownMenuCheckboxItem
                      key={tag}
                      checked={tagFilters.includes(tag)}
                      onCheckedChange={() => toggleTag(tag)}
                    >
                      {tag}
                    </DropdownMenuCheckboxItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          /* Non-compact mode: Separate Methods and Tags dropdowns */
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1">
                  <span className="text-xs">Methods</span>
                  {methodFilters.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
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
                      <span className={cn('font-mono text-xs uppercase', colors.text)}>
                        {method}
                      </span>
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {availableTags.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1">
                    <span className="text-xs">Tags</span>
                    {tagFilters.length > 0 && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
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
          </>
        )}
      </div>

      {/* === Clear Filters Button (only when filters active) === */}
      {activeFilterCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-8 gap-1"
              onClick={resetFilters}
            >
              <XIcon className="h-4 w-4" />
              {!isCompact && <span className="text-xs">Clear</span>}
              <span className="text-xs">({activeFilterCount})</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear all filters</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
});
