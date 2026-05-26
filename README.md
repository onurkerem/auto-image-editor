# auto-image-editor

A CLI tool for adding text overlays to images with support for Google Fonts, variable font axes, and locale-aware text casing.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/onurkerem/auto-image-editor/main/install.sh | sh
```

Or pin a specific version:

```sh
VERSION=1.0.0 curl -fsSL https://raw.githubusercontent.com/onurkerem/auto-image-editor/main/install.sh | sh
```

## Uninstall

```sh
rm -rf ~/.auto-image-editor /usr/local/bin/auto-image-editor
```

## Usage

```bash
auto-image-editor add-text \
  --input photo.jpg --output out.jpg \
  --text "Hello World"
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--input` | required | Source image path (PNG, JPEG, WebP) |
| `--output` | required | Output image path (format inferred from extension) |
| `--text` | required | Text to overlay |
| `--lang` | `tr` | Language code for locale-aware casing |
| `--uppercase` | `true` | Convert text to uppercase |
| `--font` | `Geom` | Google Font family name |
| `--color` | `#FFFFFF` | Text color |
| `--weight` | `600` | Font weight axis (100–900) |
| `--width` | `100` | Font width axis percentage |
| `--top` | `60%` | Top edge of text box |
| `--bottom` | `6%` | Bottom edge of text box |
| `--left` | `10%` | Left edge of text box |
| `--right` | `10%` | Right edge of text box |

## Development

```bash
cd packages/cli
npm install
npm test
npm run dev -- add-text --input test.jpg --output out.jpg --text "Test"
```

## License

MIT
