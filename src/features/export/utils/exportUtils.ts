import { toPng, toSvg } from 'html-to-image';
import type { ParsedSpec } from '@/types';

function downloadFile(content: string | Blob, filename: string, type: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportAsPng(element: HTMLElement, filename: string = 'openapi-graph.png'): Promise<void> {
  try {
    const dataUrl = await toPng(element, {
      backgroundColor: '#ffffff',
      pixelRatio: 2, // Higher resolution
      filter: (node) => {
        // Filter out minimap and controls for cleaner export
        if (node.classList?.contains('react-flow__minimap')) return false;
        if (node.classList?.contains('react-flow__controls')) return false;
        return true;
      },
    });

    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Failed to export as PNG:', error);
    throw new Error('Failed to export as PNG');
  }
}

export async function exportAsSvg(element: HTMLElement, filename: string = 'openapi-graph.svg'): Promise<void> {
  try {
    const dataUrl = await toSvg(element, {
      backgroundColor: '#ffffff',
      filter: (node) => {
        if (node.classList?.contains('react-flow__minimap')) return false;
        if (node.classList?.contains('react-flow__controls')) return false;
        return true;
      },
    });

    // Convert data URL to actual SVG content
    const svgContent = decodeURIComponent(dataUrl.split(',')[1]);
    downloadFile(svgContent, filename, 'image/svg+xml');
  } catch (error) {
    console.error('Failed to export as SVG:', error);
    throw new Error('Failed to export as SVG');
  }
}

export function exportAsHtml(
  rawSpec: string,
  parsedSpec: ParsedSpec | null,
  filename: string = 'openapi-spec.html'
): void {
  const specTitle = parsedSpec?.info.title || 'OpenAPI Specification';
  const specVersion = parsedSpec?.info.version || '';
  const specDescription = parsedSpec?.info.description || '';

  const endpointsHtml = parsedSpec?.endpoints
    .map((endpoint) => {
      const methodClass = `method-${endpoint.method}`;
      const params = endpoint.parameters
        .map(
          (p) => `
        <div class="param">
          <code>${p.name}</code>
          <span class="param-in">${p.in}</span>
          ${p.required ? '<span class="param-required">required</span>' : ''}
          ${p.description ? `<span class="param-desc">${p.description}</span>` : ''}
        </div>
      `
        )
        .join('');

      const responses = Object.entries(endpoint.responses)
        .map(
          ([code, resp]) => `
        <div class="response">
          <code class="status-${code[0]}xx">${code}</code>
          <span>${resp.description}</span>
        </div>
      `
        )
        .join('');

      return `
      <div class="endpoint" id="${endpoint.operationId || endpoint.id}">
        <div class="endpoint-header">
          <span class="method ${methodClass}">${endpoint.method.toUpperCase()}</span>
          <code class="path">${endpoint.path}</code>
          ${endpoint.deprecated ? '<span class="deprecated">deprecated</span>' : ''}
        </div>
        ${endpoint.summary ? `<p class="summary">${endpoint.summary}</p>` : ''}
        ${endpoint.description ? `<div class="description">${endpoint.description}</div>` : ''}
        ${endpoint.tags.length > 0 ? `<div class="tags">${endpoint.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
        ${params ? `<div class="params"><h4>Parameters</h4>${params}</div>` : ''}
        ${responses ? `<div class="responses"><h4>Responses</h4>${responses}</div>` : ''}
      </div>
    `;
    })
    .join('\n') || '';

  const schemasHtml = parsedSpec?.schemas
    .map((schema) => {
      const properties = schema.properties
        ? Object.entries(schema.properties)
            .map(
              ([name, prop]) => `
          <div class="property">
            <code>${name}</code>
            <span class="prop-type">${prop.type}</span>
            ${prop.required ? '<span class="prop-required">required</span>' : ''}
            ${prop.description ? `<p class="prop-desc">${prop.description}</p>` : ''}
          </div>
        `
            )
            .join('')
        : '';

      return `
      <div class="schema" id="schema-${schema.name}">
        <h3>${schema.name}</h3>
        ${schema.description ? `<p class="description">${schema.description}</p>` : ''}
        ${properties ? `<div class="properties">${properties}</div>` : ''}
      </div>
    `;
    })
    .join('\n') || '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${specTitle}</title>
  <style>
    :root {
      --color-get: #3b82f6;
      --color-post: #22c55e;
      --color-put: #f59e0b;
      --color-delete: #ef4444;
      --color-patch: #8b5cf6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      background: #f9fafb;
    }
    header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid #e5e7eb;
    }
    h1 { font-size: 2rem; color: #111; }
    h2 { font-size: 1.5rem; color: #111; margin: 2rem 0 1rem; }
    h3 { font-size: 1.25rem; color: #111; margin-bottom: 0.5rem; }
    h4 { font-size: 0.875rem; color: #666; margin: 1rem 0 0.5rem; text-transform: uppercase; }
    .version { color: #666; font-size: 0.875rem; }
    .description { color: #555; margin-top: 0.5rem; }
    .endpoint {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    .endpoint-header { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .method {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
    }
    .method-get { background: #dbeafe; color: var(--color-get); }
    .method-post { background: #dcfce7; color: var(--color-post); }
    .method-put { background: #fef3c7; color: var(--color-put); }
    .method-delete { background: #fee2e2; color: var(--color-delete); }
    .method-patch { background: #ede9fe; color: var(--color-patch); }
    .path { font-family: monospace; font-size: 0.875rem; }
    .deprecated {
      background: #fee2e2;
      color: #ef4444;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }
    .summary { color: #555; margin-top: 0.5rem; }
    .tags { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-top: 0.5rem; }
    .tag {
      background: #f3f4f6;
      color: #374151;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }
    .params, .responses { margin-top: 1rem; }
    .param, .response, .property {
      padding: 0.5rem;
      background: #f9fafb;
      border-radius: 4px;
      margin-bottom: 0.25rem;
      font-size: 0.875rem;
    }
    .param code, .response code, .property code { font-family: monospace; font-weight: 600; }
    .param-in, .prop-type { color: #6b7280; margin-left: 0.5rem; }
    .param-required, .prop-required {
      background: #fef3c7;
      color: #d97706;
      padding: 0.125rem 0.25rem;
      border-radius: 2px;
      font-size: 0.625rem;
      margin-left: 0.5rem;
    }
    .param-desc, .prop-desc { color: #6b7280; display: block; margin-top: 0.25rem; }
    .status-2xx { color: var(--color-post); }
    .status-4xx { color: var(--color-put); }
    .status-5xx { color: var(--color-delete); }
    .schema {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    .spec-source {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 2px solid #e5e7eb;
    }
    .spec-source pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.875rem;
    }
    footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: 0.75rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <header>
    <h1>${specTitle}</h1>
    ${specVersion ? `<span class="version">Version ${specVersion}</span>` : ''}
    ${specDescription ? `<p class="description">${specDescription}</p>` : ''}
  </header>

  <main>
    <section>
      <h2>Endpoints</h2>
      ${endpointsHtml || '<p>No endpoints defined.</p>'}
    </section>

    <section>
      <h2>Schemas</h2>
      ${schemasHtml || '<p>No schemas defined.</p>'}
    </section>

    <section class="spec-source">
      <h2>Source Specification</h2>
      <pre><code>${rawSpec.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
    </section>
  </main>

  <footer>
    Generated with OpenAPI Visualization Editor
  </footer>
</body>
</html>`;

  downloadFile(html, filename, 'text/html');
}
