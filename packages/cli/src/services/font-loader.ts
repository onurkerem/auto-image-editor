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

interface FontLoadOptions {
  weight?: number;
  width?: number;
}

export function validateFontAxes(
  fontName: string,
  axes: FontAxisInfo[],
  requested: { weight?: number; width?: number }
): void {
  // Static fonts have no axes — skip validation entirely
  if (axes.length === 0) return;

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

export function getFontCacheFileName(
  fontName: string,
  options: FontLoadOptions = {}
): string {
  const normalized = normalizeFontName(fontName);
  const weight = options.weight ?? 400;
  return `${normalized}-wght-${weight}.ttf`;
}

export async function loadFont(
  fontName: string,
  options: FontLoadOptions = {}
): Promise<FontLoadResult> {
  const cacheDir = getCacheDir();
  const normalized = normalizeFontName(fontName);
  const fontDir = join(cacheDir, normalized);
  const fontPath = join(fontDir, getFontCacheFileName(fontName, options));

  if (!existsSync(fontPath)) {
    await downloadFont(fontName, fontDir, fontPath, options);
  }

  const buffer = await readFile(fontPath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const font = opentype.parse(arrayBuffer);

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

const TTF_USER_AGENT =
  "Mozilla/5.0 (Linux; U; Android 2.2) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1";

async function downloadFont(
  fontName: string,
  fontDir: string,
  fontPath: string,
  options: FontLoadOptions
): Promise<void> {
  const attempts = buildGoogleFontsCssUrls(fontName, options);

  let css = "";
  let cssResponse: Response | undefined;

  for (const cssUrl of attempts) {
    cssResponse = await fetch(cssUrl, {
      headers: { "User-Agent": TTF_USER_AGENT },
    });

    if (cssResponse.ok) {
      css = await cssResponse.text();
      break;
    }
  }

  if (!cssResponse?.ok) {
    throw new Error(
      `Google Font "${fontName}" not found. Check the font name at https://fonts.google.com`
    );
  }

  const urlMatch = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"]truetype['"]\)/);
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

export function buildGoogleFontsCssUrls(
  fontName: string,
  options: FontLoadOptions = {}
): string[] {
  const weight = options.weight ?? 400;
  const exactWeight = encodeURIComponent(`${fontName}:wght@${weight}`);
  const variableWeight = encodeURIComponent(`${fontName}:wght@100..900`);

  return [
    `https://fonts.googleapis.com/css2?family=${exactWeight}`,
    `https://fonts.googleapis.com/css2?family=${variableWeight}`,
  ];
}
