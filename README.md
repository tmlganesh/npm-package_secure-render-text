# secure-render-text

> Camera-resistant text rendering for the web: readable to humans, hostile to cameras and OCR.

![npm version](https://img.shields.io/npm/v/secure-render-text?logo=npm&color=cb3837)
![npm downloads](https://img.shields.io/npm/dm/secure-render-text?logo=npm&color=0b7a75)
![license](https://img.shields.io/github/license/tmlganesh/npm-package_secure-render-text?color=3a86ff)

## Intro

secure-render-text is an open-source JavaScript/TypeScript library that renders sensitive text on HTML Canvas using camera-resistant visual techniques.
It is designed for scenarios where users must read content on-screen, but direct camera capture, screenshot OCR, and high-confidence text extraction should be significantly harder.

Use it to add an additional visual protection layer in modern web apps handling confidential or high-value text.

## Features

- 🔒 Camera-resistant canvas text rendering
- ⚡ High-FPS temporal fragmentation (1-120)
- 🧩 Layered glyph composition for capture disruption
- 🎛️ Pattern options: stripe, diagonal, crosshatch
- 🌊 Optional distortion pass for dynamic visual instability
- 🧠 TypeScript-first developer experience
- 📦 ESM + CJS package exports
- ✅ Tested with Vitest

## Installation

```bash
npm install secure-render-text
```

## Quick Start (JavaScript)

```html
<canvas id="secure-canvas"></canvas>
```

```js
import SecureRender from "secure-render-text";

SecureRender.render({
  element: "#secure-canvas",
  text: "Confidential",
  fps: 90,
  pattern: "stripe",
  distortion: true,
});

// Later, stop animation and release resources.
SecureRender.stop();
```

## Canvas Usage Example

```js
import SecureRender from "secure-render-text";

const canvas = document.getElementById("secure-canvas");

SecureRender.render({
  element: canvas,
  text: "Exam Access Code: 7F4X-91",
  fps: 110,
  pattern: "crosshatch",
  distortion: true,
});
```

## How The Rendering System Works

secure-render-text combines multiple disruption layers:

1. **Temporal frame fragmentation**
Characters are split into alternating fragments rendered across rapid frames. Human persistence of vision fuses them, while camera frame sampling often captures incomplete glyph states.

2. **Layered glyph rendering**
Text is not emitted as a single static shape. Layered render passes create unstable edges and structure that can reduce OCR confidence.

3. **Micro-pattern stripe rendering**
Fine stripe/diagonal/crosshatch fills introduce high-frequency detail that can trigger moire-like interference under camera sensors.

4. **Canvas-driven dynamic drawing**
Frame-by-frame updates maintain subtle motion and variation over time, making static capture and reconstruction harder.

## Demo

The project includes a live demo in the [demo/](demo) folder.

Run locally:

```bash
npm run build
```

Then open [demo/index.html](demo/index.html) in a browser.

## API
### Defaults (Quick Reference)

| Option      | Default Value |
|------------|--------------|
| fps        | `90`         |
| pattern    | `"stripe"`   |
| distortion | `true`       |

### `SecureRender.render(options)`

Starts rendering secure text on a target canvas. If another renderer is active, it is stopped first.

| Option | Type | Required | Default | Description |
|---|---|---|---|---|
| `element` | `string \| HTMLCanvasElement` | Yes | - | CSS selector or direct canvas element |
| `text` | `string` | Yes | - | Text to render (max 500 chars) |
| `fps` | `number` | No | `90` | Render frame rate, range `1-120` |
| `pattern` | `"stripe" \| "diagonal" \| "crosshatch"` | No | `"stripe"` | Glyph fill pattern |
| `distortion` | `boolean` | No | `true` | Enables distortion effect |

Validation behavior:

- Throws if `element` does not resolve to a canvas
- Throws if `text` is not a string or exceeds 500 characters
- Throws if `fps` is outside 1-120
- Throws if `pattern` is not one of `stripe`, `diagonal`, `crosshatch`

### `SecureRender.stop()`

Stops active rendering and releases the current renderer instance.

## Project Structure

```text
secure-render-text/
|- src/          # TypeScript source code
|- dist/         # Bundled build output (generated)
|- demo/         # Browser demo app
|- package.json
|- tsup.config.ts
|- vitest.config.ts
```

## Real-World Use Cases

- 🗂️ Confidential document viewers
- 🧪 Exam and assessment content protection
- 🎬 DRM-style preview text overlays
- 💧 Watermarkable on-screen text surfaces
- 📵 Anti-screenshot UI for sensitive labels

## Performance Considerations

- Best results are typically in the `60-120` FPS range.
- Distortion and complex patterns increase GPU/CPU cost.
- Keep canvas dimensions reasonable for low-power devices.
- Re-render only when content/options change for better efficiency.
- Always call `SecureRender.stop()` when leaving the screen.

## Roadmap

- [ ] Add configurable strength presets (low/medium/high)
- [ ] Add adaptive rendering based on device performance
- [ ] Add watermark embedding modes
- [ ] Add framework examples (React, Vue, Angular)
- [ ] Expand test coverage for rendering edge cases

## Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Install dependencies and run tests.
4. Submit a clear pull request with context.

Development commands:

```bash
npm install
npm run build
npm run test
npm run typecheck
```

## License

ISC

## Author

Built by **tmlganesh**.

- GitHub: https://github.com/tmlganesh
- npm: https://www.npmjs.com/package/secure-render-text
