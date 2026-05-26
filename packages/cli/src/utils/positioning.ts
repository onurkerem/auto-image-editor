export interface PositionValue {
  type: "percent" | "pixel";
  value: number;
}

export interface PositionInput {
  top: string;
  bottom: string;
  left: string;
  right: string;
}

export interface PixelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export function parsePositionValue(raw: string): PositionValue {
  const trimmed = raw.trim();
  if (trimmed.endsWith("%")) {
    const num = parseFloat(trimmed.slice(0, -1));
    if (isNaN(num) || num < 0) {
      throw new Error(
        `Invalid position value: "${raw}". Percentage must be a non-negative number.`
      );
    }
    return { type: "percent", value: num };
  }
  if (trimmed.endsWith("px")) {
    const num = parseFloat(trimmed.slice(0, -2));
    if (isNaN(num) || num < 0) {
      throw new Error(
        `Invalid position value: "${raw}". Pixel value must be a non-negative number.`
      );
    }
    return { type: "pixel", value: num };
  }
  const num = parseFloat(trimmed);
  if (isNaN(num) || num < 0) {
    throw new Error(
      `Invalid position value: "${raw}". Expected format: "80%", "800px", or a bare number.`
    );
  }
  return { type: "percent", value: num };
}

export function computeTextBox(
  position: PositionInput,
  image: ImageDimensions
): PixelBox {
  const top = parsePositionValue(position.top);
  const bottom = parsePositionValue(position.bottom);
  const left = parsePositionValue(position.left);
  const right = parsePositionValue(position.right);

  const resolveX = (v: PositionValue) =>
    v.type === "percent" ? (v.value / 100) * image.width : v.value;
  const resolveY = (v: PositionValue) =>
    v.type === "percent" ? (v.value / 100) * image.height : v.value;

  const x = resolveX(left);
  const boxRight = image.width - resolveX(right);
  const y = resolveY(top);
  const boxBottom = image.height - resolveY(bottom);

  const width = boxRight - x;
  const height = boxBottom - y;

  if (width <= 0 || height <= 0) {
    throw new Error(
      `Text box has zero or negative area (${width}x${height}px). Check your position values.`
    );
  }

  return { x, y, width, height };
}
