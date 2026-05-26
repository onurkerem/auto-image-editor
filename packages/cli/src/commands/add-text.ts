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
    .option("--left <value>", "Left edge of text box", "10%")
    .option("--right <value>", "Right edge of text box", "10%")
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
