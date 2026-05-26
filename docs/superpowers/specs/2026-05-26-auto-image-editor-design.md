# Auto Image Editor — Design Spec

A TypeScript CLI tool for adding text overlays to images. Published to npm as a global package, extensible via subcommands.

## Monorepo Structure

```
auto-image-editor/
├── packages/
│   ├── cli/
│   │   ├── src/
│   │   │   ├── cli.ts                 # CLI entry point (commander)
│   │   │   ├── commands/
│   │   │   │   └── add-text.ts        # add-text command handler
│   │   │   ├── services/
│   │   │   │   ├── font-loader.ts     # Google Fonts download + cache
│   │   │   │   ├── text-renderer.ts   # SVG text generation + auto-sizing
│   │   │   │   └── image-processor.ts # Sharp-based compositing
│   │   │   └── utils/
│   │   │       └── positioning.ts     # Parse % and px positioning values
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── website/                       # Placeholder — Astro marketing site
│       └── ...
├── CLAUDE.md                          # @AGENTS.md
├── AGENTS.md
├── README.md
├── LICENSE
└── .gitignore
```

## Command Interface

```
auto-image-editor add-text [options]
```

### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--input` | string | **required** | Path to source image (PNG, JPEG, WebP). Not modified. |
| `--output` | string | **required** | Path for the output image. |
| `--format` | string | auto | Output format: `jpeg`, `png`, `webp`. Default: inferred from `--output` extension, falls back to input format. |
| `--text` | string | **required** | The text to place on the image |
| `--lang` | string | `"tr"` | Language code for locale-aware casing (e.g. `tr`, `en`, `de`). |
| `--uppercase` | boolean | `true` | Convert text to uppercase using locale-aware rules. |
| `--font` | string | `"Geom"` | Google Font family name |
| `--color` | string | `"#FFFFFF"` | Text color (hex or named CSS color) |
| `--weight` | number | `600` | Font weight axis (100–900). Error if font doesn't support it. |
| `--width` | number | `100` | Font width axis as percentage. Error if font doesn't support it. |
| `--top` | string | `"60%"` | Top edge of text box |
| `--bottom` | string | `"6%"` | Bottom edge of text box |
| `--left` | string | `"0%"` | Left edge of text box |
| `--right` | string | `"100%"` | Right edge of text box |

### Format Resolution

1. Explicit `--format` flag → use that
2. `--output` file extension matches a supported format → use that
3. Same format as input image

### Positioning Rules

- Values accept `%` suffix (percentage of image dimension) or `px` suffix (absolute pixels)
- Bare numbers without suffix are treated as percentages
- Font size is auto-calculated: the largest size that fits within the box, text centered horizontally and vertically, word-wrapping as needed

### Locale-Aware Casing

Uses `String.toLocaleUpperCase(lang)` with the provided `--lang` code:

- `--lang tr --text "istanbul"` → `İSTANBUL` (dotted İ)
- `--lang en --text "istanbul"` → `ISTANBUL` (dotless I)

### Font Validation

On loading a font, the program checks its variable axes. If `--weight` or `--width` values fall outside the font's supported range, the program exits with an error:

```
Error: Font "Roboto Mono" does not support the width axis.
Available axes: weight (100–900)
Remove --width or choose a variable font with width support.
```

### Error Handling

- Missing `--text` → error with usage hint
- Missing `--input` or `--output` → error with usage hint
- Input file not found → clear error message
- Unsupported input format → error listing supported formats (PNG, JPEG, WebP)
- Invalid position value → error explaining expected format (`80%`, `800px`, or bare number)
- Google Font not found → error suggesting valid font names
- Box has zero or negative area → error
- Font doesn't support requested weight/width axis → error with explanation

### Example Usage

```bash
# Simple text overlay with defaults
auto-image-editor add-text \
  --input photo.jpg --output out.jpg \
  --text "Hello World"

# Positioned text box with custom font
auto-image-editor add-text \
  --input photo.jpg --output out.jpg \
  --text "Hello World" \
  --font "Open Sans" --weight 700 --width 100 \
  --top 80% --bottom 95% --left 5% --right 95%

# Pixel-based positioning, English locale
auto-image-editor add-text \
  --input photo.jpg --output out.jpg \
  --text "Caption" --lang en \
  --top 800px --bottom 950px --left 50px --right 750px

# Disable uppercase
auto-image-editor add-text \
  --input photo.jpg --output out.jpg \
  --text "Mixed Case Text" --uppercase false
```

## Processing Pipeline

```
Parse args → Load font → Compute box → Apply uppercase → Auto-size text → Render SVG → Composite → Write output
```

1. **Parse args** — Validate all flags. Resolve format. Exit early on errors.
2. **Load font** — Check cache at `~/.cache/auto-image-editor/fonts/`. Download from Google Fonts API on miss. Validate weight/width axis support.
3. **Compute box** — Resolve `%`/`px` values to pixel coordinates based on image dimensions.
4. **Apply uppercase** — `toLocaleUpperCase(--lang)` if `--uppercase` is true.
5. **Auto-size text** — Binary search for largest font size where word-wrapped text fits box width and height. Center horizontally and vertically.
6. **Render text to SVG** — Generate SVG string with font, sized text, and color.
7. **Composite onto image** — Sharp reads input, composites SVG text layer at computed position.
8. **Write output** — Write to `--output` in resolved format.

## Tech Stack

### CLI (`packages/cli/`)

| Dependency | Purpose |
|------------|---------|
| `commander` | CLI argument parsing and subcommand routing |
| `sharp` | Image read/write, compositing (libvips) |
| `google-fonts-helper` | Download variable font files from Google Fonts API |

| Dev Dependency | Purpose |
|----------------|---------|
| `typescript` | Type checking |
| `tsx` | Run `.ts` files directly during development |
| `vitest` | Testing |

### Runtime

- Node.js >= 18 (native fetch, ESM)
- ESM module (`"type": "module"`)
- Binary: `"bin": { "auto-image-editor": "./dist/cli.js" }`
- Build: `tsc` → `dist/`

### Website (`packages/website/`)

Placeholder. Will be Astro 6 + Tailwind 4, built out via `add-project-website` skill.
