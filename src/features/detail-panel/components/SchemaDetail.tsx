import Markdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Schema, SchemaProperty, Relationship } from '@/types';
import { cn } from '@/lib/utils';
import { EDGE_COLORS } from '@/constants/colors';
import { ArrowRightIcon, ArrowLeftIcon, TagIcon } from 'lucide-react';

interface SchemaDetailProps {
  schema: Schema;
  incomingRelationships?: Relationship[];
  outgoingRelationships?: Relationship[];
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

function formatRelationshipType(type: string): string {
  const typeLabels: Record<string, string> = {
    'endpoint-request-body': 'Request Body',
    'endpoint-response': 'Response',
    'endpoint-parameter': 'Parameter',
    'schema-allOf': 'allOf',
    'schema-oneOf': 'oneOf',
    'schema-anyOf': 'anyOf',
    'schema-not': 'not',
    'schema-property': 'Property',
    'schema-additional-props': 'additionalProperties',
    'schema-array-items': 'Array Items',
    'schema-tuple-item': 'Tuple Item',
    'schema-discriminator': 'Discriminator',
  };
  return typeLabels[type] || type;
}

function RelationshipBadge({ relationship, direction }: { relationship: Relationship; direction: 'incoming' | 'outgoing' }) {
  const { type, context, source, target } = relationship;
  const otherComponent = direction === 'incoming' ? source : target;

  // Build context label
  const contextParts: string[] = [];
  if (context.propertyName) contextParts.push(`.${context.propertyName}`);
  if (context.statusCode) contextParts.push(`[${context.statusCode}]`);
  if (context.parameterName) contextParts.push(`(${context.parameterName})`);
  if (context.discriminatorValue) contextParts.push(`="${context.discriminatorValue}"`);
  if (context.tupleIndex !== undefined) contextParts.push(`[${context.tupleIndex}]`);

  return (
    <div className="flex items-center gap-2 text-xs rounded-md border border-border p-1.5">
      <Badge variant="outline" className="text-[10px]">
        {formatRelationshipType(type)}
      </Badge>
      <span className="text-muted-foreground">
        {direction === 'incoming' ? 'from' : 'to'}
      </span>
      <code className="text-blue-600 dark:text-blue-400">
        {otherComponent.name}
      </code>
      {contextParts.length > 0 && (
        <span className="text-muted-foreground font-mono text-[10px]">
          {contextParts.join('')}
        </span>
      )}
      {context.required && (
        <Badge variant="secondary" className="text-[10px] text-amber-600">
          required
        </Badge>
      )}
    </div>
  );
}

export function SchemaDetail({ schema, incomingRelationships = [], outgoingRelationships = [] }: SchemaDetailProps) {
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
        {incomingRelationships.length > 0 && (
          <span className="flex items-center gap-1">
            <ArrowLeftIcon className="h-3 w-3" />
            {incomingRelationships.length} incoming
          </span>
        )}
        {outgoingRelationships.length > 0 && (
          <span className="flex items-center gap-1">
            <ArrowRightIcon className="h-3 w-3" />
            {outgoingRelationships.length} outgoing
          </span>
        )}
      </div>

      {/* Discriminator */}
      {schema.discriminator && (
        <div>
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <TagIcon className="h-4 w-4" style={{ color: EDGE_COLORS.discriminator }} />
            Discriminator (Polymorphism)
          </h4>
          <div className="mt-2 rounded-md border border-border p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Property:</span>
              <code className="bg-muted px-1.5 py-0.5 rounded font-medium">
                {schema.discriminator.propertyName}
              </code>
            </div>
            {schema.discriminator.mapping && Object.keys(schema.discriminator.mapping).length > 0 && (
              <div className="mt-2">
                <span className="text-muted-foreground text-xs">Mappings:</span>
                <div className="mt-1 space-y-1">
                  {Object.entries(schema.discriminator.mapping).map(([value, ref]) => (
                    <div key={value} className="flex items-center gap-2 text-xs">
                      <code className="bg-muted px-1.5 py-0.5 rounded">"{value}"</code>
                      <span className="text-muted-foreground">→</span>
                      <code className="text-blue-600">{ref.split('/').pop()}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Additional Properties */}
      {schema.additionalProperties !== undefined && (
        <div>
          <h4 className="text-sm font-medium text-foreground">Additional Properties</h4>
          <div className="mt-1 text-sm">
            {schema.additionalProperties === false ? (
              <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                Not allowed
              </Badge>
            ) : schema.additionalProperties === true ? (
              <Badge variant="outline" className="text-xs">
                Any type allowed
              </Badge>
            ) : (
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{ borderColor: EDGE_COLORS['additional-props'], color: EDGE_COLORS['additional-props'] }}
                >
                  Map/Dictionary
                </Badge>
                <span className="text-muted-foreground text-xs">values:</span>
                <Badge variant="secondary" className="text-xs">
                  {schema.additionalProperties.$ref
                    ? schema.additionalProperties.$ref.split('/').pop()
                    : schema.additionalProperties.type}
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prefix Items (Tuple) */}
      {schema.prefixItems && schema.prefixItems.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground">Tuple Structure</h4>
          <div className="mt-2 space-y-1">
            {schema.prefixItems.map((item, index) => (
              <div key={index} className="flex items-center gap-2 text-xs rounded-md border border-border p-1.5">
                <Badge
                  variant="outline"
                  className="text-[10px]"
                  style={{ borderColor: EDGE_COLORS['tuple-item'], color: EDGE_COLORS['tuple-item'] }}
                >
                  [{index}]
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {item.$ref ? item.$ref.split('/').pop() : item.type}
                </Badge>
                {item.description && (
                  <span className="text-muted-foreground">{item.description}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Not Schema */}
      {schema.not && (
        <div>
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <span style={{ color: EDGE_COLORS.not }}>⊘</span>
            Must Not Match
          </h4>
          <div className="mt-1 rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-2 text-xs">
            <Badge variant="outline" className="text-[10px] border-red-300 text-red-600">
              {schema.not.$ref ? schema.not.$ref.split('/').pop() : schema.not.type}
            </Badge>
          </div>
        </div>
      )}

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

      {/* Incoming Relationships */}
      {incomingRelationships.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <ArrowLeftIcon className="h-4 w-4 text-green-600" />
              Referenced By ({incomingRelationships.length})
            </h4>
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {incomingRelationships.map((rel) => (
                <RelationshipBadge key={rel.id} relationship={rel} direction="incoming" />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Outgoing Relationships */}
      {outgoingRelationships.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <ArrowRightIcon className="h-4 w-4 text-blue-600" />
              References ({outgoingRelationships.length})
            </h4>
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {outgoingRelationships.map((rel) => (
                <RelationshipBadge key={rel.id} relationship={rel} direction="outgoing" />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
