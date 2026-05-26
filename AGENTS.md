# auto-image-editor

CLI tool for adding text overlays to images.

## Repository Structure

```
auto-image-editor/
├── packages/cli/       # CLI tool (TypeScript)
├── packages/website/   # Marketing website (placeholder)
├── docs/               # Design specs and plans
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

## Toolchain

- Node.js >= 18
- TypeScript (ESM)
- Vitest for testing

## Commands

```bash
# CLI
cd packages/cli
npm install
npm test           # Run tests
npm run dev        # Run CLI in dev mode
npm run build      # Compile TypeScript

# Website
cd packages/website
npm install
npm run dev        # Start dev server
npm run build      # Build static site
npm run preview    # Preview production build
```

## Guidelines

- All changes must include tests
- Use TDD: write failing test first, then implement
- Website changes are part of every feature
