import opentype from "opentype.js";

export function createTestFont(
  options: {
    familyName?: string;
  } = {}
): Buffer {
  const { familyName = "TestFont" } = options;

  const notdefGlyph = new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: 650,
    path: new opentype.Path(),
  });

  const glyphs: opentype.Glyph[] = [notdefGlyph];

  // Add A-Z
  for (let i = 65; i <= 90; i++) {
    const char = String.fromCharCode(i);
    const glyph = new opentype.Glyph({
      name: char,
      unicode: i,
      advanceWidth: 600,
      path: new opentype.Path(),
    });
    glyphs.push(glyph);
  }

  // Add a-z
  for (let i = 97; i <= 122; i++) {
    const char = String.fromCharCode(i);
    const glyph = new opentype.Glyph({
      name: char,
      unicode: i,
      advanceWidth: 500,
      path: new opentype.Path(),
    });
    glyphs.push(glyph);
  }

  // Add Turkish special characters
  const turkishChars = [
    { name: "I.dot", unicode: 304, advanceWidth: 600 },   // İ
    { name: "i.dotless", unicode: 305, advanceWidth: 500 }, // ı
    { name: "G.breve", unicode: 286, advanceWidth: 700 },  // Ğ
    { name: "g.breve", unicode: 287, advanceWidth: 500 },  // ğ
    { name: "O.umlaut", unicode: 214, advanceWidth: 700 }, // Ö
    { name: "o.umlaut", unicode: 246, advanceWidth: 500 }, // ö
    { name: "U.umlaut", unicode: 220, advanceWidth: 700 }, // Ü
    { name: "u.umlaut", unicode: 252, advanceWidth: 500 }, // ü
    { name: "S.cedilla", unicode: 350, advanceWidth: 600 },  // Ş
    { name: "s.cedilla", unicode: 351, advanceWidth: 500 },  // ş
    { name: "C.cedilla", unicode: 199, advanceWidth: 700 },  // Ç
    { name: "c.cedilla", unicode: 231, advanceWidth: 500 },  // ç
  ];

  for (const tc of turkishChars) {
    glyphs.push(
      new opentype.Glyph({
        name: tc.name,
        unicode: tc.unicode,
        advanceWidth: tc.advanceWidth,
        path: new opentype.Path(),
      })
    );
  }

  // Add space
  glyphs.push(
    new opentype.Glyph({
      name: "space",
      unicode: 32,
      advanceWidth: 300,
      path: new opentype.Path(),
    })
  );

  const font = new opentype.Font({
    familyName,
    styleName: "Regular",
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs,
  });

  return Buffer.from(font.toArrayBuffer());
}
