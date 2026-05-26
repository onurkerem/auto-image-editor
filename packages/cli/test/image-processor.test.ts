import { describe, it, expect, beforeAll, afterAll } from "vitest";
import sharp from "sharp";
import { resolveFormat, compositeText } from "../src/services/image-processor.js";
import { unlink, mkdir } from "node:fs/promises";
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
