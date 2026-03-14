# secure-render-text

A browser-based camera-resistant text rendering engine. Renders text that is readable to human eyes but difficult for phone cameras to capture clearly.

## How it works

Four complementary techniques are layered together:

**Temporal frame fragmentation** — each character is split into two pixel layers that alternate at 90–120 Hz. Human persistence of vision merges the layers into readable text; a camera shutter captures only one incomplete layer.

**Micro-pattern glyph rendering** — characters are drawn using thin stripe, diagonal, or crosshatch fills instead of solid color. When photographed, the fine periodic patterns create moiré interference that degrades readability.

**Dynamic pixel noise** — a WebGL fragment shader adds subtle per-pixel noise that varies every frame, disrupting camera auto-focus and image reconstruction.

**GPU shader distortion** — a second fragment shader applies sine-wave and pseudo-random pixel displacement parameterised by the current timestamp, introducing sub-pixel shifts that compound camera capture difficulty.

## Installation

```bash
npm install secure-render-text
```

## Usage

```html
<canvas id="myCanvas"></canvas>
```

```js
import SecureRender from "secure-render-text";

SecureRender.render({
  element: "#myCanvas",   // CSS selector or HTMLCanvasElement
  text: "Confidential",   // up to 500 characters
  fps: 90,                // 1–120, default 90
  pattern: "stripe",      // "stripe" | "diagonal" | "crosshatch"
  distortion: true,       // enable WebGL distortion pass
});

// Stop the render loop and release GPU resources
SecureRender.stop();
```

## API

### `SecureRender.render(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `element` | `string \| HTMLCanvasElement` | required | Target canvas |
| `text` | `string` | required | Text to render (max 500 chars) |
| `fps` | `number` | `90` | Frame alternation rate (1–120) |
| `pattern` | `"stripe" \| "diagonal" \| "crosshatch"` | `"stripe"` | Glyph fill pattern |
| `distortion` | `boolean` | `true` | Enable shader distortion pass |

### `SecureRender.stop()`

Halts the render loop and releases all WebGL resources. Safe to call when not rendering.

## Demo

```bash
npm run build
# then open demo/index.html in a browser
```

## Limitations

- **Slow-motion cameras** (240+ fps) can capture individual frames, defeating temporal fragmentation.
- **Screen recording software** captures the composited display output and bypasses all anti-camera effects.
- **High-DPI displays** may render pattern lines at sufficient size to be photographed without moiré.
- **Accessibility** — screen readers cannot read canvas-rendered text; provide an accessible alternative for sensitive content.
- **WebGL required** — browsers without WebGL support will throw an error on render.

## Future extensions

- **Watermark overlay** — embed invisible per-session watermarks into the noise layer.
- **Camera detection** — use `getUserMedia` to detect active camera streams and increase distortion intensity.
- **AI-based distortion** — apply learned adversarial perturbations tuned against OCR models.
- **Mobile SDK** — native iOS/Android implementations using Metal/Vulkan shaders.
