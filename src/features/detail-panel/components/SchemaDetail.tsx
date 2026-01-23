import Markdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Schema, SchemaProperty } from '@/types';
import { cn } from '@/lib/utils';

interface SchemaDetailProps {
  schema: Schema;
}

function PropertyRow({ name, prop, level = 0 }: { name: string; prop: SchemaProperty; level?: number }) {
  return (
    <div
      className={cn('rounded-md border border-border p-2 text-xs', level > 0 && 'ml-4 border-l-2')}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <code className="font-medium">{name}</code>
        <Badge variant="outline" className="text-[10px]">
          {prop.type}
        </Badge>
        {prop.format && (
          <Badge variant="secondary" className="text-[10px]">
            {prop.format}
          </Badge>
        )}
        {prop.required && (
          <Badge variant="secondary" className="text-[10px] text-amber-600">
            required
          </Badge>
        )}
        {prop.$ref && (
          <Badge variant="outline" className="text-[10px] text-blue-600">
            → {prop.$ref.split('/').pop()}
          </Badge>
        )}
      </div>
      {prop.description && (
        <p className="text-muted-foreground mt-1">{prop.description}</p>
      )}
      {prop.enum && prop.enum.length > 0 && (
        <div className="mt-1">
          <span className="text-muted-foreground">Enum: </span>
          {prop.enum.map((val, i) => (
            <code key={i} className="bg-muted px-1 py-0.5 rounded mx-0.5">
              {String(val)}
            </code>
          ))}
        </div>
      )}
    </div>
  );
}

export function SchemaDetail({ schema }: SchemaDetailProps) {
  const propertyCount = schema.properties ? Object.keys(schema.properties).length : 0;
  const requiredCount = schema.required?.length || 0;

  return (
    <div className="space-y-4">
      {/* Name and Type */}
      <div className="flex items-center gap-2">
        <code className="text-sm font-mono font-medium">{schema.name}</code>
        <Badge variant="outline">{schema.type}</Badge>
      </div>

      {/* Description */}
      {schema.description && (
        <div>
          <h4 className="text-sm font-medium text-foreground">Description</h4>
          <div className="prose prose-sm dark:prose-invert mt-1 max-w-none text-sm text-muted-foreground">
            <Markdown>{schema.description}</Markdown>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{propertyCount} properties</span>
        <span>{requiredCount} required</span>
      </div>

      {/* Enum Values */}
      {schema.enum && schema.enum.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground">Enum Values</h4>
          <div className="flex flex-wrap gap-1 mt-2">
            {schema.enum.map((val, i) => (
              <code key={i} className="bg-muted px-2 py-1 rounded text-xs">
                {String(val)}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Composition (allOf, oneOf, anyOf) */}
      {schema.allOf && schema.allOf.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground">All Of</h4>
          <div className="flex flex-wrap gap-1 mt-1">
            {schema.allOf.map((s, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {s.$ref ? s.$ref.split('/').pop() : s.type}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {schema.oneOf && schema.oneOf.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground">One Of</h4>
          <div className="flex flex-wrap gap-1 mt-1">
            {schema.oneOf.map((s, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {s.$ref ? s.$ref.split('/').pop() : s.type}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {schema.anyOf && schema.anyOf.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground">Any Of</h4>
          <div className="flex flex-wrap gap-1 mt-1">
            {schema.anyOf.map((s, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {s.$ref ? s.$ref.split('/').pop() : s.type}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Properties */}
      {schema.properties && Object.keys(schema.properties).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground">Properties</h4>
          <div className="mt-2 space-y-2">
            {Object.entries(schema.properties).map(([name, prop]: [string, SchemaProperty]) => (
              <PropertyRow key={name} name={name} prop={prop} />
            ))}
          </div>
        </div>
      )}

      {/* Array Items */}
      {schema.items && (
        <div>
          <h4 className="text-sm font-medium text-foreground">Array Items</h4>
          <div className="mt-2 rounded-md border border-border p-2 text-xs">
            <Badge variant="outline" className="text-[10px]">
              {schema.items.type}
            </Badge>
            {schema.items.$ref && (
              <Badge variant="outline" className="text-[10px] text-blue-600 ml-1">
                → {schema.items.$ref.split('/').pop()}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
