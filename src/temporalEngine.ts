// TemporalEngine — splits glyphs into alternating layers and drives the rAF loop

import type { GlyphBitmap } from "./glyph.js";

export interface LayerFrame {
  layerIndex: number;
  totalLayers: number;
  compositeImageData: ImageData;
}

export class TemporalEngine {
  private fps: number;
  private layerCount: number;
  private rafId: number | null = null;
  private lastFrameTime: number = 0;
  private currentLayer: number = 0;

  constructor(fps: number, layerCount: number = 2) {
    this.fps = fps;
    this.layerCount = layerCount;
  }

  /**
   * Split an array of GlyphBitmaps into N layers using round-robin pixel assignment.
   * Returns a 2D array: layers[layerIndex] = composited ImageData for that layer.
   */
  splitIntoLayers(glyphs: GlyphBitmap[]): ImageData[][] {
    return glyphs.map((glyph) => {
      const { width, height, imageData } = glyph;
      const src = imageData.data;

      // Create one ImageData per layer, all transparent by default
      const layers: ImageData[] = Array.from({ length: this.layerCount }, () => {
        const id = new ImageData(width, height);
        return id;
      });

      // Assign pixel i (RGBA group) to layer i % layerCount
      const pixelCount = width * height;
      for (let i = 0; i < pixelCount; i++) {
        const layer = i % this.layerCount;
        const offset = i * 4;
        layers[layer].data[offset] = src[offset];
        layers[layer].data[offset + 1] = src[offset + 1];
        layers[layer].data[offset + 2] = src[offset + 2];
        layers[layer].data[offset + 3] = src[offset + 3];
      }

      return layers;
    });
  }

  /**
   * Compose all per-glyph layer ImageDatas for the current layer into a single
   * wide ImageData that spans the full text width.
   */
  private compositeLayer(
    glyphLayers: ImageData[][],
    glyphs: GlyphBitmap[],
    layerIndex: number
  ): ImageData {
    const totalWidth = glyphs.reduce((sum, g) => sum + g.width, 0);
    const height = glyphs[0]?.height ?? 0;
    const composite = new ImageData(Math.max(totalWidth, 1), Math.max(height, 1));

    let xOffset = 0;
    for (let gi = 0; gi < glyphs.length; gi++) {
      const glyph = glyphs[gi];
      const layerData = glyphLayers[gi][layerIndex];
      for (let row = 0; row < glyph.height; row++) {
        for (let col = 0; col < glyph.width; col++) {
          const srcIdx = (row * glyph.width + col) * 4;
          const dstIdx = (row * totalWidth + xOffset + col) * 4;
          composite.data[dstIdx] = layerData.data[srcIdx];
          composite.data[dstIdx + 1] = layerData.data[srcIdx + 1];
          composite.data[dstIdx + 2] = layerData.data[srcIdx + 2];
          composite.data[dstIdx + 3] = layerData.data[srcIdx + 3];
        }
      }
      xOffset += glyph.width;
    }

    return composite;
  }

  start(
    glyphs: GlyphBitmap[],
    glyphLayers: ImageData[][],
    onFrame: (frame: LayerFrame) => void
  ): void {
    this.currentLayer = 0;
    this.lastFrameTime = 0;

    const tick = (timestamp: number) => {
      this.rafId = requestAnimationFrame(tick);

      const elapsed = timestamp - this.lastFrameTime;
      const interval = 1000 / this.fps;

      if (elapsed >= interval) {
        this.lastFrameTime = timestamp - (elapsed % interval);

        const compositeImageData = this.compositeLayer(glyphLayers, glyphs, this.currentLayer);
        onFrame({
          layerIndex: this.currentLayer,
          totalLayers: this.layerCount,
          compositeImageData,
        });

        this.currentLayer = (this.currentLayer + 1) % this.layerCount;
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
