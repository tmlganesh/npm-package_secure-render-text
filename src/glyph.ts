// GlyphEngine — rasterises characters onto offscreen canvases using micro-pattern fills

import { PatternEngine } from "./patternEngine.js";
import type { PatternType } from "./renderer.js";

export interface GlyphBitmap {
  char: string;
  width: number;
  height: number;
  imageData: ImageData;
}

export class GlyphEngine {
  private fontSize: number;
  private pattern: PatternType;

  constructor(fontSize: number, pattern: PatternType) {
    this.fontSize = fontSize;
    this.pattern = pattern;
  }

  renderGlyphs(text: string): GlyphBitmap[] {
    // Temporary canvas to get a 2D context for PatternEngine and text measurement
    const measureCanvas = document.createElement("canvas");
    measureCanvas.width = this.fontSize * 2;
    measureCanvas.height = this.fontSize * 2;
    const measureCtx = measureCanvas.getContext("2d")!;

    const font = `${this.fontSize}px monospace`;
    measureCtx.font = font;

    const patternEngine = new PatternEngine(measureCtx);
    const canvasPattern = patternEngine.getPattern(this.pattern);

    const glyphs: GlyphBitmap[] = [];

    for (const char of text) {
      const metrics = measureCtx.measureText(char);
      const width = Math.max(Math.ceil(metrics.width), 1);
      const height = this.fontSize;

      const offscreen = document.createElement("canvas");
      offscreen.width = width;
      offscreen.height = height;
      const ctx = offscreen.getContext("2d")!;

      ctx.font = font;
      // Use the character shape as a clip mask, then fill with the pattern
      ctx.save();
      ctx.beginPath();
      const baseline = Math.round(this.fontSize * 0.8);
      // fillText with pattern fill renders the glyph using the micro-pattern
      ctx.fillStyle = canvasPattern;
      ctx.fillText(char, 0, baseline);
      ctx.restore();

      const imageData = ctx.getImageData(0, 0, width, height);
      glyphs.push({ char, width, height, imageData });
    }

    return glyphs;
  }
}
