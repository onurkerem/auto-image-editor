import opentype from "opentype.js";

export interface RenderOptions {
  boxWidth: number;
  boxHeight: number;
  color: string;
  italic?: boolean;
}

export interface RenderResult {
  svg: string;
  fontSize: number;
  offsetX: number;
  offsetY: number;
}

export function measureTextWidth(
  font: opentype.Font,
  text: string,
  fontSize: number
): number {
  return font.getAdvanceWidth(text, fontSize);
}

export function wrapText(
  font: opentype.Font,
  text: string,
  maxWidth: number,
  fontSize: number
): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = `${currentLine} ${words[i]}`;
    const width = measureTextWidth(font, testLine, fontSize);
    if (width > maxWidth) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  return lines;
}

export function autoSizeAndRender(
  font: opentype.Font,
  text: string,
  options: RenderOptions
): RenderResult {
  const { boxWidth, boxHeight, color, italic = false } = options;
  const lineHeightMultiplier = 1.2;
  const outlineColor = "#000000";
  const italicAngle = italic ? -10 : 0;
  const italicTranslate = italic
    ? Math.ceil(
        (Math.tan((Math.abs(italicAngle) * Math.PI) / 180) * boxHeight) / 2
      )
    : 0;
  const paddingForSize = (fontSize: number): number =>
    Math.max(4, Math.ceil(fontSize * 0.18));

  let low = 1;
  let high = boxHeight;
  let bestSize = low;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const padding = paddingForSize(mid);
    const lines = wrapText(font, text, boxWidth - padding * 2, mid);
    const totalHeight = lines.length * mid * lineHeightMultiplier;

    if (
      totalHeight <= boxHeight - padding * 2 &&
      lines.every(
        (line) => measureTextWidth(font, line, mid) <= boxWidth - padding * 2
      )
    ) {
      bestSize = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const fontSize = bestSize;
  const padding = paddingForSize(fontSize);
  const outlineWidth = Math.max(3, Math.round(fontSize * 0.2));
  const lines = wrapText(font, text, boxWidth - padding * 2, fontSize);
  const lineHeight = fontSize * lineHeightMultiplier;
  const pathGroupTransform = italic
    ? ` transform="translate(${italicTranslate} 0) skewX(${italicAngle})"`
    : "";

  // Build SVG paths
  const totalTextHeight = lines.length * lineHeight;

  const pathElements: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lineWidth = measureTextWidth(font, lines[i], fontSize);
    const lineX = (boxWidth - lineWidth) / 2;
    const lineY =
      (boxHeight - totalTextHeight) / 2 + (i + 1) * lineHeight;

    const path = font.getPath(
      lines[i],
      lineX,
      lineY - fontSize * 0.2,
      fontSize
    );
    pathElements.push(path.toSVG(2));
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${boxWidth}" height="${boxHeight}">`,
    ...pathElements.map(
      (p) =>
        `  <g${pathGroupTransform} fill="none" stroke="${outlineColor}" stroke-width="${outlineWidth}" stroke-linejoin="round" stroke-linecap="round">${p}</g>`
    ),
    ...pathElements.map((p) => `  <g${pathGroupTransform} fill="${color}">${p}</g>`),
    "</svg>",
  ].join("\n");

  return {
    svg,
    fontSize,
    offsetX: 0,
    offsetY: 0,
  };
}
