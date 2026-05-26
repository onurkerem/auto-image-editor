import { describe, it, expect, beforeEach } from "vitest";
import opentype from "opentype.js";
import {
  measureTextWidth,
  wrapText,
  autoSizeAndRender,
} from "../src/services/text-renderer.js";
import { createTestFont } from "./helpers/font-factory.js";

describe("text renderer", () => {
  let font: opentype.Font;

  beforeEach(() => {
    const buffer = createTestFont();
    font = opentype.parse(buffer.buffer);
  });

  describe("measureTextWidth", () => {
    it("measures width of a string at given font size", () => {
      const width = measureTextWidth(font, "ABC", 48);
      // Each glyph has advanceWidth=600, unitsPerEm=1000
      // width = (600+600+600)/1000 * 48 = 86.4
      expect(width).toBeCloseTo(86.4, 1);
    });

    it("returns 0 for empty string", () => {
      expect(measureTextWidth(font, "", 48)).toBe(0);
    });
  });

  describe("wrapText", () => {
    it("returns single line when text fits", () => {
      const lines = wrapText(font, "AB", 200, 48);
      expect(lines).toEqual(["AB"]);
    });

    it("breaks text into multiple lines when it exceeds width", () => {
      const lines = wrapText(font, "A B C D E F", 60, 48);
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  describe("autoSizeAndRender", () => {
    it("returns SVG paths that fit within the box", () => {
      const result = autoSizeAndRender(font, "HELLO WORLD", {
        boxWidth: 500,
        boxHeight: 100,
        color: "#FFFFFF",
      });
      expect(result.fontSize).toBeGreaterThan(0);
      expect(result.svg).toContain("<svg");
      expect(result.svg).toContain("<path");
    });

    it("produces valid SVG with correct dimensions", () => {
      const result = autoSizeAndRender(font, "AB", {
        boxWidth: 500,
        boxHeight: 100,
        color: "#FFE600",
      });
      expect(result.svg).toContain('width="500"');
      expect(result.svg).toContain('height="100"');
    });

    it("renders the default thumbnail style with yellow fill and black outline", () => {
      const result = autoSizeAndRender(font, "AB", {
        boxWidth: 500,
        boxHeight: 100,
        color: "#FFE600",
        italic: true,
      });

      const outlineIndex = result.svg.indexOf('stroke="#000000"');
      const fillIndex = result.svg.indexOf('fill="#FFE600"');
      const strokeWidth = result.svg.match(/stroke-width="(\d+)"/)?.[1];

      expect(outlineIndex).toBeGreaterThan(-1);
      expect(fillIndex).toBeGreaterThan(-1);
      expect(outlineIndex).toBeLessThan(fillIndex);
      expect(result.svg).toContain('stroke-linejoin="round"');
      expect(Number(strokeWidth)).toBeGreaterThanOrEqual(12);
      expect(result.svg).toContain('transform="translate');
      expect(result.svg).toContain("skewX(-10)");
    });

    it("centers italic slant around the text box instead of pushing text to one side", () => {
      const result = autoSizeAndRender(font, "AB", {
        boxWidth: 500,
        boxHeight: 100,
        color: "#FFE600",
        italic: true,
      });

      expect(result.svg).toContain('transform="translate(9 0) skewX(-10)"');
    });
  });
});
