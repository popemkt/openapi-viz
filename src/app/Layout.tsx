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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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

        {/* Parse status */}
        <div className="ml-4 flex items-center gap-2">
          {isLoading && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <LoaderIcon className="h-4 w-4 animate-spin" />
              <span className="text-xs">Parsing...</span>
            </div>
          )}
          {!isLoading && errorCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-destructive">
                  <AlertCircleIcon className="h-4 w-4" />
                  <span className="text-xs">{errorCount} error{errorCount > 1 ? 's' : ''}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {parseErrors.slice(0, 3).map((e, i) => (
                  <div key={i} className="text-xs">{e.message}</div>
                ))}
                {parseErrors.length > 3 && (
                  <div className="text-xs">...and {parseErrors.length - 3} more</div>
                )}
              </TooltipContent>
            </Tooltip>
          )}
          {!isLoading && errorCount === 0 && parsedSpec && (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircleIcon className="h-4 w-4" />
              <span className="text-xs">
                {parsedSpec.endpoints.length} endpoints, {parsedSpec.schemas.length} schemas
              </span>
            </div>
          )}
          {!isLoading && warningCount > 0 && (
            <Badge variant="outline" className="text-xs text-amber-600">
              {warningCount} warning{warningCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* File operations */}
        <div className="ml-4 flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={handleNew}>
                <PlusIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={handleOpen}>
                <FileIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={handleSave}>
                <SaveIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <DownloadIcon className="h-4 w-4" />
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

        {/* View mode toggle */}
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value as ViewMode)}
          className="mr-4"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem value="editor" aria-label="Editor only">
                <PanelLeftIcon className="h-4 w-4" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>Editor Only</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem value="split" aria-label="Split view">
                <ColumnsIcon className="h-4 w-4" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>Split View</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem value="graph" aria-label="Graph only">
                <PanelRightIcon className="h-4 w-4" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>Graph Only</TooltipContent>
          </Tooltip>
        </ToggleGroup>

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
