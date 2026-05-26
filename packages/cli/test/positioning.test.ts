import { describe, it, expect } from "vitest";
import {
  parsePositionValue,
  computeTextBox,
  type ImageDimensions,
} from "../src/utils/positioning.js";

describe("parsePositionValue", () => {
  it("parses percentage values", () => {
    expect(parsePositionValue("80%")).toEqual({ type: "percent", value: 80 });
  });

  it("parses pixel values", () => {
    expect(parsePositionValue("800px")).toEqual({ type: "pixel", value: 800 });
  });

  it("treats bare numbers as percentages", () => {
    expect(parsePositionValue("60")).toEqual({ type: "percent", value: 60 });
  });

  it("throws on invalid format", () => {
    expect(() => parsePositionValue("abc")).toThrow(
      'Invalid position value: "abc". Expected format: "80%", "800px", or a bare number.'
    );
  });

  it("throws on negative values", () => {
    expect(() => parsePositionValue("-5%")).toThrow("negative");
  });
});

describe("computeTextBox", () => {
  const image: ImageDimensions = { width: 1000, height: 800 };

  it("computes box from percentage values", () => {
    const box = computeTextBox(
      { top: "10%", bottom: "10%", left: "5%", right: "5%" },
      image
    );
    expect(box).toEqual({ x: 50, y: 80, width: 900, height: 640 });
  });

  it("computes box from pixel values", () => {
    const box = computeTextBox(
      { top: "100px", bottom: "50px", left: "20px", right: "30px" },
      image
    );
    expect(box).toEqual({ x: 20, y: 100, width: 950, height: 650 });
  });

  it("throws with defaults on 1000x800 image because right=100% gives zero width", () => {
    expect(() =>
      computeTextBox(
        { top: "60%", bottom: "6%", left: "0%", right: "100%" },
        { width: 1000, height: 800 }
      )
    ).toThrow("Text box has zero or negative area");
  });

  it("throws when box has zero or negative width", () => {
    expect(() =>
      computeTextBox(
        { top: "0%", bottom: "0%", left: "50%", right: "50%" },
        image
      )
    ).toThrow("Text box has zero or negative area");
  });

  it("throws when box has negative height", () => {
    expect(() =>
      computeTextBox(
        { top: "90%", bottom: "5%", left: "0%", right: "100%" },
        image
      )
    ).toThrow("Text box has zero or negative area");
  });
});
