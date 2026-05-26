import opentype from "opentype.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
  fontDir: string,
  fontPath: string
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

  await mkdir(fontDir, { recursive: true });
  await writeFile(fontPath, fontBuffer);
}
