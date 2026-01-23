import Markdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Endpoint, HttpMethod } from '@/types';
import { METHOD_COLORS } from '@/constants';
import { cn } from '@/lib/utils';

interface EndpointDetailProps {
  endpoint: Endpoint;
}

export function EndpointDetail({ endpoint }: EndpointDetailProps) {
  const methodColor = METHOD_COLORS[endpoint.method as HttpMethod];

  return (
    <div className="space-y-4">
      {/* Method and Path */}
      <div className="flex items-center gap-2">
        <Badge className={cn('uppercase font-mono', methodColor.bg, methodColor.text)}>
          {endpoint.method}
        </Badge>
        <code className="text-sm font-mono">{endpoint.path}</code>
        {endpoint.deprecated && (
          <Badge variant="destructive" className="text-xs">
            deprecated
          </Badge>
        )}
      </div>

      {/* Summary */}
      {endpoint.summary && (
        <div>
          <h4 className="text-sm font-medium text-foreground">Summary</h4>
          <p className="text-sm text-muted-foreground mt-1">{endpoint.summary}</p>
        </div>
      )}

      {/* Description */}
      {endpoint.description && (
        <div>
          <h4 className="text-sm font-medium text-foreground">Description</h4>
          <div className="prose prose-sm dark:prose-invert mt-1 max-w-none text-sm text-muted-foreground">
            <Markdown>{endpoint.description}</Markdown>
          </div>
        </div>
      )}

      {/* Operation ID */}
      {endpoint.operationId && (
        <div>
          <h4 className="text-sm font-medium text-foreground">Operation ID</h4>
          <code className="text-xs bg-muted px-1 py-0.5 rounded">{endpoint.operationId}</code>
        </div>
      )}

      {/* Tags */}
      {endpoint.tags.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground">Tags</h4>
          <div className="flex flex-wrap gap-1 mt-1">
            {endpoint.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Parameters */}
      {endpoint.parameters.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground">Parameters</h4>
          <div className="mt-2 space-y-2">
            {endpoint.parameters.map((param) => (
              <div
                key={`${param.in}-${param.name}`}
                className="rounded-md border border-border p-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <code className="font-medium">{param.name}</code>
                  <Badge variant="outline" className="text-[10px]">
                    {param.in}
                  </Badge>
                  {param.required && (
                    <Badge variant="secondary" className="text-[10px] text-amber-600">
                      required
                    </Badge>
                  )}
                </div>
                {param.description && (
                  <p className="text-muted-foreground mt-1">{param.description}</p>
                )}
                {param.schema && (
                  <p className="text-muted-foreground mt-1">
                    Type: <code>{param.schema.type}</code>
                    {param.schema.$ref && (
                      <span> → <code>{param.schema.$ref.split('/').pop()}</code></span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Body */}
      {endpoint.requestBody && (
        <div>
          <h4 className="text-sm font-medium text-foreground">Request Body</h4>
          {endpoint.requestBody.description && (
            <p className="text-xs text-muted-foreground mt-1">{endpoint.requestBody.description}</p>
          )}
          {endpoint.requestBody.required && (
            <Badge variant="secondary" className="text-[10px] text-amber-600 mt-1">
              required
            </Badge>
          )}
          <div className="mt-2 space-y-1">
            {Object.entries(endpoint.requestBody.content).map(([mediaType, content]) => (
              <div key={mediaType} className="text-xs">
                <code className="bg-muted px-1 py-0.5 rounded">{mediaType}</code>
                {content.schema?.$ref && (
                  <span className="ml-2">
                    → <code>{content.schema.$ref.split('/').pop()}</code>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Responses */}
      <div>
        <h4 className="text-sm font-medium text-foreground">Responses</h4>
        <div className="mt-2 space-y-2">
          {Object.entries(endpoint.responses).map(([statusCode, response]) => (
            <div
              key={statusCode}
              className="rounded-md border border-border p-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'font-mono',
                    statusCode.startsWith('2') && 'text-green-600 border-green-300',
                    statusCode.startsWith('4') && 'text-amber-600 border-amber-300',
                    statusCode.startsWith('5') && 'text-red-600 border-red-300'
                  )}
                >
                  {statusCode}
                </Badge>
                <span className="text-muted-foreground">{response.description}</span>
              </div>
              {response.content && (
                <div className="mt-1 space-y-1">
                  {Object.entries(response.content).map(([mediaType, content]) => (
                    <div key={mediaType} className="text-muted-foreground">
                      <code className="bg-muted px-1 py-0.5 rounded">{mediaType}</code>
                      {content.schema?.$ref && (
                        <span className="ml-2">
                          → <code>{content.schema.$ref.split('/').pop()}</code>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
