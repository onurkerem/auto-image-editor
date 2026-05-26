# Auto Image Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript CLI tool that adds text overlays to images with auto-sized, locale-aware text in a user-defined box.

**Architecture:** Subcommand-based CLI (`auto-image-editor add-text`) built with Commander.js. Font loading uses opentype.js to download Google Fonts, validate variable axes, measure text, and render text as SVG `<path>` elements. Sharp handles image compositing. Text is converted to paths (not `<text>` elements) because librsvg does not support embedded fonts in SVGs.

**Tech Stack:** TypeScript (ESM), Commander.js, Sharp, opentype.js, Vitest

---

## File Structure

```
packages/cli/
├── src/
│   ├── cli.ts                 # CLI entry point (commander)
│   ├── commands/
│   │   └── add-text.ts        # add-text command handler
│   ├── services/
│   │   ├── font-loader.ts     # Google Fonts download + cache + axis validation
│   │   ├── text-renderer.ts   # Text measurement, word-wrap, auto-size, SVG path generation
│   │   └── image-processor.ts # Sharp compositing + format resolution
│   └── utils/
│       └── positioning.ts     # Parse %/px values → pixel box
├── test/
│   ├── positioning.test.ts
│   ├── font-loader.test.ts
│   ├── text-renderer.test.ts
│   ├── image-processor.test.ts
│   ├── integration.test.ts
│   └── helpers/
│       └── font-factory.ts    # Creates minimal test fonts with opentype.js
├── package.json
└── tsconfig.json
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/cli.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "auto-image-editor",
  "version": "0.1.0",
  "description": "CLI tool for adding text overlays to images",
  "type": "module",
  "bin": {
    "auto-image-editor": "./dist/cli.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=18"
  },
  "dependencies": {
    "commander": "^13.1.0",
    "opentype.js": "^1.3.4",
    "sharp": "^0.33.5"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "@types/opentype.js": "^1.3.4",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "test"]
}
```

- [ ] **Step 3: Create minimal cli.ts entry point**

```typescript
#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("auto-image-editor")
  .description("CLI tool for adding text overlays to images")
  .version("0.1.0");

program.parse();
```

- [ ] **Step 4: Install dependencies**

Run: `cd packages/cli && npm install`
Expected: successful install

- [ ] **Step 5: Verify dev run**

Run: `cd packages/cli && npx tsx src/cli.ts --help`
Expected: help output showing program name and version

- [ ] **Step 6: Commit**

```bash
git add packages/cli/
git commit -m "scaffold: initial project structure with dependencies"
```

---

### Task 2: Positioning Utility

**Files:**
- Create: `packages/cli/src/utils/positioning.ts`
- Create: `packages/cli/test/positioning.test.ts`

- [ ] **Step 1: Write failing tests for parsePositionValue**

```typescript
import { describe, it, expect } from "vitest";
import { parsePositionValue } from "../src/utils/positioning.js";

describe("parsePositionValue", () => {
  it("parses percentage values", () => {
    expect(parsePositionValue("80%")).toEqual({ type: "percent", value: 80 });
  });

  it("parses pixel values", () => {
    expect(parsePositionValue("800px")).toEqual({ type: "pixel", value: 800 });
  });

  it("treats bare numbers as percentages", () => {
    expect(parsePositionValue("60")).toEqual({ type: "percent", value: 60 });
  });

  it("throws on invalid format", () => {
    expect(() => parsePositionValue("abc")).toThrow(
      'Invalid position value: "abc". Expected format: "80%", "800px", or a bare number.'
    );
  });

  it("throws on negative values", () => {
    expect(() => parsePositionValue("-5%")).toThrow("negative");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && npx vitest run test/positioning.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement parsePositionValue**

```typescript
// packages/cli/src/utils/positioning.ts

export interface PositionValue {
  type: "percent" | "pixel";
  value: number;
}

export interface PositionInput {
  top: string;
  bottom: string;
  left: string;
  right: string;
}

export interface PixelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export function parsePositionValue(raw: string): PositionValue {
  const trimmed = raw.trim();
  if (trimmed.endsWith("%")) {
    const num = parseFloat(trimmed.slice(0, -1));
    if (isNaN(num) || num < 0) {
      throw new Error(
        `Invalid position value: "${raw}". Percentage must be a non-negative number.`
      );
    }
    return { type: "percent", value: num };
  }
  if (trimmed.endsWith("px")) {
    const num = parseFloat(trimmed.slice(0, -2));
    if (isNaN(num) || num < 0) {
      throw new Error(
        `Invalid position value: "${raw}". Pixel value must be a non-negative number.`
      );
    }
    return { type: "pixel", value: num };
  }
  const num = parseFloat(trimmed);
  if (isNaN(num) || num < 0) {
    throw new Error(
      `Invalid position value: "${raw}". Expected format: "80%", "800px", or a bare number.`
    );
  }
  return { type: "percent", value: num };
}
```

- [ ] **Step 4: Run parsePositionValue tests**

Run: `cd packages/cli && npx vitest run test/positioning.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Write failing tests for computeTextBox**

