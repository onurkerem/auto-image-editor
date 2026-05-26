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
