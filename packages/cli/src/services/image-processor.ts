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
