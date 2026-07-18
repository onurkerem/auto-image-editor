import { describe, it, expect, beforeAll, afterAll } from "vitest";
import sharp from "sharp";
import { addTextAction } from "../src/commands/add-text.js";
import { removeBgAction } from "../src/commands/remove-bg.js";
import { unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("integration: add-text command", () => {
  const testDir = join(tmpdir(), "auto-image-editor-integration");
  const inputPath = join(testDir, "photo.jpg");
  const outputPath = join(testDir, "output.jpg");

  beforeAll(async () => {
    await mkdir(testDir, { recursive: true });
    await sharp({
      create: {
        width: 1000,
        height: 800,
        channels: 3,
        background: { r: 50, g: 100, b: 150 },
      },
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
      italic: "false",
      top: "80%",
      bottom: "5%",
      left: "5%",
      right: "5%",
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
      italic: "false",
      top: "80%",
      bottom: "5%",
      left: "5%",
      right: "5%",
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
        italic: "false",
        top: "80%",
        bottom: "5%",
        left: "5%",
        right: "5%",
      })
    ).rejects.toThrow("Input file not found");
  });

  describe("integration: remove-bg command", () => {
    const pngOutputPath = join(testDir, "remove-bg-out.png");

    it("removes background and outputs PNG successfully", async () => {
      await removeBgAction({
        input: inputPath,
        output: pngOutputPath,
        bg: "#326496", // Matches inputPath background color r: 50, g: 100, b: 150 -> #326496
        tolerance: "10",
      });

      const metadata = await sharp(pngOutputPath).metadata();
      expect(metadata.width).toBe(1000);
      expect(metadata.height).toBe(800);
      expect(metadata.format).toBe("png");

      // Cleanup
      await unlink(pngOutputPath).catch(() => {});
    });

    it("errors on output format that does not support transparency (JPEG)", async () => {
      await expect(
        removeBgAction({
          input: inputPath,
          output: outputPath, // outputPath resolves to jpeg (.jpg)
          bg: "#326496",
          tolerance: "10",
        })
      ).rejects.toThrow("JPEG format does not support alpha transparency");
    });

    it("errors on invalid tolerance", async () => {
      await expect(
        removeBgAction({
          input: inputPath,
          output: pngOutputPath,
          bg: "#326496",
          tolerance: "300",
        })
      ).rejects.toThrow("Tolerance must be a number between 0 and 255");
    });
  });
});