Add to `test/positioning.test.ts`:

```typescript
import { computeTextBox } from "../src/utils/positioning.js";

describe("computeTextBox", () => {
  const image: ImageDimensions = { width: 1000, height: 800 };

  it("computes box from percentage values", () => {
    const box = computeTextBox(
      { top: "10%", bottom: "10%", left: "5%", right: "5%" },
      image
    );
    expect(box).toEqual({ x: 50, y: 80, width: 900, height: 560 });
  });

  it("computes box from pixel values", () => {
    const box = computeTextBox(
      { top: "100px", bottom: "50px", left: "20px", right: "30px" },
      image
    );
    expect(box).toEqual({ x: 20, y: 100, width: 950, height: 650 });
  });

  it("computes box with defaults", () => {
    const box = computeTextBox(
      { top: "60%", bottom: "6%", left: "0%", right: "100%" },
      image
    );
    expect(box).toEqual({ x: 0, y: 480, width: 0, height: 272 });
  });

  it("throws when box has zero width", () => {
    expect(() =>
      computeTextBox(
        { top: "0%", bottom: "0%", left: "50%", right: "50%" },
        image
      )
    ).toThrow("Text box has zero or negative area");
  });

  it("throws when box has negative height", () => {
    expect(() =>
      computeTextBox(
        { top: "90%", bottom: "5%", left: "0%", right: "100%" },
        image
      )
    ).toThrow("Text box has zero or negative area");
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd packages/cli && npx vitest run test/positioning.test.ts`
Expected: FAIL — computeTextBox not found

- [ ] **Step 7: Implement computeTextBox**

Add to `packages/cli/src/utils/positioning.ts`:

```typescript
export function computeTextBox(position: PositionInput, image: ImageDimensions): PixelBox {
  const top = parsePositionValue(position.top);
  const bottom = parsePositionValue(position.bottom);
  const left = parsePositionValue(position.left);
  const right = parsePositionValue(position.right);

  const resolveX = (v: PositionValue) =>
    v.type === "percent" ? (v.value / 100) * image.width : v.value;
  const resolveY = (v: PositionValue) =>
    v.type === "percent" ? (v.value / 100) * image.height : v.value;

  const x = resolveX(left);
  const boxRight = image.width - resolveX(right);
  const y = resolveY(top);
  const boxBottom = image.height - resolveY(bottom);

  const width = boxRight - x;
  const height = boxBottom - y;

  if (width <= 0 || height <= 0) {
    throw new Error(
      `Text box has zero or negative area (${width}x${height}px). Check your position values.`
    );
  }

  return { x, y, width, height };
}
```

- [ ] **Step 8: Run all positioning tests**

Run: `cd packages/cli && npx vitest run test/positioning.test.ts`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add packages/cli/src/utils/ packages/cli/test/positioning.test.ts
git commit -m "feat: add positioning utility with % and px support"
```

---

### Task 3: Font Loader

**Files:**
- Create: `packages/cli/src/services/font-loader.ts`
- Create: `packages/cli/test/font-loader.test.ts`
- Create: `packages/cli/test/helpers/font-factory.ts`

- [ ] **Step 1: Create test font factory helper**

```typescript
// packages/cli/test/helpers/font-factory.ts
import opentype from "opentype.js";

