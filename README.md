# OpenAPI Visualization

A modern web application for visualizing OpenAPI specifications as interactive graphs. Explore your API structure, understand schema relationships, and navigate complex specifications with ease.

## Features

- **Interactive Graph View**: Visualize endpoints and schemas as nodes with relationship edges
- **Monaco Editor**: Full-featured YAML/JSON editor with syntax highlighting
- **Live Parsing**: Real-time validation and visualization as you edit
- **Source Navigation**: Click graph nodes to jump to the corresponding source location
- **Relationship Semantics**: Understand *why* components are connected (request body, response, composition, etc.)
- **Circular Reference Detection**: Automatically identify and highlight circular dependencies
- **Export**: Save graph visualizations as images
- **Dark Mode**: System-aware theme with manual override

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 10+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd openapi-visualization

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The application will be available at `http://localhost:5173`.

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm verify` | Run lint, typecheck, and tests |

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation on the project structure and relationship model.

### Project Structure

```
src/
├── app/                    # Application root component
├── components/ui/          # Shared UI components (Radix-based)
├── core/                   # Core business logic
│   ├── parser/             # OpenAPI parsing and relationship extraction
│   │   ├── extractors/     # Modular extraction logic
│   │   └── workers/        # Web Worker for off-thread parsing
│   └── graph-builder/      # Graph node/edge generation
│       └── workers/        # Web Worker for off-thread layout
├── features/               # Feature modules
│   ├── editor/             # Monaco editor integration
│   ├── graph/              # React Flow graph visualization
│   ├── detail-panel/       # Node detail inspection
│   ├── export/             # Image export functionality
│   └── file-manager/       # File open/save operations
├── stores/                 # Zustand state management
├── types/                  # TypeScript type definitions
└── shared/                 # Shared utilities and hooks
```

### Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 7
- **State Management**: Zustand 5
- **Graph Visualization**: @xyflow/react (React Flow)
- **Graph Layout**: Dagre
- **Editor**: Monaco Editor
- **Styling**: Tailwind CSS 4.0 (OKLCH colors)
- **UI Components**: Radix UI
- **Testing**: Vitest + Testing Library

## Usage

### Loading a Specification

1. **Paste directly**: Edit the YAML/JSON in the left panel
2. **Open file**: Click the folder icon to load a local `.yaml` or `.json` file
3. **Drag & drop**: Drop a file onto the editor

### Navigating the Graph

- **Pan**: Click and drag the canvas
- **Zoom**: Scroll wheel or pinch gesture
- **Select node**: Click a node to view details
- **Jump to source**: Double-click a node to highlight it in the editor

### Understanding Relationships

Edges are color-coded by relationship type:
- **Blue**: Request body / Response schemas
- **Purple**: Composition (allOf, oneOf, anyOf)
- **Green**: Property references
- **Orange**: Discriminator mappings

Dashed edges indicate circular references.

## Development

### Adding New Features

1. Create a feature module in `src/features/`
2. Export components and hooks from an `index.ts`
3. Add any new stores to `src/stores/`
4. Write tests in `tests/`

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage
```

### Code Quality

```bash
# Run all checks
pnpm verify

# Fix lint issues
pnpm lint --fix
```

## Performance

The application uses Web Workers to prevent UI blocking:

- **Parser Worker**: Validates and extracts relationships in a background thread
- **Graph Worker**: Computes Dagre layout off the main thread

This ensures smooth interaction even with large specifications (500+ schemas).

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests
4. Run `pnpm verify` to ensure all checks pass
5. Commit with a descriptive message
6. Push and open a Pull Request

### Commit Guidelines

- Use conventional commit format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- Keep commits focused and atomic

## License

MIT
