// PatternEngine — generates CanvasPattern fills for stripe, diagonal, crosshatch

import type { PatternType } from "./renderer.js";

export class PatternEngine {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  getPattern(type: PatternType): CanvasPattern {
    const size = 4;
    const offscreen = document.createElement("canvas");
    offscreen.width = size;
    offscreen.height = size;
    const offCtx = offscreen.getContext("2d")!;

    offCtx.clearRect(0, 0, size, size);
    offCtx.strokeStyle = "#000000";
    offCtx.lineWidth = 1;

    if (type === "stripe") {
      // Vertical lines: draw at x=0 and x=2 (1px wide, 2px spacing)
      for (let x = 0; x < size; x += 2) {
        offCtx.beginPath();
        offCtx.moveTo(x + 0.5, 0);
        offCtx.lineTo(x + 0.5, size);
        offCtx.stroke();
      }
    } else if (type === "diagonal") {
      // 45° diagonal lines spaced 2px apart
      // Draw lines from top-right to bottom-left across the tile
      offCtx.beginPath();
      offCtx.moveTo(0, 0);
      offCtx.lineTo(size, size);
      offCtx.stroke();
      offCtx.beginPath();
      offCtx.moveTo(2, 0);
      offCtx.lineTo(size, size - 2);
      offCtx.stroke();
      offCtx.beginPath();
      offCtx.moveTo(0, 2);
      offCtx.lineTo(size - 2, size);
      offCtx.stroke();
    } else if (type === "crosshatch") {
      // Vertical lines
      for (let x = 0; x < size; x += 2) {
        offCtx.beginPath();
        offCtx.moveTo(x + 0.5, 0);
        offCtx.lineTo(x + 0.5, size);
        offCtx.stroke();
      }
      // Diagonal lines
      offCtx.beginPath();
      offCtx.moveTo(0, 0);
      offCtx.lineTo(size, size);
      offCtx.stroke();
      offCtx.beginPath();
      offCtx.moveTo(2, 0);
      offCtx.lineTo(size, size - 2);
      offCtx.stroke();
      offCtx.beginPath();
      offCtx.moveTo(0, 2);
      offCtx.lineTo(size - 2, size);
      offCtx.stroke();
    } else {
      throw new Error(`PatternEngine: unknown pattern type "${type}"`);
    }

    const pattern = this.ctx.createPattern(offscreen, "repeat");
    if (!pattern) {
      throw new Error(`PatternEngine: failed to create pattern for type "${type}"`);
    }
    return pattern;
  }
}
