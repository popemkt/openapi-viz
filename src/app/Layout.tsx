import type { ReactNode } from 'react';
import {
  FileIcon,
  SaveIcon,
  PlusIcon,
  DownloadIcon,
  PanelLeftIcon,
  ColumnsIcon,
  PanelRightIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  LoaderIcon,
  ChevronDownIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/segmented-control';
import { useUIStore, type ViewMode } from '@/stores';
import { useSpecStore } from '@/stores';
import { useFileOperations } from '@/features/file-manager';
import { useExport } from '@/features/export';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { viewMode, setViewMode, theme, setTheme } = useUIStore();
  const { fileName, isDirty, parseErrors, isLoading, parsedSpec } = useSpecStore();
  const { handleNew, handleOpen, handleSave, handleDrop, handleDragOver } = useFileOperations();
  const { handleExportHtml, handleExportPng, handleExportSvg } = useExport();

  const errorCount = parseErrors.filter((e) => e.severity === 'error').length;
  const warningCount = parseErrors.filter((e) => e.severity === 'warning').length;

  const themeIcon = {
    light: <SunIcon className="h-4 w-4" />,
    dark: <MoonIcon className="h-4 w-4" />,
    system: <MonitorIcon className="h-4 w-4" />,
  };

  const viewModeOptions: SegmentedControlOption<ViewMode>[] = [
    { value: 'editor', label: 'Editor', icon: <PanelLeftIcon className="h-4 w-4" /> },
    { value: 'split', label: 'Split', icon: <ColumnsIcon className="h-4 w-4" /> },
    { value: 'graph', label: 'Graph', icon: <PanelRightIcon className="h-4 w-4" /> },
  ];

  return (
    <div
      className="flex h-screen flex-col bg-background"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Toolbar */}
      <header className="flex h-12 items-center border-b border-border bg-card px-4">
        {/* App title and file name */}
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-semibold text-foreground">OpenAPI Viz</h1>
          {fileName && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-sm text-muted-foreground">{fileName}</span>
            </>
          )}
          {isDirty && (
            <Badge variant="secondary" className="text-xs">
              Unsaved
            </Badge>
          )}
        </div>

        {/* Parse status - simplified with icon + hover for details */}
        <div className="ml-4 flex items-center gap-1.5">
          {isLoading && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                </div>
              </TooltipTrigger>
              <TooltipContent>Parsing specification...</TooltipContent>
            </Tooltip>
          )}
          {!isLoading && errorCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex cursor-help items-center gap-1 text-destructive">
                  <AlertCircleIcon className="h-4 w-4" />
                  <span className="text-xs font-medium">{errorCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="mb-1 font-medium">{errorCount} parse error{errorCount > 1 ? 's' : ''}</p>
                {parseErrors
                  .filter((e) => e.severity === 'error')
                  .slice(0, 3)
                  .map((e, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{e.message}</p>
                  ))}
                {errorCount > 3 && (
                  <p className="text-xs text-muted-foreground">...and {errorCount - 3} more</p>
                )}
              </TooltipContent>
            </Tooltip>
          )}
          {!isLoading && warningCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex cursor-help items-center gap-1 text-amber-600">
                  <AlertCircleIcon className="h-4 w-4" />
                  <span className="text-xs font-medium">{warningCount}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="mb-1 font-medium">{warningCount} warning{warningCount > 1 ? 's' : ''}</p>
                {parseErrors
                  .filter((e) => e.severity === 'warning')
                  .slice(0, 3)
                  .map((e, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{e.message}</p>
                  ))}
                {warningCount > 3 && (
                  <p className="text-xs text-muted-foreground">...and {warningCount - 3} more</p>
                )}
              </TooltipContent>
            </Tooltip>
          )}
          {!isLoading && errorCount === 0 && parsedSpec && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex cursor-help items-center gap-1 text-green-600">
                  <CheckCircleIcon className="h-4 w-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {parsedSpec.endpoints.length} endpoints, {parsedSpec.schemas.length} schemas
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* File operations - with text labels */}
        <div className="ml-4 flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleNew} className="gap-1.5">
            <PlusIcon className="h-4 w-4" />
            <span className="text-xs">New</span>
          </Button>

          <Button variant="ghost" size="sm" onClick={handleOpen} className="gap-1.5">
            <FileIcon className="h-4 w-4" />
            <span className="text-xs">Open</span>
          </Button>

          <Button variant="ghost" size="sm" onClick={handleSave} className="gap-1.5">
            <SaveIcon className="h-4 w-4" />
            <span className="text-xs">Save</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <DownloadIcon className="h-4 w-4" />
                <span className="text-xs">Export</span>
                <ChevronDownIcon className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleExportHtml}>Export as HTML</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPng}>Export as PNG</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportSvg}>Export as SVG</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View mode toggle - with labeled segmented control */}
        <SegmentedControl
          value={viewMode}
          onValueChange={setViewMode}
          options={viewModeOptions}
          size="sm"
          className="mr-4"
        />

        {/* Theme toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              {themeIcon[theme]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <SunIcon className="mr-2 h-4 w-4" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <MoonIcon className="mr-2 h-4 w-4" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <MonitorIcon className="mr-2 h-4 w-4" />
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Main content */}
      <main className="flex flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