export function createTestFont(
  options: {
    familyName?: string;
    includeWeightAxis?: boolean;
    includeWidthAxis?: boolean;
  } = {}
): Buffer {
  const {
    familyName = "TestFont",
    includeWeightAxis = true,
    includeWidthAxis = false,
  } = options;

  const notdefGlyph = new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: 650,
    path: new opentype.Path(),
  });

  const glyphs: opentype.Glyph[] = [notdefGlyph];

  // Add A-Z
  for (let i = 65; i <= 90; i++) {
    const char = String.fromCharCode(i);
    const glyph = new opentype.Glyph({
      name: char,
      unicode: i,
      advanceWidth: 600,
      path: new opentype.Path(),
    });
    glyphs.push(glyph);
  }

  // Add a-z
  for (let i = 97; i <= 122; i++) {
    const char = String.fromCharCode(i);
    const glyph = new opentype.Glyph({
      name: char,
      unicode: i,
      advanceWidth: 500,
      path: new opentype.Path(),
    });
    glyphs.push(glyph);
  }

  // Add Turkish special characters
  const turkishChars = [
    { name: "I.dot", unicode: 304, advanceWidth: 600 },   // İ
    { name: "i.dotless", unicode: 305, advanceWidth: 500 }, // ı
    { name: "G.breve", unicode: 286, advanceWidth: 700 },  // Ğ
    { name: "g.breve", unicode: 287, advanceWidth: 500 },  // ğ
    { name: "O.dblgrave", unicode: 214, advanceWidth: 700 }, // Ö
    { name: "o.dblgrave", unicode: 246, advanceWidth: 500 }, // ö
    { name: "U.dblgrave", unicode: 220, advanceWidth: 700 }, // Ü
    { name: "u.dblgrave", unicode: 252, advanceWidth: 500 }, // ü
    { name: "S.cedilla", unicode: 350, advanceWidth: 600 },  // Ş
    { name: "s.cedilla", unicode: 351, advanceWidth: 500 },  // ş
    { name: "C.cedilla", unicode: 199, advanceWidth: 700 },  // Ç
    { name: "c.cedilla", unicode: 231, advanceWidth: 500 },  // ç
  ];

  for (const tc of turkishChars) {
    glyphs.push(
      new opentype.Glyph({
        name: tc.name,
        unicode: tc.unicode,
        advanceWidth: tc.advanceWidth,
        path: new opentype.Path(),
      })
    );
  }

  // Add space
  glyphs.push(
    new opentype.Glyph({
      name: "space",
      unicode: 32,
      advanceWidth: 300,
      path: new opentype.Path(),
    })
  );

  const font = new opentype.Font({
    familyName,
    styleName: "Regular",
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs,
  });

  // Add variable font axes if requested
  // opentype.js doesn't natively support creating fvar tables,
  // so we'll manually inject the table for testing
  if (includeWeightAxis || includeWidthAxis) {
    const axes: opentype.Table[] = [];
    if (includeWeightAxis) {
      axes.push(
        new opentype.Table("wght", [
          { tag: "wght", minValue: 100, defaultValue: 400, maxValue: 900 },
        ])
      );
    }
    // Note: Real fvar table injection requires lower-level binary manipulation.
    // For tests, we'll mock the axis reading.
  }

  return Buffer.from(font.toArrayBuffer());
}

export function createTestFontWithAxes(axes: {
  weight?: { min: number; max: number };
  width?: { min: number; max: number };
}): { fontBuffer: Buffer; axes: Array<{ tag: string; minValue: number; defaultValue: number; maxValue: number }> } {
  const fontBuffer = createTestFont({
    includeWeightAxis: !!axes.weight,
    includeWidthAxis: !!axes.width,
  });

  const fvarAxes: Array<{ tag: string; minValue: number; defaultValue: number; maxValue: number }> = [];
  if (axes.weight) {
    fvarAxes.push({
      tag: "wght",
      minValue: axes.weight.min,
      defaultValue: 400,
      maxValue: axes.weight.max,
    });
  }
  if (axes.width) {
    fvarAxes.push({
      tag: "wdth",
      minValue: axes.width.min,
      defaultValue: 100,
      maxValue: axes.width.max,
    });
  }

  return { fontBuffer, axes: fvarAxes };
}
```

- [ ] **Step 2: Write failing tests for font axis validation**

```typescript
import { describe, it, expect } from "vitest";
import { validateFontAxes, type FontAxisInfo } from "../src/services/font-loader.js";

