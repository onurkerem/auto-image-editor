import { describe, it, expect } from "vitest";
import {
  buildGoogleFontsCssUrls,
  getFontCacheFileName,
  validateFontAxes,
  type FontAxisInfo,
} from "../src/services/font-loader.js";

describe("validateFontAxes", () => {
  const axesWithBoth: FontAxisInfo[] = [
    { tag: "wght", minValue: 100, defaultValue: 400, maxValue: 900 },
    { tag: "wdth", minValue: 75, defaultValue: 100, maxValue: 125 },
  ];

  const axesWithWeightOnly: FontAxisInfo[] = [
    { tag: "wght", minValue: 100, defaultValue: 400, maxValue: 900 },
  ];

  it("passes when all requested axes are supported", () => {
    expect(() =>
      validateFontAxes("TestFont", axesWithBoth, { weight: 600, width: 100 })
    ).not.toThrow();
  });

  it("passes when only weight is requested and supported", () => {
    expect(() =>
      validateFontAxes("TestFont", axesWithWeightOnly, { weight: 600 })
    ).not.toThrow();
  });

  it("throws when width axis is not supported", () => {
    expect(() =>
      validateFontAxes("TestFont", axesWithWeightOnly, { weight: 600, width: 100 })
    ).toThrow('Font "TestFont" does not support the width axis');
  });

  it("throws when weight is out of range", () => {
    expect(() =>
      validateFontAxes("TestFont", axesWithBoth, { weight: 950, width: 100 })
    ).toThrow('Font "TestFont" weight value 950 is out of range');
  });

  it("throws when width is out of range", () => {
    expect(() =>
      validateFontAxes("TestFont", axesWithBoth, { weight: 600, width: 200 })
    ).toThrow('Font "TestFont" width value 200 is out of range');
  });
});

describe("font download planning", () => {
  it("uses a weight-specific cache file for requested static weights", () => {
    expect(getFontCacheFileName("Geom", { weight: 900 })).toBe("geom-wght-900.ttf");
  });

  it("requests the exact static weight before falling back to a variable font", () => {
    const urls = buildGoogleFontsCssUrls("Roboto Condensed", { weight: 900 });

    expect(urls[0]).toContain("family=Roboto%20Condensed%3Awght%40900");
    expect(urls[1]).toContain("family=Roboto%20Condensed%3Awght%40100..900");
  });
});
