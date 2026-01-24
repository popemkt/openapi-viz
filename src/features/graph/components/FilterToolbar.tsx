import { memo } from 'react';
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
import type { LayoutDirection } from '@/stores/uiStore';
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
  } = useUIStore();

  const { setSelectedNodeIds, relayoutVisibleNodes } = useGraphStore();

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
    relayoutVisibleNodes({
      direction: layoutDirection,
      rankSpacing,
      nodeSpacing,
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

  return (
    <div className="flex items-center gap-2 border-b border-border bg-card/50 px-3 py-2">
      {/* === SECTION 1: Search & Path Filter === */}
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search endpoints & schemas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>

        {/* Path pattern with label */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Path:</span>
          <Input
            placeholder="/api/*"
            value={pathPattern}
            onChange={(e) => setPathPattern(e.target.value)}
            className="h-8 w-[120px] text-sm font-mono"
            title="Path pattern (supports * wildcards)"
          />
        </div>
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-border" />

      {/* === SECTION 2: Node Visibility & Filter Mode === */}
      <div className="flex items-center gap-2">
        {/* Node type visibility - segmented control */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Show:</span>
          <SegmentedControl
            size="sm"
            value={nodeVisibility}
            onValueChange={handleNodeVisibilityChange}
            options={nodeVisibilityOptions}
          />
        </div>

        {/* Filter mode - segmented control */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Filter:</span>
          <SegmentedControl
            size="sm"
            value={filterDisplayMode}
            onValueChange={setFilterDisplayMode}
            options={filterModeOptions}
          />
        </div>

        {/* Select Highlighted button - visible in highlight mode with active filters */}
        {showSelectHighlighted && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={handleSelectHighlighted}
              >
                <MousePointer2Icon className="h-4 w-4" />
                <span className="text-xs">Select</span>
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
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-border" />

      {/* === SECTION 3: View & Layout Settings === */}
      <div className="flex items-center gap-1">
        {/* View settings dropdown - combines compact level and display settings */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <SlidersHorizontalIcon className="h-4 w-4" />
              <span className="text-xs">View</span>
            </Button>
          </DropdownMenuTrigger>
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

        {/* Layout settings dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <LayoutIcon className="h-4 w-4" />
              <span className="text-xs">Layout</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs">Direction</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={layoutDirection}
              onValueChange={(value) => setLayoutDirection(value as LayoutDirection)}
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
              value={`${rankSpacing}-${nodeSpacing}`}
              onValueChange={(value) => {
                const [rank, node] = value.split('-').map(Number);
                setRankSpacing(rank);
                setNodeSpacing(node);
              }}
            >
              <DropdownMenuRadioItem value="50-20">Compact</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="100-50">Normal</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="150-80">Spacious</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="200-100">Wide</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                size="sm"
                className="w-full"
                onClick={handleApplyLayout}
              >
                Apply Layout
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-border" />

      {/* === SECTION 4: HTTP Methods & Tags Filters === */}
      <div className="flex items-center gap-1">
        {/* Method filter dropdown */}
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
      </div>

      {/* === Clear Filters Button (only when filters active) === */}
      {activeFilterCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={resetFilters}
            >
              <XIcon className="h-4 w-4" />
              <span className="text-xs">Clear ({activeFilterCount})</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear all filters</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
});
