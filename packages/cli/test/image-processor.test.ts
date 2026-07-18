import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { resolveFormat, compositeText, parseHexColor, detectBackgroundColor, removeBackground } from "../src/services/image-processor.js";
import { unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("image processor", () => {
  const testDir = join(tmpdir(), "auto-image-editor-test");

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
  });

  describe("resolveFormat", () => {
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

  describe("parseHexColor", () => {
    it("parses 6-character hex colors with and without #", () => {
      expect(parseHexColor("#FF00FF")).toEqual({ r: 255, g: 0, b: 255 });
      expect(parseHexColor("00FF00")).toEqual({ r: 0, g: 255, b: 0 });
    });

    it("parses 3-character hex colors with and without #", () => {
      expect(parseHexColor("#F0F")).toEqual({ r: 255, g: 0, b: 255 });
      expect(parseHexColor("0F0")).toEqual({ r: 0, g: 255, b: 0 });
    });

    it("throws on invalid hex formats", () => {
      expect(() => parseHexColor("invalid")).toThrow("Invalid hex color");
      expect(() => parseHexColor("#GGGGGG")).toThrow("Invalid hex color");
    });
  });

  describe("detectBackgroundColor", () => {
    it("chooses the majority corner color", () => {
      // Create a 2x2 image buffer with colors:
      // TL: Red, TR: Green, BL: Green, BR: Green
      // Green is 0, 255, 0
      const width = 2;
      const height = 2;
      const data = Buffer.alloc(width * height * 4);
      // Red at TL (0,0)
      data[0] = 255; data[1] = 0; data[2] = 0; data[3] = 255;
      // Green at TR (1,0)
      data[4] = 0; data[5] = 255; data[6] = 0; data[7] = 255;
      // Green at BL (0,1)
      data[8] = 0; data[9] = 255; data[10] = 0; data[11] = 255;
      // Green at BR (1,1)
      data[12] = 0; data[13] = 255; data[14] = 0; data[15] = 255;

      expect(detectBackgroundColor(data, width, height)).toEqual({ r: 0, g: 255, b: 0 });
    });

    it("falls back to top-left if there is a tie", () => {
      // TL: Red, TR: Green, BL: Red, BR: Green
      const width = 2;
      const height = 2;
      const data = Buffer.alloc(width * height * 4);
      // Red
      data[0] = 255; data[1] = 0; data[2] = 0; data[3] = 255;
      // Green
      data[4] = 0; data[5] = 255; data[6] = 0; data[7] = 255;
      // Red
      data[8] = 255; data[9] = 0; data[10] = 0; data[11] = 255;
      // Green
      data[12] = 0; data[13] = 255; data[14] = 0; data[15] = 255;

      // Red and Green have equal count (2). Red (top-left) wins.
      expect(detectBackgroundColor(data, width, height)).toEqual({ r: 255, g: 0, b: 0 });
    });
  });

  describe("removeBackground", () => {
    it("removes background color within tolerance and preserves foreground", async () => {
      const inputPath = join(testDir, "remove-bg-input.png");
      const outputPath = join(testDir, "remove-bg-output.png");

      // Create a 2x2 image:
      // (0,0): Red (255, 0, 0)
      // (1,0): Near-Red (250, 2, 2)
      // (0,1): White (255, 255, 255)
      // (1,1): Red (255, 0, 0)
      // We will remove Red (255, 0, 0) with tolerance 15.
      // Euclidean distance of (250, 2, 2) from (255, 0, 0) is sqrt(5^2 + 2^2 + 2^2) = sqrt(33) = ~5.74 <= 15.
      // So (0,0), (1,0), (1,1) should become transparent.
      // (0,1) (White) distance is sqrt(0 + 255^2 + 255^2) > 15, so it should stay opaque.

      const inputBuffer = Buffer.alloc(2 * 2 * 4);
      // (0,0) Red
      inputBuffer[0] = 255; inputBuffer[1] = 0; inputBuffer[2] = 0; inputBuffer[3] = 255;
      // (1,0) Near-Red
      inputBuffer[4] = 250; inputBuffer[5] = 2; inputBuffer[6] = 2; inputBuffer[7] = 255;
      // (0,1) White
      inputBuffer[8] = 255; inputBuffer[9] = 255; inputBuffer[10] = 255; inputBuffer[11] = 255;
      // (1,1) Red
      inputBuffer[12] = 255; inputBuffer[13] = 0; inputBuffer[14] = 0; inputBuffer[15] = 255;

      await sharp(inputBuffer, { raw: { width: 2, height: 2, channels: 4 } })
        .png()
        .toFile(inputPath);

      await removeBackground({
        inputPath,
        outputPath,
        bg: "#FF0000",
        tolerance: 15,
        format: "png",
      });

      const outputRaw = await sharp(outputPath)
        .raw()
        .toBuffer();

      // (0,0) transparent
      expect(outputRaw[3]).toBe(0);
      // (1,0) transparent
      expect(outputRaw[7]).toBe(0);
      // (0,1) opaque white
      expect(outputRaw[8]).toBe(255);
      expect(outputRaw[9]).toBe(255);
      expect(outputRaw[10]).toBe(255);
      expect(outputRaw[11]).toBe(255);
      // (1,1) transparent
      expect(outputRaw[15]).toBe(0);

      // Cleanup
      await unlink(inputPath);
      await unlink(outputPath);
    });

    it("auto-detects background color when bg is not specified", async () => {
      const inputPath = join(testDir, "remove-bg-auto-input.png");
      const outputPath = join(testDir, "remove-bg-auto-output.png");

      // Create a 2x2 image where 3 corners are Blue (0, 0, 255)
      // (0,0): Blue
      // (1,0): Green (foreground)
      // (0,1): Blue
      // (1,1): Blue
      const inputBuffer = Buffer.alloc(2 * 2 * 4);
      // (0,0) Blue
      inputBuffer[0] = 0; inputBuffer[1] = 0; inputBuffer[2] = 255; inputBuffer[3] = 255;
      // (1,0) Green
      inputBuffer[4] = 0; inputBuffer[5] = 255; inputBuffer[6] = 0; inputBuffer[7] = 255;
      // (0,1) Blue
      inputBuffer[8] = 0; inputBuffer[9] = 0; inputBuffer[10] = 255; inputBuffer[11] = 255;
      // (1,1) Blue
      inputBuffer[12] = 0; inputBuffer[13] = 0; inputBuffer[14] = 255; inputBuffer[15] = 255;

      await sharp(inputBuffer, { raw: { width: 2, height: 2, channels: 4 } })
        .png()
        .toFile(inputPath);

      // Call without bg parameter
      await removeBackground({
        inputPath,
        outputPath,
        tolerance: 5,
        format: "png",
      });

      const outputRaw = await sharp(outputPath)
        .raw()
        .toBuffer();

      // (0,0) transparent (detected background)
      expect(outputRaw[3]).toBe(0);
      // (1,0) opaque green (foreground)
      expect(outputRaw[4]).toBe(0);
      expect(outputRaw[5]).toBe(255);
      expect(outputRaw[6]).toBe(0);
      expect(outputRaw[7]).toBe(255);
      // (0,1) transparent
      expect(outputRaw[11]).toBe(0);
      // (1,1) transparent
      expect(outputRaw[15]).toBe(0);

      // Cleanup
      await unlink(inputPath);
      await unlink(outputPath);
    });
  });
});

