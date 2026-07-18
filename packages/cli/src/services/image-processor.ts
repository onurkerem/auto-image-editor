import sharp from "sharp";

type SupportedFormat = "jpeg" | "png" | "webp";

const EXTENSION_MAP: Record<string, SupportedFormat> = {
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".png": "png",
  ".webp": "webp",
};

interface FormatInput {
  outputPath: string;
  inputPath: string;
}

export function resolveFormat(input: FormatInput): SupportedFormat {
  // 1. Output extension
  const outExt = input.outputPath.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (outExt && EXTENSION_MAP[outExt]) {
    return EXTENSION_MAP[outExt];
  }

  // 2. Input extension
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

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace(/^#/, "");
  if (cleanHex.length !== 6 && cleanHex.length !== 3) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  let r = 0, g = 0, b = 0;
  if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  } else {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  }
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return { r, g, b };
}

export function detectBackgroundColor(data: Buffer, width: number, height: number): { r: number; g: number; b: number } {
  const getPixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    return {
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
    };
  };

  const corners = [
    getPixel(0, 0),
    getPixel(width - 1, 0),
    getPixel(0, height - 1),
    getPixel(width - 1, height - 1),
  ];

  const counts: Record<string, { color: { r: number; g: number; b: number }; count: number }> = {};
  for (const c of corners) {
    const key = `${c.r},${c.g},${c.b}`;
    if (!counts[key]) {
      counts[key] = { color: c, count: 0 };
    }
    counts[key].count++;
  }

  let maxCount = -1;
  let bestColor = corners[0];
  for (const key in counts) {
    if (counts[key].count > maxCount) {
      maxCount = counts[key].count;
      bestColor = counts[key].color;
    }
  }
  return bestColor;
}

export interface RemoveBgInput {
  inputPath: string;
  outputPath: string;
  bg?: string;
  tolerance: number;
  format: SupportedFormat;
}

export async function removeBackground(input: RemoveBgInput): Promise<void> {
  const image = sharp(input.inputPath);
  const metadata = await image.metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) {
    throw new Error("Could not read image dimensions.");
  }

  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bgTarget: { r: number; g: number; b: number };
  if (input.bg) {
    bgTarget = parseHexColor(input.bg);
  } else {
    bgTarget = detectBackgroundColor(data, width, height);
  }

  const { r: targetR, g: targetG, b: targetB } = bgTarget;
  const toleranceSq = input.tolerance * input.tolerance;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dr = r - targetR;
    const dg = g - targetG;
    const db = b - targetB;

    const distSq = dr * dr + dg * dg + db * db;
    if (distSq <= toleranceSq) {
      data[i + 3] = 0; // Transparent alpha
    }
  }

  const pipeline = sharp(data, {
    raw: {
      width,
      height,
      channels: 4,
    },
  });

  switch (input.format) {
    case "png":
      await pipeline.png().toFile(input.outputPath);
      break;
    case "webp":
      await pipeline.webp({ quality: 90 }).toFile(input.outputPath);
      break;
    case "jpeg":
      await pipeline.jpeg({ quality: 90 }).toFile(input.outputPath);
      break;
  }
}
