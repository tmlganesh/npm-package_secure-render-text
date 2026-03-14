// SecureRender — public API entry point

import { Renderer } from "./renderer.js";
import type { RenderOptions, PatternType, SecureRenderAPI } from "./renderer.js";

export type { RenderOptions, PatternType, SecureRenderAPI };

const VALID_PATTERNS: PatternType[] = ["stripe", "diagonal", "crosshatch"];

let activeRenderer: Renderer | null = null;

function resolveCanvas(element: string | HTMLCanvasElement): HTMLCanvasElement {
  if (element instanceof HTMLCanvasElement) return element;
  if (typeof element === "string") {
    try {
      const el = document.querySelector(element);
      if (el instanceof HTMLCanvasElement) return el;
    } catch {
      // Invalid CSS selector — fall through to throw below
    }
  }
  throw new Error("SecureRender: element must resolve to an HTMLCanvasElement");
}

const SecureRender: SecureRenderAPI = {
  render(options: RenderOptions): void {
    // Stop any active loop first
    if (activeRenderer) {
      activeRenderer.stop();
      activeRenderer = null;
    }

    // Validate and resolve options
    const canvas = resolveCanvas(options.element);

    if (typeof options.text !== "string" || options.text.length > 500) {
      throw new Error("SecureRender: text exceeds 500 character limit");
    }

    const fps = options.fps ?? 90;
    if (!Number.isFinite(fps) || fps < 1 || fps > 120) {
      throw new Error("SecureRender: fps must be between 1 and 120");
    }

    const pattern = options.pattern ?? "stripe";
    if (!VALID_PATTERNS.includes(pattern)) {
      throw new Error("SecureRender: pattern must be one of stripe | diagonal | crosshatch");
    }

    const distortion = options.distortion ?? true;

    const renderer = new Renderer({ canvas, text: options.text, fps, pattern, distortion });
    renderer.start();
    activeRenderer = renderer;
  },

  stop(): void {
    if (activeRenderer) {
      activeRenderer.stop();
      activeRenderer = null;
    }
  },
};

export default SecureRender;
