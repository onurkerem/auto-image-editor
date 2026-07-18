import { Command } from "commander";
import { access } from "node:fs/promises";
import { removeBackground, resolveFormat } from "../services/image-processor.js";

export function registerRemoveBgCommand(program: Command): void {
  program
    .command("remove-bg")
    .description("Remove background color from an image")
    .requiredOption("--input <path>", "Path to source image")
    .requiredOption("--output <path>", "Path for output image")
    .option("--bg <color>", "Background color to remove as a hex code (e.g. #FFFFFF or FFFFFF)")
    .option("--tolerance <number>", "Color similarity threshold (0-255)", "15")
    .action(async (opts) => {
      try {
        await removeBgAction(opts);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        process.exit(1);
      }
    });
}

interface RemoveBgOptions {
  input: string;
  output: string;
  bg?: string;
  tolerance: string;
}

export async function removeBgAction(opts: RemoveBgOptions): Promise<void> {
  // Validate input file exists
  try {
    await access(opts.input);
  } catch {
    throw new Error(`Input file not found: ${opts.input}`);
  }

  // Resolve output format
  const format = resolveFormat({
    outputPath: opts.output,
    inputPath: opts.input,
  });

  if (format === "jpeg") {
    throw new Error("JPEG format does not support alpha transparency. Please use PNG or WebP output format.");
  }

  const tolerance = parseInt(opts.tolerance, 10);
  if (isNaN(tolerance) || tolerance < 0 || tolerance > 255) {
    throw new Error("Tolerance must be a number between 0 and 255.");
  }

  await removeBackground({
    inputPath: opts.input,
    outputPath: opts.output,
    bg: opts.bg,
    tolerance,
    format,
  });
}