describe("validateFontAxes", () => {
  const axesWithBoth: FontAxisInfo[] = [
    { tag: "wght", minValue: 100, defaultValue: 400, maxValue: 900 },
    { tag: "wdth", minValue: 75, defaultValue: 100, maxValue: 125 },
  ];

  const axesWithWeightOnly: FontAxisInfo[] = [
    { tag: "wght", minValue: 100, defaultValue: 400, maxValue: 900 },
  ];

  it("passes when all requested axes are supported", () => {
    expect(() =>
      validateFontAxes("TestFont", axesWithBoth, { weight: 600, width: 100 })
    ).not.toThrow();
  });

  it("passes when only weight is requested and supported", () => {
    expect(() =>
      validateFontAxes("TestFont", axesWithWeightOnly, { weight: 600 })
    ).not.toThrow();
  });

  it("throws when width axis is not supported", () => {
    expect(() =>
      validateFontAxes("TestFont", axesWithWeightOnly, { weight: 600, width: 100 })
    ).toThrow('Font "TestFont" does not support the width axis');
  });

  it("throws when weight is out of range", () => {
    expect(() =>
      validateFontAxes("TestFont", axesWithBoth, { weight: 950, width: 100 })
    ).toThrow('Font "TestFont" weight value 950 is out of range');
  });

  it("throws when width is out of range", () => {
    expect(() =>
      validateFontAxes("TestFont", axesWithBoth, { weight: 600, width: 200 })
    ).toThrow('Font "TestFont" width value 200 is out of range');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/cli && npx vitest run test/font-loader.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement validateFontAxes**

```typescript
// packages/cli/src/services/font-loader.ts
import opentype from "opentype.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";

export interface FontAxisInfo {
  tag: string;
  minValue: number;
  defaultValue: number;
  maxValue: number;
}

export interface FontLoadResult {
  font: opentype.Font;
  filePath: string;
  axes: FontAxisInfo[];
}

export function validateFontAxes(
  fontName: string,
  axes: FontAxisInfo[],
  requested: { weight?: number; width?: number }
): void {
  const weightAxis = axes.find((a) => a.tag === "wght");
  const widthAxis = axes.find((a) => a.tag === "wdth");

  if (requested.weight !== undefined) {
    if (!weightAxis) {
      throw new Error(
        `Font "${fontName}" does not support the weight axis.\nAvailable axes: ${axes.map((a) => a.tag).join(", ") || "none"}\nRemove --weight or choose a font with weight support.`
      );
    }
    if (requested.weight < weightAxis.minValue || requested.weight > weightAxis.maxValue) {
      throw new Error(
        `Font "${fontName}" weight value ${requested.weight} is out of range (${weightAxis.minValue}–${weightAxis.maxValue}).`
      );
    }
  }

  if (requested.width !== undefined) {
    if (!widthAxis) {
      throw new Error(
        `Font "${fontName}" does not support the width axis.\nAvailable axes: ${axes.map((a) => a.tag).join(", ") || "none"}\nRemove --width or choose a variable font with width support.`
      );
    }
    if (requested.width < widthAxis.minValue || requested.width > widthAxis.maxValue) {
      throw new Error(
        `Font "${fontName}" width value ${requested.width} is out of range (${widthAxis.minValue}–${widthAxis.maxValue}).`
      );
    }
  }
}

function getCacheDir(): string {
  return join(homedir(), ".cache", "auto-image-editor", "fonts");
}

function normalizeFontName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export async function loadFont(
  fontName: string,
  options: { weight?: number; width?: number } = {}
): Promise<FontLoadResult> {
  const cacheDir = getCacheDir();
  const normalized = normalizeFontName(fontName);
  const fontDir = join(cacheDir, normalized);
  const fontPath = join(fontDir, `${normalized}-variable.ttf`);

  if (!existsSync(fontPath)) {
    await downloadFont(fontName, fontDir, fontPath);
  }

  const buffer = await readFile(fontPath);
  const font = opentype.parse(buffer);

  const axes = extractAxes(font);
  validateFontAxes(fontName, axes, options);

  if (options.weight || options.width) {
    const coords: Record<string, number> = {};
    if (options.weight) coords.wght = options.weight;
    if (options.width) coords.wdth = options.width;
    font.variation.set(coords);
  }

  return { font, filePath: fontPath, axes };
}

function extractAxes(font: opentype.Font): FontAxisInfo[] {
  const fvar = (font.tables as Record<string, Record<string, unknown>>).fvar;
  if (!fvar || !fvar.axes) return [];
  return (fvar.axes as FontAxisInfo[]).map((a) => ({
    tag: a.tag,
    minValue: a.minValue,
    defaultValue: a.defaultValue,
    maxValue: a.maxValue,
  }));
}

async function downloadFont(
  fontName: string,
  _fontDir: string,
  _fontPath: string
): Promise<void> {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@100..900`;

  const cssResponse = await fetch(cssUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
    },
  });

  if (!cssResponse.ok) {
    throw new Error(
      `Google Font "${fontName}" not found. Check the font name at https://fonts.google.com`
    );
  }

  const css = await cssResponse.text();
  const urlMatch = css.match(/src:\s*url\(([^)]+)\)/);
  if (!urlMatch) {
    throw new Error(`Could not extract font file URL for "${fontName}" from Google Fonts CSS.`);
  }
  const fontUrl = urlMatch[1];

  const fontResponse = await fetch(fontUrl);
  if (!fontResponse.ok) {
    throw new Error(`Failed to download font file for "${fontName}".`);
  }
  const fontBuffer = Buffer.from(await fontResponse.arrayBuffer());

  await mkdir(dirname(_fontPath), { recursive: true });
  await writeFile(_fontPath, fontBuffer);
}
```

- [ ] **Step 5: Run font-loader tests**

Run: `cd packages/cli && npx vitest run test/font-loader.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/services/font-loader.ts packages/cli/test/font-loader.test.ts packages/cli/test/helpers/
git commit -m "feat: add font loader with Google Fonts download and axis validation"
```

---

### Task 4: Text Renderer

**Files:**
- Create: `packages/cli/src/services/text-renderer.ts`
- Create: `packages/cli/test/text-renderer.test.ts`

- [ ] **Step 1: Write failing tests for text measurement and wrapping**

```typescript
import { describe, it, expect } from "vitest";
import opentype from "opentype.js";
import { measureTextWidth, wrapText, autoSizeAndRender, type RenderResult } from "../src/services/text-renderer.js";
import { createTestFont } from "./helpers/font-factory.js";

