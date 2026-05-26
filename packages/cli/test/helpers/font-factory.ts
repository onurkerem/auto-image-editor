import opentype from "opentype.js";

/**
 * Creates a minimal test font with known glyph metrics for deterministic testing.
 *
 * - Characters: A-Z, a-z, Turkish chars (ĞğİıŞşÇçÖöÜü), space
 * - unitsPerEm: 1000
 * - Each glyph has advanceWidth = 600
 * - Glyph paths are simple squares (moveTo + lineTo + closePath)
 * - Notched (not composite) so opentype.js can parse the buffer back correctly
 */
export function createTestFont(): ArrayBuffer {
  const notaryGlyph = (unicode: number | undefined): opentype.Glyph => {
    return new opentype.Glyph({
      name: unicode != null ? String.fromCodePoint(unicode) : ".notdef",
      unicode,
      advanceWidth: 600,
      path: new opentype.Path(),
    });
  };

  // Characters to include in the font
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
    "abcdefghijklmnopqrstuvwxyz" +
    " ĞğİıŞşÇçÖöÜü";

  const glyphs: opentype.Glyph[] = [notaryGlyph(undefined)]; // .notdef at index 0

  for (const ch of chars) {
    glyphs.push(notaryGlyph(ch.codePointAt(0)));
  }

  const font = new opentype.Font({
    familyName: "TestFont",
    styleName: "Regular",
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs,
  });

  return font.toArrayBuffer();
}