describe("text renderer", () => {
  let font: opentype.Font;

  beforeEach(() => {
    const buffer = createTestFont();
    font = opentype.parse(buffer);
  });

  describe("measureTextWidth", () => {
    it("measures width of a string at given font size", () => {
      const width = measureTextWidth(font, "ABC", 48);
      // Each glyph has advanceWidth=600, unitsPerEm=1000
      // width = (600+600+600)/1000 * 48 = 86.4
      expect(width).toBeCloseTo(86.4, 1);
    });

    it("returns 0 for empty string", () => {
      expect(measureTextWidth(font, "", 48)).toBe(0);
    });
  });

  describe("wrapText", () => {
    it("returns single line when text fits", () => {
      const lines = wrapText(font, "AB", 200, 48);
      expect(lines).toEqual(["AB"]);
    });

    it("breaks text into multiple lines when it exceeds width", () => {
      const lines = wrapText(font, "A B C D E F", 60, 48);
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe("autoSizeAndRender", () => {
    it("returns SVG paths that fit within the box", () => {
      const result = autoSizeAndRender(font, "HELLO WORLD", {
        boxWidth: 500,
        boxHeight: 100,
        color: "#FFFFFF",
      });
      expect(result.fontSize).toBeGreaterThan(0);
      expect(result.svg).toContain("<svg");
      expect(result.svg).toContain("<path");
    });

    it("centers text within the box", () => {
      const result = autoSizeAndRender(font, "AB", {
        boxWidth: 500,
        boxHeight: 100,
        color: "#FFFFFF",
      });
      expect(result.offsetX).toBeGreaterThan(0);
      expect(result.offsetY).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && npx vitest run test/text-renderer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement text-renderer.ts**

```typescript
// packages/cli/src/services/text-renderer.ts
import opentype from "opentype.js";

export interface RenderOptions {
  boxWidth: number;
  boxHeight: number;
  color: string;
}

export interface RenderResult {
  svg: string;
  fontSize: number;
  offsetX: number;
  offsetY: number;
}

export function measureTextWidth(
  font: opentype.Font,
  text: string,
  fontSize: number
): number {
  return font.getAdvanceWidth(text, fontSize);
}

export function wrapText(
  font: opentype.Font,
  text: string,
  maxWidth: number,
  fontSize: number
): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = `${currentLine} ${words[i]}`;
    const width = measureTextWidth(font, testLine, fontSize);
    if (width > maxWidth) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  return lines;
}

export function autoSizeAndRender(
  font: opentype.Font,
  text: string,
  options: RenderOptions
): RenderResult {
  const { boxWidth, boxHeight, color } = options;
  const lineHeightMultiplier = 1.2;
  const padding = 4;

  let low = 1;
  let high = boxHeight;
  let bestSize = low;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const lines = wrapText(font, text, boxWidth - padding * 2, mid);
    const totalHeight = lines.length * mid * lineHeightMultiplier;

    if (
      totalHeight <= boxHeight - padding * 2 &&
      lines.every(
        (line) => measureTextWidth(font, line, mid) <= boxWidth - padding * 2
      )
    ) {
      bestSize = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const fontSize = bestSize;
  const lines = wrapText(font, text, boxWidth - padding * 2, fontSize);
  const lineHeight = fontSize * lineHeightMultiplier;

  // Build SVG paths
  const paths: string[] = [];
  const totalTextHeight = lines.length * lineHeight;

  for (let i = 0; i < lines.length; i++) {
    const lineWidth = measureTextWidth(font, lines[i], fontSize);
    const lineX = (boxWidth - lineWidth) / 2;
    const lineY = (boxHeight - totalTextHeight) / 2 + (i + 1) * lineHeight;

    const path = font.getPath(lines[i], lineX, lineY - fontSize * 0.2, fontSize);
    paths.push(path.toSVG(2));
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${boxWidth}" height="${boxHeight}">`,
    ...paths.map((p) => `  <g fill="${color}">${p}</g>`),
    "</svg>",
  ].join("\n");

  return {
    svg,
    fontSize,
    offsetX: 0,
    offsetY: 0,
  };
}
```

- [ ] **Step 4: Run text-renderer tests**

Run: `cd packages/cli && npx vitest run test/text-renderer.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/services/text-renderer.ts packages/cli/test/text-renderer.test.ts
git commit -m "feat: add text renderer with auto-sizing and SVG path generation"
```

---

### Task 5: Image Processor

**Files:**
- Create: `packages/cli/src/services/image-processor.ts`
- Create: `packages/cli/test/image-processor.test.ts`

- [ ] **Step 1: Write failing tests for format resolution and compositing**

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { resolveFormat, compositeText, type FormatResult } from "../src/services/image-processor.js";
import { writeFile, readFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("image processor", () => {
  const testDir = join(tmpdir(), "auto-image-editor-test");

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
  });

  describe("resolveFormat", () => {
    it("uses explicit format flag", () => {
      expect(resolveFormat({ format: "png", outputPath: "out.jpg", inputPath: "in.jpg" })).toBe("png");
    });

    it("infers from output extension", () => {
      expect(resolveFormat({ outputPath: "out.webp", inputPath: "in.jpg" })).toBe("webp");
    });

    it("falls back to input format when output has no known extension", () => {
      expect(resolveFormat({ outputPath: "out.dat", inputPath: "photo.jpeg" })).toBe("jpeg");
    });

    it("returns png for .png input", () => {
      expect(resolveFormat({ outputPath: "out.dat", inputPath: "img.png" })).toBe("png");
    });
  });

  describe("compositeText", () => {
    it("composites SVG text onto an image and writes output", async () => {
      const inputPath = join(testDir, "input.png");
      const outputPath = join(testDir, "output.png");

      // Create a 200x100 red test image
      await sharp({ create: { width: 200, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } } })
        .png()
        .toFile(inputPath);

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><g fill="white"><path d="M10,50 L190,50"/></g></svg>`;

      await compositeText({
        inputPath,
        outputPath,
        svg,
        x: 0,
        y: 0,
        format: "png",
      });

      const metadata = await sharp(outputPath).metadata();
      expect(metadata.width).toBe(200);
      expect(metadata.height).toBe(100);
      expect(metadata.format).toBe("png");

      // Cleanup
      await unlink(inputPath);
      await unlink(outputPath);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/cli && npx vitest run test/image-processor.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement image-processor.ts**

```typescript
// packages/cli/src/services/image-processor.ts
import sharp from "sharp";

const SUPPORTED_FORMATS = ["jpeg", "png", "webp"] as const;
type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

const EXTENSION_MAP: Record<string, SupportedFormat> = {
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".png": "png",
  ".webp": "webp",
};

interface FormatInput {
  format?: string;
  outputPath: string;
  inputPath: string;
}

export function resolveFormat(input: FormatInput): SupportedFormat {
  // 1. Explicit flag
  if (input.format && SUPPORTED_FORMATS.includes(input.format as SupportedFormat)) {
    return input.format as SupportedFormat;
  }

  // 2. Output extension
  const outExt = input.outputPath.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (outExt && EXTENSION_MAP[outExt]) {
    return EXTENSION_MAP[outExt];
  }

  // 3. Input extension
  const inExt = input.inputPath.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (inExt && EXTENSION_MAP[inExt]) {
    return EXTENSION_MAP[inExt];
  }

  return "png";
}

export interface CompositeInput {
  inputPath: string;
  outputPath: string;
  svg: string;
  x: number;
  y: number;
  format: SupportedFormat;
}

export async function compositeText(input: CompositeInput): Promise<void> {
  const svgBuffer = Buffer.from(input.svg);

  const pipeline = sharp(input.inputPath).composite([
    {
      input: svgBuffer,
      left: Math.round(input.x),
      top: Math.round(input.y),
    },
  ]);

  switch (input.format) {
    case "jpeg":
      await pipeline.jpeg({ quality: 90 }).toFile(input.outputPath);
      break;
    case "png":
      await pipeline.png().toFile(input.outputPath);
      break;
    case "webp":
      await pipeline.webp({ quality: 90 }).toFile(input.outputPath);
      break;
  }
}
```

- [ ] **Step 4: Run image-processor tests**

Run: `cd packages/cli && npx vitest run test/image-processor.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/services/image-processor.ts packages/cli/test/image-processor.test.ts
git commit -m "feat: add image processor with format resolution and compositing"
```

---

### Task 6: CLI Integration

**Files:**
- Create: `packages/cli/src/commands/add-text.ts`
- Modify: `packages/cli/src/cli.ts`
- Create: `packages/cli/test/integration.test.ts`

- [ ] **Step 1: Implement add-text command handler**

```typescript
// packages/cli/src/commands/add-text.ts
import { Command } from "commander";
import { access } from "node:fs/promises";
import sharp from "sharp";
import { loadFont } from "../services/font-loader.js";
import { autoSizeAndRender } from "../services/text-renderer.js";
import { compositeText, resolveFormat } from "../services/image-processor.js";
import { computeTextBox } from "../utils/positioning.js";

export function registerAddTextCommand(program: Command): void {
  program
    .command("add-text")
    .description("Add text overlay to an image")
    .requiredOption("--input <path>", "Path to source image")
    .requiredOption("--output <path>", "Path for output image")
    .requiredOption("--text <string>", "Text to place on the image")
    .option("--format <format>", "Output format: jpeg, png, webp")
    .option("--lang <code>", "Language code for locale-aware casing", "tr")
    .option("--uppercase <boolean>", "Convert text to uppercase", "true")
    .option("--font <name>", "Google Font family name", "Geom")
    .option("--color <color>", "Text color", "#FFFFFF")
    .option("--weight <number>", "Font weight axis", "600")
    .option("--width <number>", "Font width axis", "100")
    .option("--top <value>", "Top edge of text box", "60%")
    .option("--bottom <value>", "Bottom edge of text box", "6%")
    .option("--left <value>", "Left edge of text box", "0%")
    .option("--right <value>", "Right edge of text box", "100%")
    .action(async (opts) => {
      try {
        await addTextAction(opts);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        process.exit(1);
      }
    });
}

interface AddTextOptions {
  input: string;
  output: string;
  text: string;
  format?: string;
  lang: string;
  uppercase: string;
  font: string;
  color: string;
  weight: string;
  width: string;
  top: string;
  bottom: string;
  left: string;
  right: string;
}

export async function addTextAction(opts: AddTextOptions): Promise<void> {
  // Validate input file exists
  try {
    await access(opts.input);
  } catch {
    throw new Error(`Input file not found: ${opts.input}`);
  }

  // Get image metadata
  const metadata = await sharp(opts.input).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions.");
  }

  // Resolve format
  const format = resolveFormat({
    format: opts.format,
    outputPath: opts.output,
    inputPath: opts.input,
  });

  // Compute text box
  const box = computeTextBox(
    { top: opts.top, bottom: opts.bottom, left: opts.left, right: opts.right },
    { width: metadata.width, height: metadata.height }
  );

  // Apply locale-aware uppercase
  const uppercase = opts.uppercase !== "false";
  let text = opts.text;
  if (uppercase) {
    text = text.toLocaleUpperCase(opts.lang);
  }

  // Load font
  const weight = parseInt(opts.weight, 10);
  const widthAxis = parseInt(opts.width, 10);
  const { font } = await loadFont(opts.font, { weight, width: widthAxis });

  // Render text to SVG
  const result = autoSizeAndRender(font, text, {
    boxWidth: Math.round(box.width),
    boxHeight: Math.round(box.height),
    color: opts.color,
  });

  // Composite and write output
  await compositeText({
    inputPath: opts.input,
    outputPath: opts.output,
    svg: result.svg,
    x: box.x,
    y: box.y,
    format,
  });
}
```

- [ ] **Step 2: Update cli.ts to register the command**

```typescript
#!/usr/bin/env node
import { Command } from "commander";
import { registerAddTextCommand } from "./commands/add-text.js";

const program = new Command();

program
  .name("auto-image-editor")
  .description("CLI tool for adding text overlays to images")
  .version("0.1.0");

registerAddTextCommand(program);

program.parse();
```

- [ ] **Step 3: Verify CLI help output**

Run: `cd packages/cli && npx tsx src/cli.ts add-text --help`
Expected: help output showing all options with defaults

- [ ] **Step 4: Write integration test**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import sharp from "sharp";
import { addTextAction } from "../src/commands/add-text.js";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("integration: add-text command", () => {
  const testDir = join(tmpdir(), "auto-image-editor-integration");
  const inputPath = join(testDir, "photo.jpg");
  const outputPath = join(testDir, "output.jpg");

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
    await sharp({
      create: { width: 1000, height: 800, channels: 3, background: { r: 50, g: 100, b: 150 } },
    })
      .jpeg()
      .toFile(inputPath);
  });

  afterAll(async () => {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  });

  it("adds text to image with defaults", async () => {
    await addTextAction({
      input: inputPath,
      output: outputPath,
      text: "Hello World",
      lang: "en",
      uppercase: "true",
      font: "Roboto",
      color: "#FFFFFF",
      weight: "400",
      width: "100",
      top: "60%",
      bottom: "6%",
      left: "0%",
      right: "100%",
    });

    const metadata = await sharp(outputPath).metadata();
    expect(metadata.width).toBe(1000);
    expect(metadata.height).toBe(800);
    expect(metadata.format).toBe("jpeg");
  });

  it("applies Turkish locale uppercase", async () => {
    await addTextAction({
      input: inputPath,
      output: outputPath,
      text: "istanbul",
      lang: "tr",
      uppercase: "true",
      font: "Roboto",
      color: "#FFFFFF",
      weight: "400",
      width: "100",
      top: "60%",
      bottom: "6%",
      left: "0%",
      right: "100%",
    });

    const metadata = await sharp(outputPath).metadata();
    expect(metadata.width).toBe(1000);
  });

  it("errors on missing input file", async () => {
    await expect(
      addTextAction({
        input: "/nonexistent/path.jpg",
        output: outputPath,
        text: "test",
        lang: "en",
        uppercase: "true",
        font: "Roboto",
        color: "#FFFFFF",
        weight: "400",
        width: "100",
        top: "60%",
        bottom: "6%",
        left: "0%",
        right: "100%",
      })
    ).rejects.toThrow("Input file not found");
  });
});
```

- [ ] **Step 5: Run integration test**

Run: `cd packages/cli && npx vitest run test/integration.test.ts`
Expected: ALL PASS (will download Roboto font on first run)

- [ ] **Step 6: Run full test suite**

Run: `cd packages/cli && npx vitest run`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/ packages/cli/test/integration.test.ts
git commit -m "feat: wire up add-text command with full pipeline"
```

---

### Task 7: Root Documentation

**Files:**
- Create: `AGENTS.md`
- Create: `CLAUDE.md`
- Create: `README.md`
- Create: `LICENSE`

- [ ] **Step 1: Create AGENTS.md**

```markdown
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
cd packages/cli
npm install
npm test           # Run tests
npm run dev        # Run CLI in dev mode
npm run build      # Compile TypeScript
```

## Guidelines

- All changes must include tests
- Use TDD: write failing test first, then implement
- Website changes are part of every feature
```

- [ ] **Step 2: Create CLAUDE.md**

```markdown
@AGENTS.md
```

- [ ] **Step 3: Create README.md**

```markdown
# auto-image-editor

A CLI tool for adding text overlays to images with support for Google Fonts, variable font axes, and locale-aware text casing.

## Install

```bash
npm install -g auto-image-editor
```

## Usage

```bash
auto-image-editor add-text \
  --input photo.jpg --output out.jpg \
  --text "Hello World"
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--input` | required | Source image path (PNG, JPEG, WebP) |
| `--output` | required | Output image path |
| `--format` | auto | Output format: jpeg, png, webp |
| `--text` | required | Text to overlay |
| `--lang` | `tr` | Language code for locale-aware casing |
| `--uppercase` | `true` | Convert text to uppercase |
| `--font` | `Geom` | Google Font family name |
| `--color` | `#FFFFFF` | Text color |
| `--weight` | `600` | Font weight axis (100–900) |
| `--width` | `100` | Font width axis percentage |
| `--top` | `60%` | Top edge of text box |
| `--bottom` | `6%` | Bottom edge of text box |
| `--left` | `0%` | Left edge of text box |
| `--right` | `100%` | Right edge of text box |

## Development

```bash
cd packages/cli
npm install
npm test
npm run dev -- add-text --input test.jpg --output out.jpg --text "Test"
```

## License

MIT
```

- [ ] **Step 4: Create LICENSE (MIT)**

```
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md CLAUDE.md README.md LICENSE
git commit -m "docs: add README, AGENTS.md, CLAUDE.md, and MIT license"
```

---

### Task 8: Website Placeholder

**Files:**
- Create: `packages/website/package.json`
- Create: `packages/website/AGENTS.md`
- Create: `packages/website/CLAUDE.md`

- [ ] **Step 1: Create placeholder package.json**

```json
{
  "name": "website",
  "version": "0.1.0",
  "private": true,
  "description": "Marketing website for auto-image-editor. Placeholder — to be built with Astro + Tailwind."
}
```

- [ ] **Step 2: Create AGENTS.md**

```markdown
# packages/website — auto-image-editor marketing site

Placeholder. To be built with Astro 6 + Tailwind 4.

## Stack
- Astro 6, Tailwind 4, TypeScript

## Commands (once built)
npm run dev / build / preview
```

- [ ] **Step 3: Create CLAUDE.md**

```markdown
@AGENTS.md
```

- [ ] **Step 4: Commit**

```bash
git add packages/website/
git commit -m "scaffold: add website package placeholder"
```
